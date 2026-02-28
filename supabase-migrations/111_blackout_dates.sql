-- Migration 111: Blackout Dates
-- Allows owners/managers to designate "all hands on deck" days
-- where time off requests are discouraged.

CREATE TABLE IF NOT EXISTS blackout_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    label TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_blackout_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_blackout_tenant ON blackout_dates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blackout_dates ON blackout_dates(start_date, end_date);

ALTER TABLE blackout_dates ENABLE ROW LEVEL SECURITY;

-- All tenant members can view blackout dates
CREATE POLICY "tenant_view_blackouts" ON blackout_dates
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenant_assignments WHERE user_id = auth.uid()
        )
    );

-- Only owners & managers can create blackout dates
CREATE POLICY "managers_insert_blackouts" ON blackout_dates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenant_assignments
            WHERE user_id = auth.uid()
            AND tenant_id = blackout_dates.tenant_id
            AND role IN ('owner', 'manager')
        )
    );

-- Only owners & managers can delete blackout dates
CREATE POLICY "managers_delete_blackouts" ON blackout_dates
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_tenant_assignments
            WHERE user_id = auth.uid()
            AND tenant_id = blackout_dates.tenant_id
            AND role IN ('owner', 'manager')
        )
    );

-- Platform admins bypass all RLS
CREATE POLICY "platform_admin_blackouts" ON blackout_dates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
