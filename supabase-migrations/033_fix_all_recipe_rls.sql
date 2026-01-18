-- =====================================================
-- FIX ALL RLS POLICIES FOR RECIPE COSTING MODULE
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. OVERHEAD_SETTINGS
DROP POLICY IF EXISTS "Users can view overhead_settings" ON overhead_settings;
DROP POLICY IF EXISTS "Users can read overhead_settings" ON overhead_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read overhead_settings" ON overhead_settings;
CREATE POLICY "Allow authenticated users to read overhead_settings" ON overhead_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update overhead_settings" ON overhead_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update overhead_settings" ON overhead_settings;
CREATE POLICY "Allow authenticated users to update overhead_settings" ON overhead_settings
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert overhead_settings" ON overhead_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert overhead_settings" ON overhead_settings;
CREATE POLICY "Allow authenticated users to insert overhead_settings" ON overhead_settings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. RECIPE_SIZE_PRICING
DROP POLICY IF EXISTS "Users can view recipe_size_pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Users can read recipe_size_pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Allow authenticated users to read recipe_size_pricing" ON recipe_size_pricing;
CREATE POLICY "Allow authenticated users to read recipe_size_pricing" ON recipe_size_pricing
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update recipe_size_pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Allow authenticated users to update recipe_size_pricing" ON recipe_size_pricing;
CREATE POLICY "Allow authenticated users to update recipe_size_pricing" ON recipe_size_pricing
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert recipe_size_pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Allow authenticated users to insert recipe_size_pricing" ON recipe_size_pricing;
CREATE POLICY "Allow authenticated users to insert recipe_size_pricing" ON recipe_size_pricing
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. RECIPE_SIZE_BASES
DROP POLICY IF EXISTS "Users can view recipe_size_bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Users can read recipe_size_bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Allow authenticated users to read recipe_size_bases" ON recipe_size_bases;
CREATE POLICY "Allow authenticated users to read recipe_size_bases" ON recipe_size_bases
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update recipe_size_bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Allow authenticated users to update recipe_size_bases" ON recipe_size_bases;
CREATE POLICY "Allow authenticated users to update recipe_size_bases" ON recipe_size_bases
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert recipe_size_bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Allow authenticated users to insert recipe_size_bases" ON recipe_size_bases;
CREATE POLICY "Allow authenticated users to insert recipe_size_bases" ON recipe_size_bases
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. INGREDIENTS (ensure all operations work)
DROP POLICY IF EXISTS "Authenticated users can insert ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can view ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to read ingredients" ON ingredients;
CREATE POLICY "Allow authenticated users to read ingredients" ON ingredients
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert ingredients" ON ingredients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update ingredients" ON ingredients;
CREATE POLICY "Allow authenticated users to update ingredients" ON ingredients
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 5. RECIPES (ensure all operations work)
DROP POLICY IF EXISTS "Authenticated users can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view recipes" ON recipes;
DROP POLICY IF EXISTS "Allow authenticated users to read recipes" ON recipes;
CREATE POLICY "Allow authenticated users to read recipes" ON recipes
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert recipes" ON recipes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update recipes" ON recipes;
CREATE POLICY "Allow authenticated users to update recipes" ON recipes
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete recipes" ON recipes;
CREATE POLICY "Allow authenticated users to delete recipes" ON recipes
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- 6. RECIPE_INGREDIENTS
DROP POLICY IF EXISTS "Authenticated users can insert recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Users can view recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to read recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Allow authenticated users to read recipe_ingredients" ON recipe_ingredients
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert recipe_ingredients" ON recipe_ingredients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Allow authenticated users to update recipe_ingredients" ON recipe_ingredients
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Allow authenticated users to delete recipe_ingredients" ON recipe_ingredients
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- 7. INGREDIENT_CATEGORIES
DROP POLICY IF EXISTS "Users can view ingredient_categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read ingredient_categories" ON ingredient_categories;
CREATE POLICY "Allow authenticated users to read ingredient_categories" ON ingredient_categories
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 8. PRODUCT_CATEGORIES
DROP POLICY IF EXISTS "Users can view product_categories" ON product_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read product_categories" ON product_categories;
CREATE POLICY "Allow authenticated users to read product_categories" ON product_categories
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 9. BASE_TEMPLATES
DROP POLICY IF EXISTS "Users can view base_templates" ON base_templates;
DROP POLICY IF EXISTS "Allow authenticated users to read base_templates" ON base_templates;
CREATE POLICY "Allow authenticated users to read base_templates" ON base_templates
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert base_templates" ON base_templates;
CREATE POLICY "Allow authenticated users to insert base_templates" ON base_templates
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 10. BASE_TEMPLATE_INGREDIENTS
DROP POLICY IF EXISTS "Users can view base_template_ingredients" ON base_template_ingredients;
DROP POLICY IF EXISTS "Allow authenticated users to read base_template_ingredients" ON base_template_ingredients;
CREATE POLICY "Allow authenticated users to read base_template_ingredients" ON base_template_ingredients
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert base_template_ingredients" ON base_template_ingredients;
CREATE POLICY "Allow authenticated users to insert base_template_ingredients" ON base_template_ingredients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete base_template_ingredients" ON base_template_ingredients;
CREATE POLICY "Allow authenticated users to delete base_template_ingredients" ON base_template_ingredients
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- 11. DRINK_SIZES
DROP POLICY IF EXISTS "Users can view drink_sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Allow authenticated users to read drink_sizes" ON drink_sizes;
CREATE POLICY "Allow authenticated users to read drink_sizes" ON drink_sizes
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert drink_sizes" ON drink_sizes;
CREATE POLICY "Allow authenticated users to insert drink_sizes" ON drink_sizes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete drink_sizes" ON drink_sizes;
CREATE POLICY "Allow authenticated users to delete drink_sizes" ON drink_sizes
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- SUCCESS - All Recipe Costing module tables now accessible
-- =====================================================
