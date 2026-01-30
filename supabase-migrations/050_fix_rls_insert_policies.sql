-- =====================================================
-- FIX RLS INSERT POLICIES FOR SECURITY
-- Addresses Supabase security warning about overly permissive INSERT policies
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- EQUIPMENT INSERT POLICY
-- Ensures tenant_id matches user's tenant
-- =====================================================
DROP POLICY IF EXISTS "All team members can insert equipment" ON equipment;
CREATE POLICY "All team members can insert equipment" ON equipment
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
            UNION
            SELECT id FROM tenants WHERE parent_tenant_id = (
                SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
            )
        )
    );

-- =====================================================
-- MAINTENANCE TASKS INSERT POLICY
-- Ensures the equipment belongs to user's tenant
-- =====================================================
DROP POLICY IF EXISTS "All team members can insert tasks" ON maintenance_tasks;
CREATE POLICY "All team members can insert tasks" ON maintenance_tasks
    FOR INSERT WITH CHECK (
        equipment_id IN (
            SELECT id FROM equipment WHERE tenant_id IN (
                SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
                UNION
                SELECT id FROM tenants WHERE parent_tenant_id = (
                    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
                )
            )
        )
    );

-- =====================================================
-- MAINTENANCE LOGS INSERT POLICY
-- Ensures the task belongs to equipment in user's tenant
-- =====================================================
DROP POLICY IF EXISTS "All team members can insert logs" ON maintenance_logs;
CREATE POLICY "All team members can insert logs" ON maintenance_logs
    FOR INSERT WITH CHECK (
        task_id IN (
            SELECT mt.id FROM maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            WHERE e.tenant_id IN (
                SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
                UNION
                SELECT id FROM tenants WHERE parent_tenant_id = (
                    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
                )
            )
        )
    );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- RLS INSERT policies now verify that data belongs to user's tenant
-- This prevents cross-tenant data insertion
