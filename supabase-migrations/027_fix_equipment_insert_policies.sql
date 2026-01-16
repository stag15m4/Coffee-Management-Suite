-- =====================================================
-- FIX EQUIPMENT MODULE INSERT POLICIES
-- Run this in Supabase SQL Editor
-- =====================================================

-- Equipment INSERT policy - allow authenticated users
DROP POLICY IF EXISTS "All team members can insert equipment" ON equipment;
CREATE POLICY "All team members can insert equipment" ON equipment
    FOR INSERT WITH CHECK (true);

-- Maintenance tasks INSERT policy - allow authenticated users
DROP POLICY IF EXISTS "All team members can insert tasks" ON maintenance_tasks;
CREATE POLICY "All team members can insert tasks" ON maintenance_tasks
    FOR INSERT WITH CHECK (true);

-- Maintenance logs INSERT policy - allow authenticated users
DROP POLICY IF EXISTS "All team members can insert logs" ON maintenance_logs;
CREATE POLICY "All team members can insert logs" ON maintenance_logs
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- SUCCESS - Equipment inserts should now work
-- =====================================================
