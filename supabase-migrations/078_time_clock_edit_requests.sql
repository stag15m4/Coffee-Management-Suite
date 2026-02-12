-- =====================================================
-- TIME CLOCK EDIT REQUESTS
-- Employees can request edits to their time clock entries.
-- Edits require manager/lead approval before taking effect.
-- =====================================================

CREATE TABLE IF NOT EXISTS time_clock_edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    time_clock_entry_id UUID NOT NULL REFERENCES time_clock_entries(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    original_clock_in TIMESTAMPTZ NOT NULL,
    original_clock_out TIMESTAMPTZ,
    requested_clock_in TIMESTAMPTZ,
    requested_clock_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status time_off_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_edit_req_tenant ON time_clock_edit_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tc_edit_req_employee ON time_clock_edit_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_tc_edit_req_status ON time_clock_edit_requests(status);
CREATE INDEX IF NOT EXISTS idx_tc_edit_req_entry ON time_clock_edit_requests(time_clock_entry_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE time_clock_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view time clock edit requests" ON time_clock_edit_requests
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Employees can request edits for own entries" ON time_clock_edit_requests
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND employee_id = auth.uid()
    );

CREATE POLICY "Employees and leads can update edit requests" ON time_clock_edit_requests
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND (
            employee_id = auth.uid()
            OR has_role_or_higher('lead'::user_role)
        )
    ) WITH CHECK (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Employees can delete own pending, managers can delete any" ON time_clock_edit_requests
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND (
            (employee_id = auth.uid() AND status = 'pending')
            OR has_role_or_higher('manager'::user_role)
        )
    );

CREATE POLICY "Platform admins manage time clock edit requests" ON time_clock_edit_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
