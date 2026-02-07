-- =====================================================
-- FIX ATTACHMENT RLS POLICIES FOR MULTI-LOCATION
-- Migrations 062/063 used get_current_tenant_id() which
-- only returns the user's primary tenant. This breaks
-- inserts when operating on a child location.
-- Switch to can_access_tenant() for consistency with
-- migration 041's pattern.
-- =====================================================

-- =====================================================
-- EQUIPMENT ATTACHMENTS
-- =====================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own tenant attachments" ON equipment_attachments;
DROP POLICY IF EXISTS "Users can view accessible equipment attachments" ON equipment_attachments;
CREATE POLICY "Users can view accessible equipment attachments" ON equipment_attachments
    FOR SELECT USING (can_access_tenant(tenant_id));

-- INSERT
DROP POLICY IF EXISTS "All team members can insert attachments" ON equipment_attachments;
CREATE POLICY "All team members can insert equipment attachments" ON equipment_attachments
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

-- UPDATE
DROP POLICY IF EXISTS "All team members can update attachments" ON equipment_attachments;
CREATE POLICY "All team members can update equipment attachments" ON equipment_attachments
    FOR UPDATE USING (can_access_tenant(tenant_id))
    WITH CHECK (can_access_tenant(tenant_id));

-- DELETE
DROP POLICY IF EXISTS "Managers+ can delete attachments" ON equipment_attachments;
CREATE POLICY "Managers+ can delete equipment attachments" ON equipment_attachments
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- =====================================================
-- MAINTENANCE TASK ATTACHMENTS
-- =====================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own tenant task attachments" ON maintenance_task_attachments;
DROP POLICY IF EXISTS "Users can view accessible task attachments" ON maintenance_task_attachments;
CREATE POLICY "Users can view accessible task attachments" ON maintenance_task_attachments
    FOR SELECT USING (can_access_tenant(tenant_id));

-- INSERT
DROP POLICY IF EXISTS "All team members can insert task attachments" ON maintenance_task_attachments;
CREATE POLICY "All team members can insert task attachments" ON maintenance_task_attachments
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

-- UPDATE
DROP POLICY IF EXISTS "All team members can update task attachments" ON maintenance_task_attachments;
CREATE POLICY "All team members can update task attachments" ON maintenance_task_attachments
    FOR UPDATE USING (can_access_tenant(tenant_id))
    WITH CHECK (can_access_tenant(tenant_id));

-- DELETE
DROP POLICY IF EXISTS "Managers+ can delete task attachments" ON maintenance_task_attachments;
CREATE POLICY "Managers+ can delete task attachments" ON maintenance_task_attachments
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );
