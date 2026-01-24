-- Migration 048: Update to uniform module pricing ($19.99/mo for all)
-- All individual modules: $19.99/month
-- Premium Suite: $99.99/month (unchanged)

-- =====================================================
-- UPDATE MODULE PRICING TO UNIFORM $19.99/mo
-- =====================================================

UPDATE modules SET monthly_price = 19.99 WHERE id = 'recipe-costing';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'tip-payout';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'equipment-maintenance';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'admin-tasks';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'cash-deposit';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'bulk-ordering';

-- Update À La Carte description to reflect uniform pricing
UPDATE subscription_plans SET description = 'Individual modules at $19.99/mo each' WHERE id = 'alacarte';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '=== UPDATED MODULES PRICING (ALL $19.99) ===' as info;
SELECT id, name, monthly_price FROM modules ORDER BY display_order;

SELECT '=== SUBSCRIPTION PLANS ===' as info;
SELECT id, name, description, monthly_price FROM subscription_plans ORDER BY display_order;
