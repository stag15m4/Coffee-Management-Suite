-- =====================================================
-- SUBSCRIPTION & MODULE ACCESS SCHEMA
-- Pricing Model:
-- - Basic modules (Tips, Deposits, Ordering): $19.99 each à la carte
-- - Premium Suite: All 4 modules for $99.99/month
-- - Recipe Costing is premium-only (the heavy hitter)
-- =====================================================

-- Define available modules with pricing
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0
);

-- Add new columns if they don't exist (for existing installations)
ALTER TABLE modules ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS is_premium_only BOOLEAN DEFAULT false;

-- Insert default modules with à la carte pricing
INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('recipe-costing', 'Recipe Cost Manager', 'Track ingredients, create recipes, calculate costs and margins', 0, true, 1),
    ('tip-payout', 'Tip Payout Calculator', 'Calculate and distribute employee tips', 19.99, false, 2),
    ('cash-deposit', 'Cash Deposit Record', 'Track cash deposits and reconciliation', 19.99, false, 3),
    ('bulk-ordering', 'Bulk Coffee Ordering', 'Manage wholesale coffee orders', 19.99, false, 4)
ON CONFLICT (id) DO UPDATE SET
    monthly_price = EXCLUDED.monthly_price,
    is_premium_only = EXCLUDED.is_premium_only;

-- Define subscription plans (simplified: free trial, à la carte, premium)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2) DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Insert plans
INSERT INTO subscription_plans (id, name, description, monthly_price, display_order) VALUES
    ('free', 'Free Trial', '14-day trial with all features', 0, 1),
    ('alacarte', 'À La Carte', 'Pick individual modules at $19.99 each', 0, 2),
    ('test_eval', 'Test & Eval', 'Full-featured access for testing and evaluation', 49.99, 3),
    ('premium', 'Premium Suite', 'All 4 modules including Recipe Costing', 99.99, 4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price;

-- Define which modules are included in each plan
CREATE TABLE IF NOT EXISTS subscription_plan_modules (
    plan_id TEXT REFERENCES subscription_plans(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES modules(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, module_id)
);

-- Set up default module access per plan
-- Free/Trial: All modules (for evaluation)
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'recipe-costing'),
    ('free', 'tip-payout'),
    ('free', 'cash-deposit'),
    ('free', 'bulk-ordering')
ON CONFLICT DO NOTHING;

-- À la carte: No default modules (admin selects which ones tenant has purchased)
-- (no inserts needed)

-- Test & Eval: All modules (full-featured)
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('test_eval', 'recipe-costing'),
    ('test_eval', 'tip-payout'),
    ('test_eval', 'cash-deposit'),
    ('test_eval', 'bulk-ordering')
ON CONFLICT DO NOTHING;

-- Premium: All modules
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('premium', 'recipe-costing'),
    ('premium', 'tip-payout'),
    ('premium', 'cash-deposit'),
    ('premium', 'bulk-ordering')
ON CONFLICT DO NOTHING;

-- Per-tenant module subscriptions (for à la carte purchases)
CREATE TABLE IF NOT EXISTS tenant_module_subscriptions (
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES modules(id) ON DELETE CASCADE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module_id)
);

-- Per-tenant module overrides (platform admin can enable/disable specific modules)
CREATE TABLE IF NOT EXISTS tenant_module_overrides (
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES modules(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module_id)
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Modules table - readable by all authenticated users
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Modules are readable by authenticated users" ON modules;
CREATE POLICY "Modules are readable by authenticated users" ON modules
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Platform admins can manage modules" ON modules;
CREATE POLICY "Platform admins can manage modules" ON modules
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Subscription plans - readable by all authenticated users
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans are readable by authenticated users" ON subscription_plans;
CREATE POLICY "Plans are readable by authenticated users" ON subscription_plans
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Platform admins can manage plans" ON subscription_plans;
CREATE POLICY "Platform admins can manage plans" ON subscription_plans
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Subscription plan modules - readable by all authenticated users
ALTER TABLE subscription_plan_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan modules are readable by authenticated users" ON subscription_plan_modules;
CREATE POLICY "Plan modules are readable by authenticated users" ON subscription_plan_modules
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Platform admins can manage plan modules" ON subscription_plan_modules;
CREATE POLICY "Platform admins can manage plan modules" ON subscription_plan_modules
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Tenant module subscriptions - tenants can read their own, platform admins can manage all
ALTER TABLE tenant_module_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can read own module subscriptions" ON tenant_module_subscriptions;
CREATE POLICY "Tenants can read own module subscriptions" ON tenant_module_subscriptions
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Platform admins can manage all module subscriptions" ON tenant_module_subscriptions;
CREATE POLICY "Platform admins can manage all module subscriptions" ON tenant_module_subscriptions
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Tenant module overrides - tenants can read their own, platform admins can manage all
ALTER TABLE tenant_module_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can read own module overrides" ON tenant_module_overrides;
CREATE POLICY "Tenants can read own module overrides" ON tenant_module_overrides
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Platform admins can manage all module overrides" ON tenant_module_overrides;
CREATE POLICY "Platform admins can manage all module overrides" ON tenant_module_overrides
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- HELPER FUNCTION: Get enabled modules for a tenant
-- Returns array of module IDs that are enabled for a tenant
-- Supports: Free Trial (all), Test & Eval (all), Premium (all), À La Carte (selected)
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    tenant_plan TEXT;
    result TEXT[];
BEGIN
    -- Get the tenant's subscription plan
    SELECT subscription_plan INTO tenant_plan
    FROM tenants
    WHERE id = p_tenant_id;

    -- If no plan, default to 'free'
    IF tenant_plan IS NULL THEN
        tenant_plan := 'free';
    END IF;

    -- For free trial, test & eval, and premium: get all modules from plan
    IF tenant_plan IN ('free', 'test_eval', 'premium') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        LEFT JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
        WHERE 
            (tmo.is_enabled = true) OR 
            (tmo.is_enabled IS NULL AND spm.plan_id IS NOT NULL);
    ELSE
        -- For à la carte: get modules from tenant_module_subscriptions + overrides
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        LEFT JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = p_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
        WHERE 
            (tmo.is_enabled = true) OR 
            (tmo.is_enabled IS NULL AND tms.tenant_id IS NOT NULL);
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- LEGACY PLAN MIGRATION
-- Migrate existing tenants from old plans to new model
-- =====================================================

-- Migrate 'basic' and 'standard' plans to 'alacarte' with appropriate modules
-- Basic had: recipe-costing, tip-payout -> now gets tip-payout only (recipe is premium-only)
-- Standard had: recipe-costing, tip-payout, cash-deposit -> now gets tip-payout, cash-deposit

-- First, create module subscriptions for legacy basic tenants
INSERT INTO tenant_module_subscriptions (tenant_id, module_id)
SELECT t.id, 'tip-payout'
FROM tenants t
WHERE t.subscription_plan = 'basic'
ON CONFLICT DO NOTHING;

-- Create module subscriptions for legacy standard tenants  
INSERT INTO tenant_module_subscriptions (tenant_id, module_id)
SELECT t.id, unnest(ARRAY['tip-payout', 'cash-deposit'])
FROM tenants t
WHERE t.subscription_plan = 'standard'
ON CONFLICT DO NOTHING;

-- Update legacy plans to 'alacarte'
UPDATE tenants 
SET subscription_plan = 'alacarte' 
WHERE subscription_plan IN ('basic', 'standard');

-- Clean up legacy plans from subscription_plans table
DELETE FROM subscription_plan_modules WHERE plan_id IN ('basic', 'standard');
DELETE FROM subscription_plans WHERE id IN ('basic', 'standard');

-- =====================================================
-- SUCCESS
-- Run this in Supabase SQL editor
-- =====================================================
