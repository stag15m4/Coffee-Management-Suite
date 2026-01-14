-- Migration: Update pricing structure
-- Each module is $25/month except Recipe Cost Manager ($50/month standalone)
-- Premium Suite is $125/month for all modules

-- Update module pricing (using id column, not slug)
UPDATE modules SET monthly_price = 25.00 WHERE id = 'tip-payout';
UPDATE modules SET monthly_price = 25.00 WHERE id = 'cash-deposit';
UPDATE modules SET monthly_price = 25.00 WHERE id = 'bulk-ordering';
UPDATE modules SET monthly_price = 25.00 WHERE id = 'equipment-maintenance';
UPDATE modules SET monthly_price = 50.00 WHERE id = 'recipe-costing';

-- Update Premium Suite price
UPDATE subscription_plans SET monthly_price = 125.00 WHERE id = 'premium';

-- Also update the description to reflect new pricing
UPDATE subscription_plans SET description = 'All modules at $25/month each' WHERE id = 'alacarte';

-- Verify the updates
SELECT '=== UPDATED MODULES PRICING ===' as info;
SELECT id, name, monthly_price, is_premium_only FROM modules ORDER BY display_order;

SELECT '=== UPDATED SUBSCRIPTION PLANS ===' as info;
SELECT id, name, description, monthly_price FROM subscription_plans ORDER BY display_order;
