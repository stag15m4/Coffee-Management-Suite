-- =====================================================
-- SEED: PIZZERIA VERTICAL
-- Second vertical to validate the multi-vertical system.
-- If no code changes are needed, the architecture works.
-- =====================================================

DO $$
DECLARE
    v_pizza_id UUID;
BEGIN

-- =====================================================
-- 1. INSERT PIZZERIA VERTICAL
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
    'pizzeria',
    'PizzaSuite',
    'Pizzeria',
    true,
    true,
    '{
        "primaryColor": "#D32F2F",
        "secondaryColor": "#2E3A2C",
        "accentColor": "#FFEBEE",
        "backgroundColor": "#FFFFFF",
        "logoUrl": null,
        "iconEmoji": "🍕",
        "loadingText": "Preheating the oven..."
    }'::jsonb,
    '{
        "recipe":      { "singular": "Menu Item",    "plural": "Menu Items" },
        "ingredient":  { "singular": "Ingredient",   "plural": "Ingredients" },
        "recipeUnit":  { "singular": "pie",           "plural": "pies" },
        "menuItem":    { "singular": "Menu Item",    "plural": "Menu Items" },
        "vendor":      { "singular": "Supplier",     "plural": "Suppliers" },
        "equipment":   { "singular": "Equipment",    "plural": "Equipment" },
        "deposit":     { "singular": "Cash Deposit",  "plural": "Cash Deposits" },
        "tipPayout":   { "singular": "Tip Payout",    "plural": "Tip Payouts" },
        "employee":    { "singular": "Team Member",   "plural": "Team Members" },
        "location":    { "singular": "Location",      "plural": "Locations" },
        "task":        { "singular": "Task",           "plural": "Tasks" }
    }'::jsonb,
    '{
        "sizeVariants": true,
        "batchScaling": true,
        "locationTracking": false,
        "prepStations": true,
        "dailySpecials": false,
        "displayCase": false
    }'::jsonb,
    ARRAY['recipe-costing', 'cash-deposit', 'equipment-maintenance'],
    '{
        "headline": "Run your pizzeria like a pro",
        "subheadline": "Menu costing, tip payouts, cash deposits, equipment maintenance — built for pizzerias.",
        "heroImage": null,
        "ctaText": "Start Free Trial"
    }'::jsonb,
    ARRAY[]::TEXT[]
)
ON CONFLICT (slug) DO NOTHING
RETURNING id INTO v_pizza_id;

-- If the vertical already existed, fetch its id
IF v_pizza_id IS NULL THEN
    SELECT id INTO v_pizza_id FROM verticals WHERE slug = 'pizzeria';
END IF;

-- =====================================================
-- 2. STARTER INGREDIENT TEMPLATES
-- ~15 common pizzeria ingredients with realistic costs
-- =====================================================
INSERT INTO vertical_templates (vertical_id, template_type, name, sort_order, data) VALUES
    (v_pizza_id, 'ingredient', 'Pizza Dough', 1, '{
        "name": "Pizza Dough",
        "unit": "ball",
        "typical_cost": 0.75,
        "typical_quantity": 1,
        "category": "Dough"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Marinara Sauce', 2, '{
        "name": "Marinara Sauce",
        "unit": "can",
        "typical_cost": 4.99,
        "typical_quantity": 1,
        "category": "Sauces"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Mozzarella Cheese', 3, '{
        "name": "Mozzarella Cheese",
        "unit": "lb",
        "typical_cost": 3.99,
        "typical_quantity": 5,
        "category": "Cheese"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Pepperoni', 4, '{
        "name": "Pepperoni",
        "unit": "lb",
        "typical_cost": 5.49,
        "typical_quantity": 2,
        "category": "Meats"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Italian Sausage', 5, '{
        "name": "Italian Sausage",
        "unit": "lb",
        "typical_cost": 4.99,
        "typical_quantity": 2,
        "category": "Meats"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Mushrooms', 6, '{
        "name": "Mushrooms",
        "unit": "lb",
        "typical_cost": 3.49,
        "typical_quantity": 1,
        "category": "Vegetables"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Bell Peppers', 7, '{
        "name": "Bell Peppers",
        "unit": "lb",
        "typical_cost": 2.99,
        "typical_quantity": 1,
        "category": "Vegetables"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Onions', 8, '{
        "name": "Onions",
        "unit": "lb",
        "typical_cost": 1.49,
        "typical_quantity": 3,
        "category": "Vegetables"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Black Olives', 9, '{
        "name": "Black Olives",
        "unit": "can",
        "typical_cost": 2.99,
        "typical_quantity": 1,
        "category": "Vegetables"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Fresh Basil', 10, '{
        "name": "Fresh Basil",
        "unit": "bunch",
        "typical_cost": 2.49,
        "typical_quantity": 1,
        "category": "Herbs"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Olive Oil', 11, '{
        "name": "Olive Oil",
        "unit": "bottle",
        "typical_cost": 12.99,
        "typical_quantity": 1,
        "category": "Oils"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Pizza Box (Small)', 12, '{
        "name": "Pizza Box (Small)",
        "unit": "bundle",
        "typical_cost": 15.99,
        "typical_quantity": 50,
        "category": "Supplies"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Pizza Box (Large)', 13, '{
        "name": "Pizza Box (Large)",
        "unit": "bundle",
        "typical_cost": 22.99,
        "typical_quantity": 50,
        "category": "Supplies"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Parchment Circles', 14, '{
        "name": "Parchment Circles",
        "unit": "pack",
        "typical_cost": 8.99,
        "typical_quantity": 100,
        "category": "Supplies"
    }'::jsonb),
    (v_pizza_id, 'ingredient', 'Parmesan Cheese', 15, '{
        "name": "Parmesan Cheese",
        "unit": "lb",
        "typical_cost": 8.99,
        "typical_quantity": 1,
        "category": "Cheese"
    }'::jsonb);

-- =====================================================
-- 3. STARTER RECIPE TEMPLATES
-- ~5 classic pizzeria items with S/M/L size variants
-- =====================================================
INSERT INTO vertical_templates (vertical_id, template_type, name, sort_order, data) VALUES
    (v_pizza_id, 'recipe', 'Cheese Pizza', 1, '{
        "name": "Cheese Pizza",
        "description": "Classic pizza with marinara and mozzarella",
        "suggested_price": 12.99,
        "ingredients": [
            { "ingredient_name": "Pizza Dough", "quantity": 1, "unit": "ball" },
            { "ingredient_name": "Marinara Sauce", "quantity": 4, "unit": "oz" },
            { "ingredient_name": "Mozzarella Cheese", "quantity": 8, "unit": "oz" }
        ]
    }'::jsonb),
    (v_pizza_id, 'recipe', 'Pepperoni Pizza', 2, '{
        "name": "Pepperoni Pizza",
        "description": "Marinara, mozzarella, and classic pepperoni",
        "suggested_price": 14.99,
        "ingredients": [
            { "ingredient_name": "Pizza Dough", "quantity": 1, "unit": "ball" },
            { "ingredient_name": "Marinara Sauce", "quantity": 4, "unit": "oz" },
            { "ingredient_name": "Mozzarella Cheese", "quantity": 8, "unit": "oz" },
            { "ingredient_name": "Pepperoni", "quantity": 3, "unit": "oz" }
        ]
    }'::jsonb),
    (v_pizza_id, 'recipe', 'Margherita', 3, '{
        "name": "Margherita",
        "description": "Fresh mozzarella, tomato sauce, basil, and olive oil",
        "suggested_price": 15.99,
        "ingredients": [
            { "ingredient_name": "Pizza Dough", "quantity": 1, "unit": "ball" },
            { "ingredient_name": "Marinara Sauce", "quantity": 4, "unit": "oz" },
            { "ingredient_name": "Mozzarella Cheese", "quantity": 6, "unit": "oz" },
            { "ingredient_name": "Fresh Basil", "quantity": 0.25, "unit": "bunch" },
            { "ingredient_name": "Olive Oil", "quantity": 0.5, "unit": "oz" }
        ]
    }'::jsonb),
    (v_pizza_id, 'recipe', 'Meat Lovers', 4, '{
        "name": "Meat Lovers",
        "description": "Pepperoni, Italian sausage, and extra mozzarella",
        "suggested_price": 17.99,
        "ingredients": [
            { "ingredient_name": "Pizza Dough", "quantity": 1, "unit": "ball" },
            { "ingredient_name": "Marinara Sauce", "quantity": 4, "unit": "oz" },
            { "ingredient_name": "Mozzarella Cheese", "quantity": 10, "unit": "oz" },
            { "ingredient_name": "Pepperoni", "quantity": 3, "unit": "oz" },
            { "ingredient_name": "Italian Sausage", "quantity": 3, "unit": "oz" }
        ]
    }'::jsonb),
    (v_pizza_id, 'recipe', 'Veggie Supreme', 5, '{
        "name": "Veggie Supreme",
        "description": "Mushrooms, bell peppers, onions, olives, and fresh basil",
        "suggested_price": 16.99,
        "ingredients": [
            { "ingredient_name": "Pizza Dough", "quantity": 1, "unit": "ball" },
            { "ingredient_name": "Marinara Sauce", "quantity": 4, "unit": "oz" },
            { "ingredient_name": "Mozzarella Cheese", "quantity": 8, "unit": "oz" },
            { "ingredient_name": "Mushrooms", "quantity": 2, "unit": "oz" },
            { "ingredient_name": "Bell Peppers", "quantity": 2, "unit": "oz" },
            { "ingredient_name": "Onions", "quantity": 1.5, "unit": "oz" },
            { "ingredient_name": "Black Olives", "quantity": 1.5, "unit": "oz" },
            { "ingredient_name": "Fresh Basil", "quantity": 0.25, "unit": "bunch" }
        ]
    }'::jsonb);

-- =====================================================
-- 4. STARTER EQUIPMENT TEMPLATES
-- ~7 essential pizzeria equipment with maintenance schedules
-- =====================================================
INSERT INTO vertical_templates (vertical_id, template_type, name, sort_order, data) VALUES
    (v_pizza_id, 'equipment', 'Pizza Oven', 1, '{
        "name": "Pizza Oven",
        "category": "Cooking",
        "typical_maintenance": [
            { "task": "Clean oven floor and interior", "interval_days": 1 },
            { "task": "Inspect heating elements", "interval_days": 30 },
            { "task": "Calibrate thermostat", "interval_days": 90 },
            { "task": "Professional deep clean and service", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_pizza_id, 'equipment', 'Dough Mixer', 2, '{
        "name": "Dough Mixer",
        "category": "Prep",
        "typical_maintenance": [
            { "task": "Clean bowl, hook, and guards", "interval_days": 1 },
            { "task": "Lubricate gear box", "interval_days": 90 },
            { "task": "Inspect dough hook for wear", "interval_days": 180 },
            { "task": "Full service and belt inspection", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_pizza_id, 'equipment', 'Dough Sheeter', 3, '{
        "name": "Dough Sheeter",
        "category": "Prep",
        "typical_maintenance": [
            { "task": "Clean rollers and conveyor belt", "interval_days": 1 },
            { "task": "Lubricate bearings", "interval_days": 30 },
            { "task": "Check belt tension and alignment", "interval_days": 90 }
        ]
    }'::jsonb),
    (v_pizza_id, 'equipment', 'Prep Table', 4, '{
        "name": "Prep Table",
        "category": "Prep",
        "typical_maintenance": [
            { "task": "Sanitize surface and cold wells", "interval_days": 1 },
            { "task": "Check refrigeration temperature", "interval_days": 1 },
            { "task": "Clean condenser coils", "interval_days": 90 },
            { "task": "Replace door gaskets", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_pizza_id, 'equipment', 'Walk-in Cooler', 5, '{
        "name": "Walk-in Cooler",
        "category": "Storage",
        "typical_maintenance": [
            { "task": "Verify temperature log", "interval_days": 1 },
            { "task": "Clean condenser and evaporator coils", "interval_days": 90 },
            { "task": "Check door seals", "interval_days": 90 },
            { "task": "Professional refrigeration service", "interval_days": 365 }
        ]
    }'::jsonb),
    (v_pizza_id, 'equipment', 'Pizza Peel', 6, '{
        "name": "Pizza Peel",
        "category": "Tools",
        "typical_maintenance": [
            { "task": "Clean and inspect for warping", "interval_days": 1 },
            { "task": "Sand wooden handle if needed", "interval_days": 90 }
        ]
    }'::jsonb),
    (v_pizza_id, 'equipment', 'Dough Docker', 7, '{
        "name": "Dough Docker",
        "category": "Tools",
        "typical_maintenance": [
            { "task": "Clean pins and roller", "interval_days": 1 },
            { "task": "Check pins for damage", "interval_days": 30 }
        ]
    }'::jsonb);

END $$;

-- =====================================================
-- SUCCESS
-- =====================================================
-- Pizzeria vertical seeded:
--
-- Vertical:
--   slug: pizzeria
--   theme: red/green (#D32F2F / #388E3C)
--   11 term mappings (Menu Items, not Drinks)
--   3 workflow flags enabled (sizeVariants, batchScaling, prepStations)
--
-- Templates:
--   15 starter ingredients (dough, sauce, cheese, meats, veggies, supplies)
--    5 starter recipes (cheese, pepperoni, margherita, meat lovers, veggie)
--    7 starter equipment (oven, mixer, sheeter, prep table, cooler, peel, docker)
--
-- Validation criteria:
--   [ ] No code changes needed — only this SQL file
--   [ ] Terms render correctly ("Menu Items" not "Drinks")
--   [ ] Theme applies (red/green not gold/brown)
--   [ ] Starter templates load in onboarding
--   [ ] Size variants enabled via workflow flag
