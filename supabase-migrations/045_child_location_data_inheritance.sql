-- =====================================================
-- CHILD LOCATION DATA INHERITANCE
-- Run this AFTER 044_child_location_module_inheritance.sql
-- 
-- Updates RLS policies so child locations can READ
-- parent tenant's shared data (ingredients, recipes, 
-- vendors, products, etc.)
-- =====================================================

-- Helper function to get the parent tenant ID for any tenant
CREATE OR REPLACE FUNCTION get_parent_tenant_id(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    parent_id UUID;
BEGIN
    SELECT parent_tenant_id INTO parent_id
    FROM tenants
    WHERE id = p_tenant_id;
    
    RETURN parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to check if current user can access data from a tenant
-- (including parent tenant data for child locations)
CREATE OR REPLACE FUNCTION can_read_tenant_data(data_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_tenant UUID;
    user_parent UUID;
BEGIN
    -- Get current user's tenant
    SELECT tenant_id INTO user_tenant
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Direct match - user is in the same tenant as the data
    IF data_tenant_id = user_tenant THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is in a child location and the data is from their parent
    SELECT parent_tenant_id INTO user_parent
    FROM tenants
    WHERE id = user_tenant;
    
    IF user_parent IS NOT NULL AND data_tenant_id = user_parent THEN
        RETURN TRUE;
    END IF;
    
    -- Also check if user has general access (owner with multi-location access)
    RETURN can_access_tenant(data_tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- INGREDIENTS - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible ingredients" ON ingredients;
CREATE POLICY "Users can view accessible ingredients" ON ingredients
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- INGREDIENT CATEGORIES - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible ingredient categories" ON ingredient_categories;
CREATE POLICY "Users can view accessible ingredient categories" ON ingredient_categories
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- PRODUCT CATEGORIES - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible product categories" ON product_categories;
CREATE POLICY "Users can view accessible product categories" ON product_categories
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- RECIPES - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible recipes" ON recipes;
CREATE POLICY "Users can view accessible recipes" ON recipes
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- BASE TEMPLATES - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible base templates" ON base_templates;
CREATE POLICY "Users can view accessible base templates" ON base_templates
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- TENANT COFFEE VENDORS - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible coffee vendors" ON tenant_coffee_vendors;
CREATE POLICY "Users can view accessible coffee vendors" ON tenant_coffee_vendors
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- TENANT COFFEE PRODUCTS - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible coffee products" ON tenant_coffee_products;
CREATE POLICY "Users can view accessible coffee products" ON tenant_coffee_products
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- EQUIPMENT - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible equipment" ON equipment;
CREATE POLICY "Users can view accessible equipment" ON equipment
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- MAINTENANCE TASKS - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible maintenance tasks" ON maintenance_tasks;
CREATE POLICY "Users can view accessible maintenance tasks" ON maintenance_tasks
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- TIP EMPLOYEES - Allow child locations to read parent data
-- (useful for shared employee pools)
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible tip employees" ON tip_employees;
CREATE POLICY "Users can view accessible tip employees" ON tip_employees
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- ADMIN TASK CATEGORIES - Allow child locations to read parent data
-- =====================================================
DROP POLICY IF EXISTS "Users can view accessible task categories" ON admin_task_categories;
CREATE POLICY "Users can view accessible task categories" ON admin_task_categories
    FOR SELECT USING (can_read_tenant_data(tenant_id));
