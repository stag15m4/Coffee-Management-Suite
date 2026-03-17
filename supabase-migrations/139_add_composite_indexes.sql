-- Migration 139: Add composite indexes for common multi-tenant query patterns
-- These indexes accelerate the most frequent filter combinations observed in
-- client-side Supabase queries (tenant_id + secondary filter columns).
-- Using IF NOT EXISTS so the migration is safe to re-run.

-----------------------------------------------------------------------
-- time_clock_entries
-----------------------------------------------------------------------
-- Per-employee time lookups: tenant + employee + clock_in range scans
-- (tenant_id, clock_in) already covered by idx_time_clock_tenant_date
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_tenant_employee_clockin
    ON time_clock_entries (tenant_id, employee_id, clock_in);

-----------------------------------------------------------------------
-- user_profiles
-----------------------------------------------------------------------
-- Active-user listings (extremely common across many pages/hooks)
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_is_active
    ON user_profiles (tenant_id, is_active);

-- Role-filtered user queries (admin-users page, role checks)
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role
    ON user_profiles (tenant_id, role);

-----------------------------------------------------------------------
-- equipment
-----------------------------------------------------------------------
-- Equipment filtered by status (operational, needs_repair, etc.)
CREATE INDEX IF NOT EXISTS idx_equipment_tenant_status
    ON equipment (tenant_id, status);

-----------------------------------------------------------------------
-- admin_tasks
-----------------------------------------------------------------------
-- Task list filtered by tenant + status (most common task query)
CREATE INDEX IF NOT EXISTS idx_admin_tasks_tenant_status
    ON admin_tasks (tenant_id, status);

-- Task list ordered by created_at within a tenant
CREATE INDEX IF NOT EXISTS idx_admin_tasks_tenant_created_at
    ON admin_tasks (tenant_id, created_at DESC);

-----------------------------------------------------------------------
-- tip_weekly_data
-----------------------------------------------------------------------
-- Tip history lookups by tenant + week (the primary tip query pattern)
CREATE INDEX IF NOT EXISTS idx_tip_weekly_data_tenant_week_key
    ON tip_weekly_data (tenant_id, week_key);

-----------------------------------------------------------------------
-- cash_activity
-----------------------------------------------------------------------
-- Cash drawer queries filtered by tenant + date
CREATE INDEX IF NOT EXISTS idx_cash_activity_tenant_drawer_date
    ON cash_activity (tenant_id, drawer_date);

-----------------------------------------------------------------------
-- shifts
-----------------------------------------------------------------------
-- Per-employee shift lookups within a date range
-- (tenant_id, date) already covered by idx_shifts_tenant_date
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_employee_date
    ON shifts (tenant_id, employee_id, date);

-----------------------------------------------------------------------
-- time_off_requests
-----------------------------------------------------------------------
-- Time-off filtered by tenant + employee + status
CREATE INDEX IF NOT EXISTS idx_time_off_requests_tenant_employee_status
    ON time_off_requests (tenant_id, employee_id, status);

-----------------------------------------------------------------------
-- time_clock_edit_requests
-----------------------------------------------------------------------
-- Edit requests filtered by tenant + status (approval workflows)
CREATE INDEX IF NOT EXISTS idx_time_clock_edit_requests_tenant_status
    ON time_clock_edit_requests (tenant_id, status);

-----------------------------------------------------------------------
-- timesheet_approvals
-----------------------------------------------------------------------
-- Approval lookups by tenant + employee + status
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_tenant_employee_status
    ON timesheet_approvals (tenant_id, employee_id, status);

-----------------------------------------------------------------------
-- user_tenant_assignments
-----------------------------------------------------------------------
-- Assignment lookups by user + active status (AuthContext hot path)
CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_user_active
    ON user_tenant_assignments (user_id, is_active);
