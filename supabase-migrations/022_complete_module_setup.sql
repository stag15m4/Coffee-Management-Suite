-- =====================================================
-- COMPLETE MODULE & SUBSCRIPTION SETUP
-- Run this ENTIRE script in Supabase SQL Editor
-- This ensures all necessary data exists for modules to work
-- =====================================================

-- STEP 1: Ensure is_platform_admin function exists and works
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM platform_admins 
        WHERE id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 2: Insert all modules (including equipment-maintenance)
INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('recipe-costing', 'Recipe Cost Manager', 'Track ingredients, create recipes, calculate costs and margins', 0, true, 1),
    ('tip-payout', 'Tip Payout Calculator', 'Calculate and distribute employee tips', 19.99, false, 2),
    ('cash-deposit', 'Cash Deposit Record', 'Track cash deposits and reconciliation', 19.99, false, 3),
    ('bulk-ordering', 'Bulk Coffee Ordering', 'Manage wholesale coffee orders', 19.99, false, 4),
    ('equipment-maintenance', 'Equipment Maintenance', 'Track equipment maintenance schedules', 0, false, 5)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    is_premium_only = EXCLUDED.is_premium_only,
    display_order = EXCLUDED.display_order;

-- STEP 3: Insert subscription plans
INSERT INTO subscription_plans (id, name, description, monthly_price, display_order, is_active) VALUES
    ('free', 'Free Trial', '14-day trial with all features', 0, 1, true),
    ('alacarte', 'À La Carte', 'Pick individual modules at $19.99 each', 0, 2, true),
    ('test_eval', 'Test & Eval', 'Full-featured access for testing and evaluation', 49.99, 3, true),
    ('premium', 'Premium Suite', 'All 4 modules including Recipe Costing', 99.99, 4, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    is_active = EXCLUDED.is_active;

-- STEP 4: Link ALL modules to ALL plans (free, test_eval, premium get all modules)
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'recipe-costing'),
    ('free', 'tip-payout'),
    ('free', 'cash-deposit'),
    ('free', 'bulk-ordering'),
    ('free', 'equipment-maintenance'),
    ('test_eval', 'recipe-costing'),
    ('test_eval', 'tip-payout'),
    ('test_eval', 'cash-deposit'),
    ('test_eval', 'bulk-ordering'),
    ('test_eval', 'equipment-maintenance'),
    ('premium', 'recipe-costing'),
    ('premium', 'tip-payout'),
    ('premium', 'cash-deposit'),
    ('premium', 'bulk-ordering'),
    ('premium', 'equipment-maintenance')
ON CONFLICT DO NOTHING;

-- STEP 5: Update the get_tenant_enabled_modules function to handle edge cases
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

    -- If no plan set, default to 'free' (trial)
    IF tenant_plan IS NULL OR tenant_plan = '' THEN
        tenant_plan := 'free';
    END IF;

    -- For free trial, test & eval, and premium: get all modules from plan
    IF tenant_plan IN ('free', 'test_eval', 'premium') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
        WHERE tmo.is_enabled IS NULL OR tmo.is_enabled = true;
    ELSE
        -- For à la carte: get modules from tenant_module_subscriptions + overrides
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = p_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
        WHERE tmo.is_enabled IS NULL OR tmo.is_enabled = true;
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- DIAGNOSTIC QUERIES - Run these to verify everything works
-- =====================================================

-- Check 1: View all modules
SELECT '=== MODULES ===' as section;
SELECT id, name, monthly_price, is_premium_only FROM modules ORDER BY display_order;

-- Check 2: View all plans
SELECT '=== SUBSCRIPTION PLANS ===' as section;
SELECT id, name, monthly_price FROM subscription_plans ORDER BY display_order;

-- Check 3: View plan-module links
SELECT '=== PLAN-MODULE LINKS ===' as section;
SELECT plan_id, module_id FROM subscription_plan_modules ORDER BY plan_id, module_id;

-- Check 4: View all tenants and their plans
SELECT '=== TENANTS ===' as section;
SELECT id, name, subscription_plan, subscription_status, is_active FROM tenants;

-- Check 5: Test enabled modules for each tenant
SELECT '=== ENABLED MODULES PER TENANT ===' as section;
SELECT t.id, t.name, t.subscription_plan, get_tenant_enabled_modules(t.id) as enabled_modules
FROM tenants t;

-- Check 6: View user profiles
SELECT '=== USER PROFILES ===' as section;
SELECT id, tenant_id, email, role, is_active FROM user_profiles LIMIT 10;

-- Check 7: View platform admins
SELECT '=== PLATFORM ADMINS ===' as section;
SELECT user_id, email, is_active FROM platform_admins;

-- =====================================================
-- IF MODULES ARE STILL NOT SHOWING FOR A TENANT:
-- Run this to set the tenant's plan (replace the UUID with your tenant ID)
-- =====================================================
-- UPDATE tenants SET subscription_plan = 'test_eval' WHERE id = 'YOUR-TENANT-ID-HERE';
