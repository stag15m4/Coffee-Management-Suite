-- Fix overhead_items RLS policies to use can_access_tenant() and can_read_tenant_data()
-- instead of direct user_profiles.tenant_id checks.
-- This aligns with how other tables (recipes, overhead_settings, etc.) handle
-- multi-tenant access via user_tenant_assignments.

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their tenant overhead items" ON overhead_items;
DROP POLICY IF EXISTS "Users can insert overhead items for their tenant" ON overhead_items;
DROP POLICY IF EXISTS "Users can update their tenant overhead items" ON overhead_items;
DROP POLICY IF EXISTS "Users can delete their tenant overhead items" ON overhead_items;

-- Recreate with can_access_tenant / can_read_tenant_data
CREATE POLICY "Users can view accessible overhead items" ON overhead_items
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Managers can insert overhead items" ON overhead_items
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can update overhead items" ON overhead_items
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

CREATE POLICY "Managers can delete overhead items" ON overhead_items
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));
