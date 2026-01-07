-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- Run this AFTER 002_add_tenant_to_tables.sql
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE overhead_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_template_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_size_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_size_bases ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TENANTS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (id = get_current_tenant_id());

-- =====================================================
-- TENANT BRANDING POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view their tenant branding" ON tenant_branding;
CREATE POLICY "Users can view their tenant branding" ON tenant_branding
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Owners can update tenant branding" ON tenant_branding;
CREATE POLICY "Owners can update tenant branding" ON tenant_branding
    FOR UPDATE USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('owner'));

-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
CREATE POLICY "Users can view profiles in their tenant" ON user_profiles
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage users" ON user_profiles;
CREATE POLICY "Owners can manage users" ON user_profiles
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('owner'));

-- =====================================================
-- INGREDIENTS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view ingredients in their tenant" ON ingredients;
CREATE POLICY "Users can view ingredients in their tenant" ON ingredients
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage ingredients" ON ingredients;
CREATE POLICY "Managers can manage ingredients" ON ingredients
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- INGREDIENT CATEGORIES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view ingredient categories" ON ingredient_categories;
CREATE POLICY "Users can view ingredient categories" ON ingredient_categories
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage ingredient categories" ON ingredient_categories;
CREATE POLICY "Managers can manage ingredient categories" ON ingredient_categories
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- PRODUCT CATEGORIES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view product categories" ON product_categories;
CREATE POLICY "Users can view product categories" ON product_categories
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage product categories" ON product_categories;
CREATE POLICY "Managers can manage product categories" ON product_categories
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- RECIPES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipes in their tenant" ON recipes;
CREATE POLICY "Users can view recipes in their tenant" ON recipes
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage recipes" ON recipes;
CREATE POLICY "Managers can manage recipes" ON recipes
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- BASE TEMPLATES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view base templates" ON base_templates;
CREATE POLICY "Users can view base templates" ON base_templates
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage base templates" ON base_templates;
CREATE POLICY "Managers can manage base templates" ON base_templates
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- OVERHEAD SETTINGS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view overhead settings" ON overhead_settings;
CREATE POLICY "Users can view overhead settings" ON overhead_settings
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage overhead settings" ON overhead_settings;
CREATE POLICY "Managers can manage overhead settings" ON overhead_settings
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- DRINK SIZES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view drink sizes" ON drink_sizes;
CREATE POLICY "Users can view drink sizes" ON drink_sizes
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Managers can manage drink sizes" ON drink_sizes;
CREATE POLICY "Managers can manage drink sizes" ON drink_sizes
    FOR ALL USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('manager'));

-- =====================================================
-- RECIPE INGREDIENTS POLICIES (via parent recipe)
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can view recipe ingredients" ON recipe_ingredients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Managers can manage recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Managers can manage recipe ingredients" ON recipe_ingredients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- =====================================================
-- BASE TEMPLATE INGREDIENTS POLICIES (via parent template)
-- =====================================================
DROP POLICY IF EXISTS "Users can view base template ingredients" ON base_template_ingredients;
CREATE POLICY "Users can view base template ingredients" ON base_template_ingredients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM base_templates 
            WHERE base_templates.id = base_template_ingredients.base_template_id 
            AND base_templates.tenant_id = get_current_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Managers can manage base template ingredients" ON base_template_ingredients;
CREATE POLICY "Managers can manage base template ingredients" ON base_template_ingredients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM base_templates 
            WHERE base_templates.id = base_template_ingredients.base_template_id 
            AND base_templates.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- =====================================================
-- RECIPE SIZE PRICING POLICIES (via parent recipe)
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipe pricing" ON recipe_size_pricing;
CREATE POLICY "Users can view recipe pricing" ON recipe_size_pricing
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_pricing.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Managers can manage recipe pricing" ON recipe_size_pricing;
CREATE POLICY "Managers can manage recipe pricing" ON recipe_size_pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_pricing.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- =====================================================
-- RECIPE SIZE BASES POLICIES (via parent recipe)
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipe size bases" ON recipe_size_bases;
CREATE POLICY "Users can view recipe size bases" ON recipe_size_bases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_bases.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Managers can manage recipe size bases" ON recipe_size_bases;
CREATE POLICY "Managers can manage recipe size bases" ON recipe_size_bases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM recipes 
            WHERE recipes.id = recipe_size_bases.recipe_id 
            AND recipes.tenant_id = get_current_tenant_id()
        ) AND has_role_or_higher('manager')
    );

-- =====================================================
-- IMPORTANT: Bypass policies for service role
-- The service role (used by backend) bypasses RLS
-- For frontend-only apps, RLS protects everything
-- =====================================================

-- Success message
-- Row Level Security enabled on all tables!
-- Each tenant's data is now isolated from others.
