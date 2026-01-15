-- =====================================================
-- FIX RECIPE INGREDIENTS INSERT POLICY
-- The "FOR ALL USING" policy doesn't work for INSERT operations
-- We need explicit INSERT policies with WITH CHECK
-- =====================================================

-- Drop the existing "manage" policy that doesn't work for inserts
DROP POLICY IF EXISTS "Managers can manage recipe ingredients" ON recipe_ingredients;

-- Create separate policies for each operation type

-- SELECT policy (already exists, but recreate for consistency)
DROP POLICY IF EXISTS "Users can view recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can view recipe ingredients" ON recipe_ingredients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

-- INSERT policy with WITH CHECK
CREATE POLICY "Managers can insert recipe ingredients" ON recipe_ingredients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- UPDATE policy
CREATE POLICY "Managers can update recipe ingredients" ON recipe_ingredients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- DELETE policy
CREATE POLICY "Managers can delete recipe ingredients" ON recipe_ingredients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- =====================================================
-- ALSO FIX recipe_size_bases (same issue)
-- =====================================================

DROP POLICY IF EXISTS "Managers can manage recipe size bases" ON recipe_size_bases;

DROP POLICY IF EXISTS "Users can view recipe size bases" ON recipe_size_bases;
CREATE POLICY "Users can view recipe size bases" ON recipe_size_bases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_bases.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

CREATE POLICY "Managers can insert recipe size bases" ON recipe_size_bases
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_bases.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update recipe size bases" ON recipe_size_bases
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_bases.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete recipe size bases" ON recipe_size_bases
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_bases.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- =====================================================
-- ALSO FIX recipe_size_pricing (same issue)
-- =====================================================

DROP POLICY IF EXISTS "Managers can manage recipe pricing" ON recipe_size_pricing;

DROP POLICY IF EXISTS "Users can view recipe pricing" ON recipe_size_pricing;
CREATE POLICY "Users can view recipe pricing" ON recipe_size_pricing
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_pricing.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

CREATE POLICY "Managers can insert recipe pricing" ON recipe_size_pricing
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_pricing.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update recipe pricing" ON recipe_size_pricing
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_pricing.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete recipe pricing" ON recipe_size_pricing
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_pricing.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );
