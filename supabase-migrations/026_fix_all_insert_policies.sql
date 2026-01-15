-- =====================================================
-- FIX ALL INSERT POLICIES
-- The "FOR ALL USING" policy doesn't properly handle INSERT operations
-- We need to add WITH CHECK clauses for INSERT to work
-- =====================================================

-- =====================================================
-- RECIPES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage recipes" ON recipes;

CREATE POLICY "Managers can insert recipes" ON recipes
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update recipes" ON recipes
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete recipes" ON recipes
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- INGREDIENTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage ingredients" ON ingredients;

CREATE POLICY "Managers can insert ingredients" ON ingredients
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update ingredients" ON ingredients
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete ingredients" ON ingredients
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- INGREDIENT CATEGORIES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage ingredient categories" ON ingredient_categories;

CREATE POLICY "Managers can insert ingredient categories" ON ingredient_categories
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update ingredient categories" ON ingredient_categories
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete ingredient categories" ON ingredient_categories
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- PRODUCT CATEGORIES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage product categories" ON product_categories;

CREATE POLICY "Managers can insert product categories" ON product_categories
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update product categories" ON product_categories
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete product categories" ON product_categories
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- BASE TEMPLATES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage base templates" ON base_templates;

CREATE POLICY "Managers can insert base templates" ON base_templates
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update base templates" ON base_templates
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete base templates" ON base_templates
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- OVERHEAD SETTINGS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage overhead settings" ON overhead_settings;

CREATE POLICY "Managers can insert overhead settings" ON overhead_settings
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update overhead settings" ON overhead_settings
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete overhead settings" ON overhead_settings
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- DRINK SIZES TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage drink sizes" ON drink_sizes;

CREATE POLICY "Managers can insert drink sizes" ON drink_sizes
    FOR INSERT WITH CHECK (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update drink sizes" ON drink_sizes
    FOR UPDATE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete drink sizes" ON drink_sizes
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() AND has_role_or_higher('manager')
    );

-- =====================================================
-- BASE TEMPLATE INGREDIENTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "Managers can manage base template ingredients" ON base_template_ingredients;

CREATE POLICY "Managers can insert base template ingredients" ON base_template_ingredients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM base_templates 
            WHERE base_templates.id = base_template_ingredients.base_template_id 
            AND base_templates.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update base template ingredients" ON base_template_ingredients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM base_templates 
            WHERE base_templates.id = base_template_ingredients.base_template_id 
            AND base_templates.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete base template ingredients" ON base_template_ingredients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM base_templates 
            WHERE base_templates.id = base_template_ingredients.base_template_id 
            AND base_templates.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );
