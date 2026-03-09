-- Migration 126: Fix overhead_items RLS policies
-- Original policies allowed any employee to INSERT/UPDATE/DELETE overhead cost
-- items. Financial data should require manager+ role. Also adds multi-location
-- support via can_access_tenant().

DROP POLICY IF EXISTS "Users can view their tenant overhead items" ON overhead_items;
DROP POLICY IF EXISTS "Users can insert overhead items for their tenant" ON overhead_items;
DROP POLICY IF EXISTS "Users can update their tenant overhead items" ON overhead_items;
DROP POLICY IF EXISTS "Users can delete their tenant overhead items" ON overhead_items;

-- SELECT: all tenant members can view (including child locations)
CREATE POLICY "Users can view their tenant overhead items" ON overhead_items
    FOR SELECT USING (can_access_tenant(tenant_id));

-- INSERT: managers+ only
CREATE POLICY "Users can insert overhead items for their tenant" ON overhead_items
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- UPDATE: managers+ only
CREATE POLICY "Users can update their tenant overhead items" ON overhead_items
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- DELETE: managers+ only
CREATE POLICY "Users can delete their tenant overhead items" ON overhead_items
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- Platform admin bypass
CREATE POLICY "Platform admins manage all overhead items" ON overhead_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
