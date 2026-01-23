-- Migration 047: Update to correct pricing structure
-- Premium Suite: $99.99/month
-- Recipe Cost Manager: $39.99/month
-- Tip Payout Calculator: $19.99/month
-- Equipment Maintenance: $19.99/month
-- Administrative Tasks: $19.99/month
-- Cash Deposit Record: $9.99/month
-- Coffee Ordering: $9.99/month

-- =====================================================
-- UPDATE MODULE PRICING
-- =====================================================

UPDATE modules SET monthly_price = 39.99 WHERE id = 'recipe-costing';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'tip-payout';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'equipment-maintenance';
UPDATE modules SET monthly_price = 19.99 WHERE id = 'admin-tasks';
UPDATE modules SET monthly_price = 9.99 WHERE id = 'cash-deposit';
UPDATE modules SET monthly_price = 9.99 WHERE id = 'bulk-ordering';

-- Update Premium Suite price
UPDATE subscription_plans SET monthly_price = 99.99 WHERE id = 'premium';

-- Update description
UPDATE subscription_plans SET description = 'All 6 modules included, 5 locations' WHERE id = 'premium';
UPDATE subscription_plans SET description = 'Individual modules at varied pricing' WHERE id = 'alacarte';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '=== UPDATED MODULES PRICING ===' as info;
SELECT id, name, monthly_price FROM modules ORDER BY display_order;

SELECT '=== UPDATED SUBSCRIPTION PLANS ===' as info;
SELECT id, name, description, monthly_price FROM subscription_plans ORDER BY display_order;
