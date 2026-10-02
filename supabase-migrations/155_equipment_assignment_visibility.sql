-- Migration 155: Equipment assignment-based visibility, and closing a
-- long-standing write bypass on equipment/maintenance_tasks.
--
-- Background: migration 013 created "All team members can update equipment"
-- and "All team members can update tasks" (any role, tenant-wide). Migration
-- 041 later added manager-only "Managers can update equipment"/"...tasks"
-- policies, intending to restrict edits to managers+, but never dropped the
-- 013 policies. PostgreSQL ORs multiple permissive policies together, so the
-- old any-role policy has been silently defeating the manager-only one ever
-- since (the same bug class migration 117 fixed for a different set of
-- leftover policies). This migration closes that gap.
--
-- It also adds the assignment-based visibility requested for personal
-- equipment (e.g. a vehicle or lawn mower assigned to one employee via
-- equipment.assigned_to, added in migration 135): unassigned ("shop") items
-- stay visible/editable by everyone, same as today; an assigned item is
-- visible/editable only by its assignee or a manager+. The same rule is
-- mirrored onto maintenance_tasks and maintenance_logs (via their equipment
-- link) for SELECT, so a restricted vehicle's tasks/logs are equally hidden.
-- Prerequisite: migration 135 (equipment.assigned_to).

-- ---------------------------------------------------------------------------
-- EQUIPMENT
-- ---------------------------------------------------------------------------

-- Drop the never-cleaned-up any-role leftovers from migration 013.
DROP POLICY IF EXISTS "Users can view own tenant equipment" ON equipment;
DROP POLICY IF EXISTS "All team members can update equipment" ON equipment;

-- Replace the current SELECT policy (migration 045) with the assignment rule.
DROP POLICY IF EXISTS "Users can view accessible equipment" ON equipment;
CREATE POLICY "Users can view accessible equipment" ON equipment
    FOR SELECT USING (
        can_read_tenant_data(tenant_id)
        AND (
            assigned_to IS NULL
            OR assigned_to = auth.uid()
            OR has_role_or_higher('manager'::user_role)
        )
    );

-- Replace the manager-only UPDATE policy (migration 041) so the assignee can
-- still log their own equipment's upkeep (e.g. mileage), matching today's
-- behavior for unassigned/shop equipment.
DROP POLICY IF EXISTS "Managers can update equipment" ON equipment;
CREATE POLICY "Users can update accessible equipment" ON equipment
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND (
            assigned_to IS NULL
            OR assigned_to = auth.uid()
            OR has_role_or_higher('manager'::user_role)
        )
    )
    WITH CHECK (
        can_access_tenant(tenant_id)
        AND (
            assigned_to IS NULL
            OR assigned_to = auth.uid()
            OR has_role_or_higher('manager'::user_role)
        )
    );

-- ---------------------------------------------------------------------------
-- MAINTENANCE TASKS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own tenant tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "All team members can update tasks" ON maintenance_tasks;

DROP POLICY IF EXISTS "Users can view accessible maintenance tasks" ON maintenance_tasks;
CREATE POLICY "Users can view accessible maintenance tasks" ON maintenance_tasks
    FOR SELECT USING (
        can_read_tenant_data(tenant_id)
        AND EXISTS (
            SELECT 1 FROM equipment e
            WHERE e.id = maintenance_tasks.equipment_id
            AND (
                e.assigned_to IS NULL
                OR e.assigned_to = auth.uid()
                OR has_role_or_higher('manager'::user_role)
            )
        )
    );

DROP POLICY IF EXISTS "Managers can update maintenance tasks" ON maintenance_tasks;
CREATE POLICY "Users can update accessible maintenance tasks" ON maintenance_tasks
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND EXISTS (
            SELECT 1 FROM equipment e
            WHERE e.id = maintenance_tasks.equipment_id
            AND (
                e.assigned_to IS NULL
                OR e.assigned_to = auth.uid()
                OR has_role_or_higher('manager'::user_role)
            )
        )
    )
    WITH CHECK (
        can_access_tenant(tenant_id)
        AND EXISTS (
            SELECT 1 FROM equipment e
            WHERE e.id = maintenance_tasks.equipment_id
            AND (
                e.assigned_to IS NULL
                OR e.assigned_to = auth.uid()
                OR has_role_or_higher('manager'::user_role)
            )
        )
    );

-- ---------------------------------------------------------------------------
-- MAINTENANCE LOGS
-- SELECT only: no manager-only write policy was ever added for logs (the
-- all-team UPDATE/INSERT policies are intentional, not a bypass), so only
-- the leftover any-role SELECT policy and the visibility rule change here.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own tenant logs" ON maintenance_logs;

DROP POLICY IF EXISTS "Users can view accessible maintenance logs" ON maintenance_logs;
CREATE POLICY "Users can view accessible maintenance logs" ON maintenance_logs
    FOR SELECT USING (
        can_access_tenant(tenant_id)
        AND EXISTS (
            SELECT 1 FROM maintenance_tasks mt
            JOIN equipment e ON e.id = mt.equipment_id
            WHERE mt.id = maintenance_logs.task_id
            AND (
                e.assigned_to IS NULL
                OR e.assigned_to = auth.uid()
                OR has_role_or_higher('manager'::user_role)
            )
        )
    );
