-- ============================================================================
-- 146: Connecteam Integration (phase 1: timeclock -> tip hours sync)
-- API key lives in a service-only table (RLS enabled, NO policies — only the
-- server's direct connection can read it; never exposed to the client).
-- Mirrors the Square integration pattern (098) for mappings and sync flags.
-- ============================================================================

-- Sync flags on tenants (safe to expose to client)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS connecteam_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS connecteam_last_sync_at TIMESTAMPTZ;

-- Server-only credentials
CREATE TABLE IF NOT EXISTS connecteam_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    time_clock_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on with no policies: anon/authenticated clients can never read the key
ALTER TABLE connecteam_settings ENABLE ROW LEVEL SECURITY;

-- Employee mapping: Connecteam user -> CMS tip employee
CREATE TABLE IF NOT EXISTS connecteam_employee_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connecteam_user_id TEXT NOT NULL,
    connecteam_user_name TEXT NOT NULL,
    tip_employee_id UUID REFERENCES tip_employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'suggested',
    confirmed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_connecteam_mapping UNIQUE (tenant_id, connecteam_user_id),
    CONSTRAINT chk_ct_mapping_status CHECK (status IN ('suggested', 'confirmed', 'ignored')),
    CONSTRAINT chk_ct_mapping_employee CHECK (status != 'confirmed' OR tip_employee_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ct_map_tenant ON connecteam_employee_mappings(tenant_id);

ALTER TABLE connecteam_employee_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view connecteam mappings" ON connecteam_employee_mappings
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "Managers can insert connecteam mappings" ON connecteam_employee_mappings
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "Managers can update connecteam mappings" ON connecteam_employee_mappings
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "Managers can delete connecteam mappings" ON connecteam_employee_mappings
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
