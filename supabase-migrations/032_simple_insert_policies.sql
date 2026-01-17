-- =====================================================
-- SIMPLIFIED INSERT POLICIES
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop and recreate with simple authenticated user check
DROP POLICY IF EXISTS "Managers+ can insert ingredients" ON ingredients;
CREATE POLICY "Authenticated users can insert ingredients" ON ingredients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Managers+ can insert recipes" ON recipes;
CREATE POLICY "Authenticated users can insert recipes" ON recipes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Managers+ can insert recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Authenticated users can insert recipe_ingredients" ON recipe_ingredients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- SUCCESS - Any logged-in user can now insert
-- =====================================================
