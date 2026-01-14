-- Migration: Update pricing structure
-- Each module is $25/month except Recipe Cost Manager ($50/month standalone)
-- Premium Suite is $125/month for all modules

-- Update module pricing
UPDATE modules SET monthly_price = 25.00 WHERE slug = 'tips';
UPDATE modules SET monthly_price = 25.00 WHERE slug = 'deposits';
UPDATE modules SET monthly_price = 25.00 WHERE slug = 'ordering';
UPDATE modules SET monthly_price = 25.00 WHERE slug = 'maintenance';
UPDATE modules SET monthly_price = 50.00 WHERE slug = 'recipes';

-- Update Premium Suite price
UPDATE subscription_plans SET monthly_price = 125.00 WHERE slug = 'premium';

-- Verify the updates
SELECT 'Modules pricing:' as info;
SELECT name, slug, monthly_price, is_premium_only FROM modules ORDER BY display_order;

SELECT 'Subscription plans:' as info;
SELECT name, slug, monthly_price FROM subscription_plans ORDER BY display_order;
