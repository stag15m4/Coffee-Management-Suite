-- =====================================================
-- FIX MODULE ACCESS FOR TENANTS
-- Run this in Supabase SQL editor
-- =====================================================

-- STEP 1: Add equipment-maintenance module if not exists
INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('equipment-maintenance', 'Equipment Maintenance', 'Track equipment maintenance schedules', 0, false, 5)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- STEP 2: Add equipment-maintenance to all subscription plans
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'equipment-maintenance'),
    ('test_eval', 'equipment-maintenance'),
    ('premium', 'equipment-maintenance')
ON CONFLICT DO NOTHING;

-- STEP 3: View all tenants and their current subscription plan
SELECT id, name, subscription_plan FROM tenants;

-- STEP 4: SET THE SUBSCRIPTION PLAN FOR YOUR TENANT
-- Replace 'YOUR-TENANT-ID' with your actual tenant ID from Step 3
-- Options: 'free' (trial), 'test_eval' (full access), 'premium' (paid full access), 'alacarte' (pick modules)

-- Example: If your tenant ID is 00000000-0000-0000-0000-000000000001
-- UPDATE tenants SET subscription_plan = 'test_eval' WHERE id = '00000000-0000-0000-0000-000000000001';

-- Or update ALL tenants to have full access (use with caution):
-- UPDATE tenants SET subscription_plan = 'test_eval' WHERE subscription_plan IS NULL OR subscription_plan = '';

-- STEP 5: Verify the fix - test with your tenant ID
-- SELECT get_tenant_enabled_modules('YOUR-TENANT-ID');

-- Expected result should be an array like:
-- {recipe-costing,tip-payout,cash-deposit,bulk-ordering,equipment-maintenance}
