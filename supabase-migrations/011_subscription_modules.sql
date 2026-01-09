-- =====================================================
-- SUBSCRIPTION & MODULE ACCESS SCHEMA
-- Allows platform admin to control which modules each tenant can access
-- =====================================================

-- Define available modules
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0
);

-- Insert default modules
INSERT INTO modules (id, name, description, display_order) VALUES
    ('recipe-costing', 'Recipe Cost Manager', 'Track ingredients, create recipes, calculate costs and margins', 1),
    ('tip-payout', 'Tip Payout Calculator', 'Calculate and distribute employee tips', 2),
    ('cash-deposit', 'Cash Deposit Record', 'Track cash deposits and reconciliation', 3),
    ('bulk-ordering', 'Bulk Coffee Ordering', 'Manage wholesale coffee orders', 4)
ON CONFLICT (id) DO NOTHING;

-- Define subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2) DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Insert default plans
INSERT INTO subscription_plans (id, name, description, monthly_price, display_order) VALUES
    ('free', 'Free Trial', '14-day trial with all features', 0, 1),
    ('basic', 'Basic', 'Essential modules for small businesses', 29.99, 2),
    ('standard', 'Standard', 'Core modules for growing businesses', 59.99, 3),
    ('premium', 'Premium', 'All modules with priority support', 99.99, 4)
ON CONFLICT (id) DO NOTHING;

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

-- Basic: Recipe Costing + Tip Payout
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('basic', 'recipe-costing'),
    ('basic', 'tip-payout')
ON CONFLICT DO NOTHING;

-- Standard: Recipe Costing + Tip Payout + Cash Deposit
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('standard', 'recipe-costing'),
    ('standard', 'tip-payout'),
    ('standard', 'cash-deposit')
ON CONFLICT DO NOTHING;

-- Premium: All modules
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('premium', 'recipe-costing'),
    ('premium', 'tip-payout'),
    ('premium', 'cash-deposit'),
    ('premium', 'bulk-ordering')
ON CONFLICT DO NOTHING;

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

CREATE POLICY "Modules are readable by authenticated users" ON modules
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Platform admins can manage modules" ON modules
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Subscription plans - readable by all authenticated users
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are readable by authenticated users" ON subscription_plans
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Platform admins can manage plans" ON subscription_plans
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Subscription plan modules - readable by all authenticated users
ALTER TABLE subscription_plan_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan modules are readable by authenticated users" ON subscription_plan_modules
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Platform admins can manage plan modules" ON subscription_plan_modules
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Tenant module overrides - tenants can read their own, platform admins can manage all
ALTER TABLE tenant_module_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can read own module overrides" ON tenant_module_overrides
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Platform admins can manage all module overrides" ON tenant_module_overrides
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- HELPER FUNCTION: Get enabled modules for a tenant
-- Returns array of module IDs that are enabled for a tenant
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

    -- Get modules from plan, applying overrides
    SELECT ARRAY_AGG(m.id) INTO result
    FROM modules m
    LEFT JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
    LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
    WHERE 
        -- Module is enabled if:
        -- 1. Override explicitly enables it (tmo.is_enabled = true), OR
        -- 2. No override exists AND it's in the plan (spm.plan_id IS NOT NULL)
        (tmo.is_enabled = true) OR 
        (tmo.is_enabled IS NULL AND spm.plan_id IS NOT NULL);

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS
-- Run this in Supabase SQL editor
-- =====================================================
