-- =====================================================
-- FIX RECIPE COSTING MODULE TENANT ISOLATION
-- Changes RLS from "any authenticated user" to proper tenant isolation
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. INGREDIENTS - Fix tenant isolation
DROP POLICY IF EXISTS "Allow authenticated users to read ingredients" ON ingredients;
DROP POLICY IF EXISTS "Authenticated users can insert ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to update ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to delete ingredients" ON ingredients;

CREATE POLICY "Tenant users can view ingredients" ON ingredients
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert ingredients" ON ingredients
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update ingredients" ON ingredients
    FOR UPDATE 
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete ingredients" ON ingredients
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- 2. RECIPES - Fix tenant isolation
DROP POLICY IF EXISTS "Allow authenticated users to read recipes" ON recipes;
DROP POLICY IF EXISTS "Authenticated users can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Allow authenticated users to update recipes" ON recipes;
DROP POLICY IF EXISTS "Allow authenticated users to delete recipes" ON recipes;

CREATE POLICY "Tenant users can view recipes" ON recipes
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert recipes" ON recipes
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update recipes" ON recipes
    FOR UPDATE 
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete recipes" ON recipes
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- 3. RECIPE_INGREDIENTS - Fix tenant isolation (via recipe join)
DROP POLICY IF EXISTS "Allow authenticated users to read recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Authenticated users can insert recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to update recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to delete recipe_ingredients" ON recipe_ingredients;

CREATE POLICY "Tenant users can view recipe_ingredients" ON recipe_ingredients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

CREATE POLICY "Managers can insert recipe_ingredients" ON recipe_ingredients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update recipe_ingredients" ON recipe_ingredients
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete recipe_ingredients" ON recipe_ingredients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
        AND has_role_or_higher('manager')
    );

-- 4. INGREDIENT_CATEGORIES - Fix tenant isolation
DROP POLICY IF EXISTS "Allow authenticated users to read ingredient_categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Managers can insert ingredient_categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Managers can update ingredient_categories" ON ingredient_categories;

CREATE POLICY "Tenant users can view ingredient_categories" ON ingredient_categories
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert ingredient_categories" ON ingredient_categories
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update ingredient_categories" ON ingredient_categories
    FOR UPDATE 
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- 5. OVERHEAD_SETTINGS - Fix tenant isolation
DROP POLICY IF EXISTS "Allow authenticated users to read overhead_settings" ON overhead_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update overhead_settings" ON overhead_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert overhead_settings" ON overhead_settings;

CREATE POLICY "Tenant users can view overhead_settings" ON overhead_settings
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert overhead_settings" ON overhead_settings
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update overhead_settings" ON overhead_settings
    FOR UPDATE 
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- 6. BASE_TEMPLATES - Fix tenant isolation
DROP POLICY IF EXISTS "Allow authenticated users to read base_templates" ON base_templates;
DROP POLICY IF EXISTS "Allow authenticated users to insert base_templates" ON base_templates;
DROP POLICY IF EXISTS "Managers can update base_templates" ON base_templates;
DROP POLICY IF EXISTS "Managers can delete base_templates" ON base_templates;

CREATE POLICY "Tenant users can view base_templates" ON base_templates
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert base_templates" ON base_templates
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update base_templates" ON base_templates
    FOR UPDATE 
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete base_templates" ON base_templates
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- 7. DRINK_SIZES - Fix tenant isolation
DROP POLICY IF EXISTS "Allow authenticated users to read drink_sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to insert drink_sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to delete drink_sizes" ON drink_sizes;

CREATE POLICY "Tenant users can view drink_sizes" ON drink_sizes
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert drink_sizes" ON drink_sizes
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete drink_sizes" ON drink_sizes
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- =====================================================
-- SUCCESS - Recipe Costing module now has proper tenant isolation
-- All UPDATE policies include WITH CHECK to prevent cross-tenant updates
-- =====================================================
