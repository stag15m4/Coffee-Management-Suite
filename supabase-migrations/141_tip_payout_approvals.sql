-- 141: Tip Payout Approvals — server-validated payout records with audit trail
-- Addresses CFS-007: tip payouts must be server-validated before final approval

CREATE TABLE IF NOT EXISTS tip_payout_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    week_key DATE NOT NULL,

    -- Snapshot of the calculation inputs
    cash_tips DECIMAL(10,2) NOT NULL,
    cc_tips DECIMAL(10,2) NOT NULL,
    cc_fee_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0350,
    total_pool DECIMAL(10,2) NOT NULL,
    total_hours DECIMAL(8,2) NOT NULL,
    hourly_rate DECIMAL(10,4) NOT NULL,
    distribution_method TEXT NOT NULL DEFAULT 'hours',

    -- Per-employee breakdown stored as JSONB array
    -- Each entry: { employee_id, employee_name, hours, payout }
    employee_payouts JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Approval metadata
    calculated_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tip_approval_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_positive_pool CHECK (total_pool >= 0),
    CONSTRAINT chk_distribution_method CHECK (distribution_method IN ('hours', 'equal', 'points'))
);

CREATE INDEX IF NOT EXISTS idx_tip_payout_approvals_tenant ON tip_payout_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tip_payout_approvals_week ON tip_payout_approvals(week_key);
CREATE INDEX IF NOT EXISTS idx_tip_payout_approvals_status ON tip_payout_approvals(status);

-- RLS
ALTER TABLE tip_payout_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tip payout approvals" ON tip_payout_approvals
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Leads can create tip payout approvals" ON tip_payout_approvals
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Managers can update tip payout approvals" ON tip_payout_approvals
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    ) WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete tip payout approvals" ON tip_payout_approvals
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Platform admins manage tip payout approvals" ON tip_payout_approvals
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
