-- =====================================================
-- CREATE DEMO TENANT WITH COPIED DATA
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Create the demo tenant
-- Replace 'YOUR_TENANT_ID' below with your actual tenant ID from user_profiles
-- You can find it by running: SELECT DISTINCT tenant_id FROM user_profiles;

DO $$
DECLARE
    source_tenant_id UUID;
    demo_tenant_id UUID := gen_random_uuid();
    demo_user_id UUID := gen_random_uuid();
BEGIN
    -- Your Erwin Mills tenant ID
    source_tenant_id := '00000000-0000-0000-0000-000000000001'::UUID;
    
    -- Create the demo tenant
    INSERT INTO tenants (id, name, slug, created_at)
    VALUES (
        demo_tenant_id,
        'Sunrise Roasters Demo',
        'sunrise-roasters-demo',
        NOW()
    );
    
    -- Create demo branding (coffee shop theme)
    INSERT INTO tenant_branding (tenant_id, logo_url, primary_color, secondary_color, accent_color)
    VALUES (
        demo_tenant_id,
        NULL,
        '#2D5A27',  -- Forest green
        '#F4E4BC',  -- Warm cream
        '#8B4513'   -- Saddle brown
    );
    
    -- Copy equipment to demo tenant
    INSERT INTO equipment (id, tenant_id, name, category, notes, has_warranty, purchase_date, warranty_duration_months, warranty_notes, document_url, document_name, created_at)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        name,
        category,
        notes,
        has_warranty,
        purchase_date,
        warranty_duration_months,
        warranty_notes,
        document_url,
        document_name,
        NOW()
    FROM equipment
    WHERE tenant_id = source_tenant_id;
    
    -- Copy maintenance tasks (need to map equipment IDs)
    INSERT INTO maintenance_tasks (id, tenant_id, equipment_id, name, description, interval_type, interval_days, interval_units, unit_label, last_completed, current_usage, created_at)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        new_eq.id,
        mt.name,
        mt.description,
        mt.interval_type,
        mt.interval_days,
        mt.interval_units,
        mt.unit_label,
        mt.last_completed,
        mt.current_usage,
        NOW()
    FROM maintenance_tasks mt
    JOIN equipment old_eq ON mt.equipment_id = old_eq.id AND old_eq.tenant_id = source_tenant_id
    JOIN equipment new_eq ON new_eq.tenant_id = demo_tenant_id AND new_eq.name = old_eq.name;
    
    -- Copy ingredients
    INSERT INTO ingredients (id, tenant_id, name, unit, price_per_package, amount_in_package, created_at)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        name,
        unit,
        price_per_package,
        amount_in_package,
        NOW()
    FROM ingredients
    WHERE tenant_id = source_tenant_id;
    
    -- Copy recipes
    INSERT INTO recipes (id, tenant_id, name, servings, instructions, created_at)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        name,
        servings,
        instructions,
        NOW()
    FROM recipes
    WHERE tenant_id = source_tenant_id;
    
    -- Copy recipe_ingredients (need to map recipe and ingredient IDs)
    INSERT INTO recipe_ingredients (id, tenant_id, recipe_id, ingredient_id, quantity)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        new_r.id,
        new_i.id,
        ri.quantity
    FROM recipe_ingredients ri
    JOIN recipes old_r ON ri.recipe_id = old_r.id AND old_r.tenant_id = source_tenant_id
    JOIN recipes new_r ON new_r.tenant_id = demo_tenant_id AND new_r.name = old_r.name
    JOIN ingredients old_i ON ri.ingredient_id = old_i.id AND old_i.tenant_id = source_tenant_id
    JOIN ingredients new_i ON new_i.tenant_id = demo_tenant_id AND new_i.name = old_i.name;
    
    -- Copy tip employees
    INSERT INTO tip_employees (id, tenant_id, name, is_active, created_at)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        name,
        is_active,
        NOW()
    FROM tip_employees
    WHERE tenant_id = source_tenant_id;
    
    -- Copy coffee product prices
    INSERT INTO coffee_product_prices (id, tenant_id, product_name, price, created_at)
    SELECT 
        gen_random_uuid(),
        demo_tenant_id,
        product_name,
        price,
        NOW()
    FROM coffee_product_prices
    WHERE tenant_id = source_tenant_id;
    
    -- Output the demo tenant ID for reference
    RAISE NOTICE 'Demo tenant created with ID: %', demo_tenant_id;
    RAISE NOTICE 'Demo company name: Sunrise Roasters Demo';
    
END $$;

-- =====================================================
-- STEP 2: Create demo user in Supabase Auth
-- This must be done via Supabase Dashboard > Authentication > Users > Add User
-- 
-- Demo Login Credentials:
-- Email: demo@sunriseroasters.com
-- Password: DemoPass2024!
--
-- After creating the auth user, get the user ID and run:
-- =====================================================

-- Replace DEMO_AUTH_USER_ID with the ID from Supabase Auth after creating the user
-- Replace DEMO_TENANT_ID with the tenant ID printed above

/*
INSERT INTO user_profiles (id, tenant_id, email, role, created_at)
VALUES (
    'DEMO_AUTH_USER_ID'::UUID,
    'DEMO_TENANT_ID'::UUID,
    'demo@sunriseroasters.com',
    'owner',
    NOW()
);
*/

-- =====================================================
-- QUICK REFERENCE
-- =====================================================
-- Demo Company: Sunrise Roasters Demo
-- Demo Email: demo@sunriseroasters.com  
-- Demo Password: DemoPass2024!
-- Demo Role: Owner (full access)
-- =====================================================
