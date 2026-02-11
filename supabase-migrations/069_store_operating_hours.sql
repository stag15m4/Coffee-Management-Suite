-- Store operating hours per tenant/location
-- Each location can set open/close times for each day of the week

CREATE TABLE IF NOT EXISTS store_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_day UNIQUE (tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_store_hours_tenant ON store_operating_hours(tenant_id);

ALTER TABLE store_operating_hours ENABLE ROW LEVEL SECURITY;

-- Read: any user who can read tenant data
CREATE POLICY "Users can view store hours" ON store_operating_hours
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- Insert: managers and above
CREATE POLICY "Managers can create store hours" ON store_operating_hours
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

-- Update: managers and above
CREATE POLICY "Managers can update store hours" ON store_operating_hours
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    ) WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

-- Delete: managers and above
CREATE POLICY "Managers can delete store hours" ON store_operating_hours
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

-- Platform admins can manage all
CREATE POLICY "Platform admins manage store hours" ON store_operating_hours
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
