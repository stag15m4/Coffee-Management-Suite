-- ============================================================================
-- 098: Square Integration
-- Adds Square OAuth fields to tenants, employee mapping table,
-- and source tracking on time_clock_entries/breaks.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1A. Square OAuth columns on tenants
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_merchant_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_access_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_refresh_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_token_expires_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_location_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_last_sync_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_square_merchant
  ON tenants(square_merchant_id) WHERE square_merchant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1B. Employee mapping table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS square_employee_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    square_team_member_id TEXT NOT NULL,
    square_team_member_name TEXT NOT NULL,
    user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    tip_employee_id UUID REFERENCES tip_employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'suggested',
    confirmed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_square_mapping UNIQUE (tenant_id, square_team_member_id),
    CONSTRAINT chk_square_mapping_status CHECK (status IN ('suggested', 'confirmed', 'ignored')),
    CONSTRAINT chk_square_mapping_employee CHECK (
        status != 'confirmed'
        OR user_profile_id IS NOT NULL
        OR tip_employee_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_sq_map_tenant ON square_employee_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sq_map_team_member ON square_employee_mappings(square_team_member_id);

-- RLS
ALTER TABLE square_employee_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view square mappings" ON square_employee_mappings
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert square mappings" ON square_employee_mappings
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update square mappings" ON square_employee_mappings
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete square mappings" ON square_employee_mappings
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Platform admins manage square mappings" ON square_employee_mappings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- ---------------------------------------------------------------------------
-- 1C. Source tracking on time_clock_entries and time_clock_breaks
-- ---------------------------------------------------------------------------
ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tce_external_id
    ON time_clock_entries(tenant_id, external_id)
    WHERE external_id IS NOT NULL;

ALTER TABLE time_clock_breaks ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tcb_external_id
    ON time_clock_breaks(tenant_id, external_id)
    WHERE external_id IS NOT NULL;
