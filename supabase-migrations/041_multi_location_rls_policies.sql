-- =====================================================
-- MULTI-LOCATION RLS POLICY UPDATES
-- Run this AFTER 040_multi_location_schema.sql
-- 
-- Updates RLS policies to use can_access_tenant() helper
-- for proper cross-location data access by owners and 
-- assigned users.
-- =====================================================

-- =====================================================
-- TENANTS TABLE - Allow viewing accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view accessible tenants" ON tenants;
CREATE POLICY "Users can view accessible tenants" ON tenants
    FOR SELECT USING (can_access_tenant(id));

-- =====================================================
-- TENANT BRANDING - Allow viewing branding for accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view their tenant branding" ON tenant_branding;
DROP POLICY IF EXISTS "Users can view accessible tenant branding" ON tenant_branding;
CREATE POLICY "Users can view accessible tenant branding" ON tenant_branding
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Owners can update tenant branding" ON tenant_branding;
CREATE POLICY "Owners can update tenant branding" ON tenant_branding
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role));

DROP POLICY IF EXISTS "Owners can insert tenant branding" ON tenant_branding;
CREATE POLICY "Owners can insert tenant branding" ON tenant_branding
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role));

-- =====================================================
-- CASH ACTIVITY - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view cash activity in their tenant" ON cash_activity;
DROP POLICY IF EXISTS "Users can view accessible cash activity" ON cash_activity;
CREATE POLICY "Users can view accessible cash activity" ON cash_activity
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Managers can manage cash activity" ON cash_activity;
DROP POLICY IF EXISTS "Managers can insert cash activity" ON cash_activity;
DROP POLICY IF EXISTS "Managers can update cash activity" ON cash_activity;
DROP POLICY IF EXISTS "Managers can delete cash activity" ON cash_activity;

CREATE POLICY "Managers can insert cash activity" ON cash_activity
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update cash activity" ON cash_activity
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete cash activity" ON cash_activity
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- TIP EMPLOYEES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view tip employees in their tenant" ON tip_employees;
DROP POLICY IF EXISTS "Users can view accessible tip employees" ON tip_employees;
CREATE POLICY "Users can view accessible tip employees" ON tip_employees
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Leads can manage tip employees" ON tip_employees;
DROP POLICY IF EXISTS "Leads can insert tip employees" ON tip_employees;
DROP POLICY IF EXISTS "Leads can update tip employees" ON tip_employees;
DROP POLICY IF EXISTS "Leads can delete tip employees" ON tip_employees;

CREATE POLICY "Leads can insert tip employees" ON tip_employees
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can update tip employees" ON tip_employees
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can delete tip employees" ON tip_employees
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- =====================================================
-- TIP WEEKLY DATA - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view tip weekly data in their tenant" ON tip_weekly_data;
DROP POLICY IF EXISTS "Users can view accessible tip weekly data" ON tip_weekly_data;
CREATE POLICY "Users can view accessible tip weekly data" ON tip_weekly_data
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Leads can manage tip weekly data" ON tip_weekly_data;
DROP POLICY IF EXISTS "Leads can insert tip weekly data" ON tip_weekly_data;
DROP POLICY IF EXISTS "Leads can update tip weekly data" ON tip_weekly_data;

CREATE POLICY "Leads can insert tip weekly data" ON tip_weekly_data
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can update tip weekly data" ON tip_weekly_data
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- =====================================================
-- TIP EMPLOYEE HOURS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view tip hours in their tenant" ON tip_employee_hours;
DROP POLICY IF EXISTS "Users can view accessible tip hours" ON tip_employee_hours;
CREATE POLICY "Users can view accessible tip hours" ON tip_employee_hours
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Leads can manage tip hours" ON tip_employee_hours;
DROP POLICY IF EXISTS "Leads can insert tip hours" ON tip_employee_hours;
DROP POLICY IF EXISTS "Leads can update tip hours" ON tip_employee_hours;

CREATE POLICY "Leads can insert tip hours" ON tip_employee_hours
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can update tip hours" ON tip_employee_hours
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- =====================================================
-- TENANT COFFEE VENDORS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view own tenant vendor" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Leads+ can manage vendor" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Users can view accessible coffee vendors" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Leads can insert coffee vendors" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Leads can update coffee vendors" ON tenant_coffee_vendors;

CREATE POLICY "Users can view accessible coffee vendors" ON tenant_coffee_vendors
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Leads can insert coffee vendors" ON tenant_coffee_vendors
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can update coffee vendors" ON tenant_coffee_vendors
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- =====================================================
-- TENANT COFFEE PRODUCTS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view own tenant products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Leads+ can manage products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Users can view accessible coffee products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Leads can insert coffee products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Leads can update coffee products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Leads can delete coffee products" ON tenant_coffee_products;

CREATE POLICY "Users can view accessible coffee products" ON tenant_coffee_products
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Leads can insert coffee products" ON tenant_coffee_products
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can update coffee products" ON tenant_coffee_products
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can delete coffee products" ON tenant_coffee_products
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- =====================================================
-- COFFEE ORDER HISTORY - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view coffee orders in their tenant" ON coffee_order_history;
DROP POLICY IF EXISTS "Users can view accessible coffee orders" ON coffee_order_history;
CREATE POLICY "Users can view accessible coffee orders" ON coffee_order_history
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Leads can manage coffee orders" ON coffee_order_history;
DROP POLICY IF EXISTS "Leads can insert coffee orders" ON coffee_order_history;

CREATE POLICY "Leads can insert coffee orders" ON coffee_order_history
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- =====================================================
-- EQUIPMENT - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view equipment in their tenant" ON equipment;
DROP POLICY IF EXISTS "Users can view accessible equipment" ON equipment;
CREATE POLICY "Users can view accessible equipment" ON equipment
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Leads can manage equipment" ON equipment;
DROP POLICY IF EXISTS "Managers can manage equipment" ON equipment;
DROP POLICY IF EXISTS "Managers can insert equipment" ON equipment;
DROP POLICY IF EXISTS "Managers can update equipment" ON equipment;
DROP POLICY IF EXISTS "Managers can delete equipment" ON equipment;

CREATE POLICY "Managers can insert equipment" ON equipment
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update equipment" ON equipment
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete equipment" ON equipment
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- MAINTENANCE TASKS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view maintenance tasks in their tenant" ON maintenance_tasks;
DROP POLICY IF EXISTS "Users can view accessible maintenance tasks" ON maintenance_tasks;
CREATE POLICY "Users can view accessible maintenance tasks" ON maintenance_tasks
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Managers can manage maintenance tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Managers can insert maintenance tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Managers can update maintenance tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Managers can delete maintenance tasks" ON maintenance_tasks;

CREATE POLICY "Managers can insert maintenance tasks" ON maintenance_tasks
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update maintenance tasks" ON maintenance_tasks
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete maintenance tasks" ON maintenance_tasks
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- MAINTENANCE LOGS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view maintenance logs in their tenant" ON maintenance_logs;
DROP POLICY IF EXISTS "Users can view accessible maintenance logs" ON maintenance_logs;
CREATE POLICY "Users can view accessible maintenance logs" ON maintenance_logs
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Employees can insert maintenance logs" ON maintenance_logs;
DROP POLICY IF EXISTS "All users can insert maintenance logs" ON maintenance_logs;
CREATE POLICY "All users can insert maintenance logs" ON maintenance_logs
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

-- =====================================================
-- ADMIN TASK CATEGORIES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view task categories in their tenant" ON admin_task_categories;
DROP POLICY IF EXISTS "Users can view accessible task categories" ON admin_task_categories;
CREATE POLICY "Users can view accessible task categories" ON admin_task_categories
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Managers can manage task categories" ON admin_task_categories;
DROP POLICY IF EXISTS "Managers can insert task categories" ON admin_task_categories;
DROP POLICY IF EXISTS "Managers can update task categories" ON admin_task_categories;
DROP POLICY IF EXISTS "Managers can delete task categories" ON admin_task_categories;

CREATE POLICY "Managers can insert task categories" ON admin_task_categories
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update task categories" ON admin_task_categories
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete task categories" ON admin_task_categories
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- ADMIN TASKS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view tasks in their tenant" ON admin_tasks;
DROP POLICY IF EXISTS "Users can view accessible tasks" ON admin_tasks;
CREATE POLICY "Users can view accessible tasks" ON admin_tasks
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Managers can manage tasks" ON admin_tasks;
DROP POLICY IF EXISTS "Managers can insert tasks" ON admin_tasks;
DROP POLICY IF EXISTS "Managers can update tasks" ON admin_tasks;
DROP POLICY IF EXISTS "Managers can delete tasks" ON admin_tasks;

CREATE POLICY "Managers can insert tasks" ON admin_tasks
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update tasks" ON admin_tasks
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete tasks" ON admin_tasks
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- ADMIN TASK COMMENTS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view task comments in their tenant" ON admin_task_comments;
DROP POLICY IF EXISTS "Users can view accessible task comments" ON admin_task_comments;
CREATE POLICY "Users can view accessible task comments" ON admin_task_comments
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Managers can insert task comments" ON admin_task_comments;
CREATE POLICY "Managers can insert task comments" ON admin_task_comments
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- ADMIN TASK HISTORY - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view task history in their tenant" ON admin_task_history;
DROP POLICY IF EXISTS "Users can view accessible task history" ON admin_task_history;
CREATE POLICY "Users can view accessible task history" ON admin_task_history
    FOR SELECT USING (can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "System can insert task history" ON admin_task_history;
CREATE POLICY "System can insert task history" ON admin_task_history
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

-- =====================================================
-- USER PROFILES - Allow viewing profiles across accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can view accessible profiles" ON user_profiles;
CREATE POLICY "Users can view accessible profiles" ON user_profiles
    FOR SELECT USING (can_access_tenant(tenant_id));

-- =====================================================
-- INGREDIENTS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view ingredients in their tenant" ON ingredients;
DROP POLICY IF EXISTS "Managers can manage ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can view accessible ingredients" ON ingredients;
DROP POLICY IF EXISTS "Managers can insert ingredients" ON ingredients;
DROP POLICY IF EXISTS "Managers can update ingredients" ON ingredients;
DROP POLICY IF EXISTS "Managers can delete ingredients" ON ingredients;

CREATE POLICY "Users can view accessible ingredients" ON ingredients
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert ingredients" ON ingredients
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update ingredients" ON ingredients
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete ingredients" ON ingredients
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- INGREDIENT CATEGORIES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view ingredient categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Managers can manage ingredient categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Users can view accessible ingredient categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Managers can insert ingredient categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Managers can update ingredient categories" ON ingredient_categories;
DROP POLICY IF EXISTS "Managers can delete ingredient categories" ON ingredient_categories;

CREATE POLICY "Users can view accessible ingredient categories" ON ingredient_categories
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert ingredient categories" ON ingredient_categories
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update ingredient categories" ON ingredient_categories
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete ingredient categories" ON ingredient_categories
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- PRODUCT CATEGORIES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view product categories" ON product_categories;
DROP POLICY IF EXISTS "Managers can manage product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can view accessible product categories" ON product_categories;
DROP POLICY IF EXISTS "Managers can insert product categories" ON product_categories;
DROP POLICY IF EXISTS "Managers can update product categories" ON product_categories;
DROP POLICY IF EXISTS "Managers can delete product categories" ON product_categories;

CREATE POLICY "Users can view accessible product categories" ON product_categories
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert product categories" ON product_categories
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update product categories" ON product_categories
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete product categories" ON product_categories
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- RECIPES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipes in their tenant" ON recipes;
DROP POLICY IF EXISTS "Managers can manage recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view accessible recipes" ON recipes;
DROP POLICY IF EXISTS "Managers can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Managers can update recipes" ON recipes;
DROP POLICY IF EXISTS "Managers can delete recipes" ON recipes;

CREATE POLICY "Users can view accessible recipes" ON recipes
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert recipes" ON recipes
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update recipes" ON recipes
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete recipes" ON recipes
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- RECIPE INGREDIENTS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Managers can manage recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Users can view accessible recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Managers can insert recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Managers can update recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Managers can delete recipe ingredients" ON recipe_ingredients;

CREATE POLICY "Users can view accessible recipe ingredients" ON recipe_ingredients
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert recipe ingredients" ON recipe_ingredients
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update recipe ingredients" ON recipe_ingredients
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete recipe ingredients" ON recipe_ingredients
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- BASE TEMPLATES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view base templates" ON base_templates;
DROP POLICY IF EXISTS "Managers can manage base templates" ON base_templates;
DROP POLICY IF EXISTS "Users can view accessible base templates" ON base_templates;
DROP POLICY IF EXISTS "Managers can insert base templates" ON base_templates;
DROP POLICY IF EXISTS "Managers can update base templates" ON base_templates;
DROP POLICY IF EXISTS "Managers can delete base templates" ON base_templates;

CREATE POLICY "Users can view accessible base templates" ON base_templates
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert base templates" ON base_templates
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update base templates" ON base_templates
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete base templates" ON base_templates
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- BASE TEMPLATE INGREDIENTS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view base template ingredients" ON base_template_ingredients;
DROP POLICY IF EXISTS "Managers can manage base template ingredients" ON base_template_ingredients;
DROP POLICY IF EXISTS "Users can view accessible base template ingredients" ON base_template_ingredients;
DROP POLICY IF EXISTS "Managers can insert base template ingredients" ON base_template_ingredients;
DROP POLICY IF EXISTS "Managers can update base template ingredients" ON base_template_ingredients;
DROP POLICY IF EXISTS "Managers can delete base template ingredients" ON base_template_ingredients;

CREATE POLICY "Users can view accessible base template ingredients" ON base_template_ingredients
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert base template ingredients" ON base_template_ingredients
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update base template ingredients" ON base_template_ingredients
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete base template ingredients" ON base_template_ingredients
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- OVERHEAD SETTINGS - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view overhead settings" ON overhead_settings;
DROP POLICY IF EXISTS "Managers can manage overhead settings" ON overhead_settings;
DROP POLICY IF EXISTS "Users can view accessible overhead settings" ON overhead_settings;
DROP POLICY IF EXISTS "Managers can insert overhead settings" ON overhead_settings;
DROP POLICY IF EXISTS "Managers can update overhead settings" ON overhead_settings;

CREATE POLICY "Users can view accessible overhead settings" ON overhead_settings
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert overhead settings" ON overhead_settings
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update overhead settings" ON overhead_settings
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- DRINK SIZES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view drink sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Managers can manage drink sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Users can view accessible drink sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Managers can insert drink sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Managers can update drink sizes" ON drink_sizes;
DROP POLICY IF EXISTS "Managers can delete drink sizes" ON drink_sizes;

CREATE POLICY "Users can view accessible drink sizes" ON drink_sizes
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert drink sizes" ON drink_sizes
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update drink sizes" ON drink_sizes
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete drink sizes" ON drink_sizes
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- RECIPE SIZE PRICING - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipe size pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Managers can manage recipe size pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Users can view accessible recipe size pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Managers can insert recipe size pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Managers can update recipe size pricing" ON recipe_size_pricing;
DROP POLICY IF EXISTS "Managers can delete recipe size pricing" ON recipe_size_pricing;

CREATE POLICY "Users can view accessible recipe size pricing" ON recipe_size_pricing
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert recipe size pricing" ON recipe_size_pricing
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update recipe size pricing" ON recipe_size_pricing
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete recipe size pricing" ON recipe_size_pricing
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- RECIPE SIZE BASES - Allow access to accessible tenants
-- =====================================================
DROP POLICY IF EXISTS "Users can view recipe size bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Managers can manage recipe size bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Users can view accessible recipe size bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Managers can insert recipe size bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Managers can update recipe size bases" ON recipe_size_bases;
DROP POLICY IF EXISTS "Managers can delete recipe size bases" ON recipe_size_bases;

CREATE POLICY "Users can view accessible recipe size bases" ON recipe_size_bases
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert recipe size bases" ON recipe_size_bases
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update recipe size bases" ON recipe_size_bases
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete recipe size bases" ON recipe_size_bases
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Multi-location RLS policies updated successfully!
-- 
-- Key changes:
-- - All SELECT policies now use can_access_tenant(tenant_id)
-- - All UPDATE policies include WITH CHECK clauses for security
-- - Owners can view data from all their child locations
-- - Users assigned to multiple locations can access those locations
-- - Write permissions still require appropriate role levels
-- - Recipe costing module tables now support multi-location access
-- 
-- Note: user_tenant_assignments RLS policies are defined in migration 040
-- 
-- Run migration 040 first to create the can_access_tenant() function!
