-- Fix recipe_vendors RLS policies to support multi-location access.
-- The old policies (migration 077) used user_profiles.tenant_id which only
-- matches the user's primary tenant. This broke vendor profiles when viewing
-- a child location like "Coffee on Broad" under parent "Pompeii Pizza".
--
-- All other tables already use can_access_tenant() (migration 041).

DROP POLICY IF EXISTS "Tenants can view their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can insert their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can update their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can delete their own vendors" ON recipe_vendors;

CREATE POLICY "Users can view accessible recipe vendors" ON recipe_vendors
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert recipe vendors" ON recipe_vendors
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update recipe vendors" ON recipe_vendors
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete recipe vendors" ON recipe_vendors
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));
