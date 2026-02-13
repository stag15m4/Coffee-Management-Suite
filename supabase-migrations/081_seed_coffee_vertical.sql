-- =====================================================
-- SEED: COFFEE SHOP VERTICAL
-- Populates the first vertical with coffee-specific
-- configuration, terms, theme, and starter templates.
-- =====================================================

DO $$
DECLARE
    v_coffee_id UUID;
BEGIN

-- =====================================================
-- 1. INSERT COFFEE VERTICAL
-- =====================================================
INSERT INTO verticals (
    slug,
    product_name,
    display_name,
    is_published,
    is_system,
    theme,
    terms,
    workflows,
    suggested_modules,
    landing_content,
    domains
) VALUES (
    'coffee-shop',
    'CoffeeSuite',
    'Coffee Shop',
    true,
    true,
    '{
        "primaryColor": "#C9A227",
        "secondaryColor": "#4A3728",
        "accentColor": "#F5F0E1",
        "backgroundColor": "#FFFDF7",
        "logoUrl": null,
        "iconEmoji": "☕",
        "loadingText": "Grinding beans..."
    }'::jsonb,
    '{
        "recipe":      { "singular": "Drink",        "plural": "Drinks" },
        "ingredient":  { "singular": "Ingredient",   "plural": "Ingredients" },
        "recipeUnit":  { "singular": "drink",        "plural": "drinks" },
        "menuItem":    { "singular": "Menu Item",    "plural": "Menu Items" },
        "vendor":      { "singular": "Supplier",     "plural": "Suppliers" },
        "equipment":   { "singular": "Machine",      "plural": "Machines" },
        "deposit":     { "singular": "Cash Deposit",  "plural": "Cash Deposits" },
        "tipPayout":   { "singular": "Tip Payout",    "plural": "Tip Payouts" },
        "employee":    { "singular": "Team Member",   "plural": "Team Members" },
        "location":    { "singular": "Location",      "plural": "Locations" },
        "task":        { "singular": "Task",           "plural": "Tasks" }
    }'::jsonb,
    '{
        "sizeVariants": false,
        "batchScaling": false,
        "locationTracking": false,
        "prepStations": false,
        "dailySpecials": false,
        "displayCase": false
    }'::jsonb,
    ARRAY['recipe-costing', 'cash-deposit', 'tip-payout'],
    '{
        "headline": "Manage your coffee shop like a pro",
        "subheadline": "Recipe costing, tip payouts, cash deposits, and more — built for coffee shops.",
        "heroImage": null,
        "ctaText": "Start Free Trial"
    }'::jsonb,
    ARRAY[]::TEXT[]
)
ON CONFLICT (slug) DO NOTHING
RETURNING id INTO v_coffee_id;

-- If the vertical already existed, fetch its id
IF v_coffee_id IS NULL THEN
    SELECT id INTO v_coffee_id FROM verticals WHERE slug = 'coffee-shop';
END IF;

-- =====================================================
-- 2. STARTER INGREDIENT TEMPLATES
-- ~15 common coffee shop ingredients with realistic costs
-- =====================================================
INSERT INTO vertical_templates (vertical_id, template_type, name, sort_order, data) VALUES
    (v_coffee_id, 'ingredient', 'Espresso', 1, '{
        "name": "Espresso",
        "unit": "shot",
        "typical_cost": 0.35,
        "typical_quantity": 1,
        "category": "Coffee"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Whole Milk', 2, '{
        "name": "Whole Milk",
        "unit": "gallon",
        "typical_cost": 4.50,
        "typical_quantity": 1,
        "category": "Dairy"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Oat Milk', 3, '{
        "name": "Oat Milk",
        "unit": "carton",
        "typical_cost": 5.99,
        "typical_quantity": 1,
        "category": "Dairy Alternatives"
    }'::jsonb),
    (v_coffee_id, 'ingredient', '2% Milk', 4, '{
        "name": "2% Milk",
        "unit": "gallon",
        "typical_cost": 4.25,
        "typical_quantity": 1,
        "category": "Dairy"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Vanilla Syrup', 5, '{
        "name": "Vanilla Syrup",
        "unit": "bottle",
        "typical_cost": 12.99,
        "typical_quantity": 1,
        "category": "Syrups"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Caramel Syrup', 6, '{
        "name": "Caramel Syrup",
        "unit": "bottle",
        "typical_cost": 12.99,
        "typical_quantity": 1,
        "category": "Syrups"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Chocolate Sauce', 7, '{
        "name": "Chocolate Sauce",
        "unit": "bottle",
        "typical_cost": 9.49,
        "typical_quantity": 1,
        "category": "Syrups"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Whipped Cream', 8, '{
        "name": "Whipped Cream",
        "unit": "canister",
        "typical_cost": 4.99,
        "typical_quantity": 1,
        "category": "Toppings"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Half & Half', 9, '{
        "name": "Half & Half",
        "unit": "quart",
        "typical_cost": 3.25,
        "typical_quantity": 1,
        "category": "Dairy"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Chai Concentrate', 10, '{
        "name": "Chai Concentrate",
        "unit": "carton",
        "typical_cost": 7.99,
        "typical_quantity": 1,
        "category": "Tea"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Matcha Powder', 11, '{
        "name": "Matcha Powder",
        "unit": "bag",
        "typical_cost": 24.99,
        "typical_quantity": 1,
        "category": "Tea"
    }'::jsonb),
    (v_coffee_id, 'ingredient', '12oz Cups', 12, '{
        "name": "12oz Cups",
        "unit": "sleeve",
        "typical_cost": 3.50,
        "typical_quantity": 50,
        "category": "Supplies"
    }'::jsonb),
    (v_coffee_id, 'ingredient', '16oz Cups', 13, '{
        "name": "16oz Cups",
        "unit": "sleeve",
        "typical_cost": 4.25,
        "typical_quantity": 50,
        "category": "Supplies"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Lids', 14, '{
        "name": "Lids",
        "unit": "sleeve",
        "typical_cost": 2.99,
        "typical_quantity": 50,
        "category": "Supplies"
    }'::jsonb),
    (v_coffee_id, 'ingredient', 'Sleeves', 15, '{
        "name": "Sleeves",
        "unit": "pack",
        "typical_cost": 5.49,
        "typical_quantity": 100,
        "category": "Supplies"
    }'::jsonb);

-- =====================================================
-- 3. STARTER RECIPE TEMPLATES
-- ~8 classic coffee shop drinks with ingredient lists
-- =====================================================
INSERT INTO vertical_templates (vertical_id, template_type, name, sort_order, data) VALUES
    (v_coffee_id, 'recipe', 'Latte', 1, '{
        "name": "Latte",
        "description": "Espresso with steamed milk and a light layer of foam",
        "suggested_price": 5.50,
        "ingredients": [
            { "ingredient_name": "Espresso", "quantity": 2, "unit": "shot" },
            { "ingredient_name": "Whole Milk", "quantity": 10, "unit": "oz" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Cappuccino', 2, '{
        "name": "Cappuccino",
        "description": "Equal parts espresso, steamed milk, and foam",
        "suggested_price": 5.25,
        "ingredients": [
            { "ingredient_name": "Espresso", "quantity": 2, "unit": "shot" },
            { "ingredient_name": "Whole Milk", "quantity": 6, "unit": "oz" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Americano', 3, '{
        "name": "Americano",
        "description": "Espresso diluted with hot water for a smooth, full-bodied coffee",
        "suggested_price": 4.25,
        "ingredients": [
            { "ingredient_name": "Espresso", "quantity": 2, "unit": "shot" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Mocha', 4, '{
        "name": "Mocha",
        "description": "Espresso with chocolate sauce, steamed milk, and whipped cream",
        "suggested_price": 6.00,
        "ingredients": [
            { "ingredient_name": "Espresso", "quantity": 2, "unit": "shot" },
            { "ingredient_name": "Chocolate Sauce", "quantity": 1, "unit": "oz" },
            { "ingredient_name": "Whole Milk", "quantity": 8, "unit": "oz" },
            { "ingredient_name": "Whipped Cream", "quantity": 1, "unit": "dollop" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Cold Brew', 5, '{
        "name": "Cold Brew",
        "description": "Slow-steeped coffee served over ice for a smooth, less acidic brew",
        "suggested_price": 5.00,
        "ingredients": [
            { "ingredient_name": "Espresso", "quantity": 3, "unit": "shot" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Drip Coffee', 6, '{
        "name": "Drip Coffee",
        "description": "Classic brewed coffee, served hot",
        "suggested_price": 3.00,
        "ingredients": [
            { "ingredient_name": "Espresso", "quantity": 1, "unit": "shot" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Chai Latte', 7, '{
        "name": "Chai Latte",
        "description": "Spiced chai concentrate with steamed milk",
        "suggested_price": 5.50,
        "ingredients": [
            { "ingredient_name": "Chai Concentrate", "quantity": 4, "unit": "oz" },
            { "ingredient_name": "Whole Milk", "quantity": 8, "unit": "oz" }
        ]
    }'::jsonb),
    (v_coffee_id, 'recipe', 'Hot Chocolate', 8, '{
        "name": "Hot Chocolate",
        "description": "Rich chocolate sauce with steamed milk and whipped cream",
        "suggested_price": 4.75,
        "ingredients": [
            { "ingredient_name": "Chocolate Sauce", "quantity": 2, "unit": "oz" },
            { "ingredient_name": "Whole Milk", "quantity": 10, "unit": "oz" },
            { "ingredient_name": "Whipped Cream", "quantity": 1, "unit": "dollop" }
        ]
    }'::jsonb);

-- =====================================================
-- 4. STARTER EQUIPMENT TEMPLATES
-- ~6 essential coffee shop machines with maintenance schedules
-- =====================================================
INSERT INTO vertical_templates (vertical_id, template_type, name, sort_order, data) VALUES
    (v_coffee_id, 'equipment', 'Espresso Machine', 1, '{
        "name": "Espresso Machine",
        "category": "Brewing",
        "typical_maintenance": [
            { "task": "Backflush with cleaner", "interval_days": 1 },
            { "task": "Descale boiler", "interval_days": 90 },
            { "task": "Replace group head gaskets", "interval_days": 365 },
            { "task": "Full service and calibration", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_coffee_id, 'equipment', 'Grinder', 2, '{
        "name": "Grinder",
        "category": "Brewing",
        "typical_maintenance": [
            { "task": "Clean burrs and hopper", "interval_days": 7 },
            { "task": "Calibrate grind settings", "interval_days": 7 },
            { "task": "Replace burrs", "interval_days": 730 }
        ]
    }'::jsonb),
    (v_coffee_id, 'equipment', 'Blender', 3, '{
        "name": "Blender",
        "category": "Preparation",
        "typical_maintenance": [
            { "task": "Deep clean jar and blade assembly", "interval_days": 1 },
            { "task": "Inspect blade for wear", "interval_days": 90 },
            { "task": "Replace gasket seals", "interval_days": 180 }
        ]
    }'::jsonb),
    (v_coffee_id, 'equipment', 'Commercial Refrigerator', 4, '{
        "name": "Commercial Refrigerator",
        "category": "Storage",
        "typical_maintenance": [
            { "task": "Clean condenser coils", "interval_days": 90 },
            { "task": "Check door seals and gaskets", "interval_days": 90 },
            { "task": "Verify thermostat calibration", "interval_days": 30 },
            { "task": "Full service inspection", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_coffee_id, 'equipment', 'Ice Machine', 5, '{
        "name": "Ice Machine",
        "category": "Beverage",
        "typical_maintenance": [
            { "task": "Clean and sanitize interior", "interval_days": 30 },
            { "task": "Replace water filter", "interval_days": 180 },
            { "task": "Descale water lines", "interval_days": 180 },
            { "task": "Professional maintenance check", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_coffee_id, 'equipment', 'POS Terminal', 6, '{
        "name": "POS Terminal",
        "category": "Operations",
        "typical_maintenance": [
            { "task": "Software update check", "interval_days": 30 },
            { "task": "Clean screen and card reader", "interval_days": 7 },
            { "task": "Verify receipt printer paper stock", "interval_days": 1 }
        ]
    }'::jsonb);

-- =====================================================
-- 5. LINK EXISTING ERWIN MILLS TENANT TO COFFEE VERTICAL
-- =====================================================
UPDATE tenants
SET vertical_id = v_coffee_id,
    updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

END $$;

-- =====================================================
-- SUCCESS
-- =====================================================
-- Coffee Shop vertical seeded:
--
-- Vertical:
--   slug: coffee-shop
--   theme: gold/brown (#C9A227 / #4A3728)
--   11 term mappings for UI labels
--   6 workflow flags (all off by default)
--
-- Templates:
--   15 starter ingredients (espresso, milks, syrups, supplies)
--    8 starter recipes (latte, cappuccino, americano, etc.)
--    6 starter equipment (espresso machine, grinder, etc.)
--
-- Erwin Mills tenant linked to coffee-shop vertical
