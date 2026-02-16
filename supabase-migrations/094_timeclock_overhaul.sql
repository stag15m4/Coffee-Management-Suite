-- 094: Time Clock Overhaul — pay period config, timesheet approvals, extended columns
-- Supports Connecteam-style timesheets with pay period navigation, approval workflow,
-- scheduled vs actual comparison, and enhanced break tracking.

-- ─── 1A. Pay period configuration on tenants ────────────────────────────

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pay_period_type TEXT DEFAULT 'biweekly';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pay_period_anchor_date DATE DEFAULT '2026-01-05';

DO $$ BEGIN
    ALTER TABLE tenants ADD CONSTRAINT chk_pay_period_type
        CHECK (pay_period_type IN ('weekly', 'biweekly', 'semi_monthly', 'monthly'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── 1B. Timesheet approvals table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS timesheet_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    manager_notes TEXT,
    employee_notes TEXT,
    total_regular_hours DECIMAL(8,2),
    total_break_hours DECIMAL(8,2),
    total_pto_hours DECIMAL(8,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ts_approval_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT uq_ts_approval UNIQUE (tenant_id, employee_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_ts_approval_tenant ON timesheet_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ts_approval_employee ON timesheet_approvals(employee_id);
CREATE INDEX IF NOT EXISTS idx_ts_approval_period ON timesheet_approvals(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_ts_approval_status ON timesheet_approvals(status);

-- RLS policies
ALTER TABLE timesheet_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view timesheet approvals" ON timesheet_approvals
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Leads and managers can create timesheet approvals" ON timesheet_approvals
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Leads and managers can update timesheet approvals" ON timesheet_approvals
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead')
    ) WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Managers can delete timesheet approvals" ON timesheet_approvals
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Platform admins manage timesheet approvals" ON timesheet_approvals
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- ─── 1C. Extend time_clock_entries ──────────────────────────────────────

ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS employee_notes TEXT;
ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS manager_notes TEXT;

-- ─── 1D. Extend time_clock_breaks ──────────────────────────────────────

ALTER TABLE time_clock_breaks ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- ─── 1E. New permission: approve_timesheets ────────────────────────────

ALTER TABLE tenant_role_settings ADD COLUMN IF NOT EXISTS approve_timesheets BOOLEAN DEFAULT false;

-- Default: owners and managers can approve timesheets
UPDATE tenant_role_settings SET approve_timesheets = true WHERE role IN ('owner', 'manager');
