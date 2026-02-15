-- Calendar Events & iCal Subscriptions
-- Adds community/business events to the scheduling calendar.
-- Events can be created manually or synced from iCal feeds (Apple Calendar, Google, etc.)

-- ============================================================
-- Table: ical_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS ical_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    last_synced_at TIMESTAMPTZ,
    sync_error TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ical_subs_tenant ON ical_subscriptions(tenant_id);

-- ============================================================
-- Table: calendar_events
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location TEXT,
    color TEXT DEFAULT '#3b82f6',
    source TEXT NOT NULL DEFAULT 'manual',
    ical_uid TEXT,
    ical_subscription_id UUID REFERENCES ical_subscriptions(id) ON DELETE CASCADE,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_event_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_cal_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_dates ON calendar_events(start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_events_dedup
    ON calendar_events(ical_subscription_id, ical_uid)
    WHERE ical_uid IS NOT NULL;

-- ============================================================
-- RLS: ical_subscriptions
-- ============================================================
ALTER TABLE ical_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ical subscriptions" ON ical_subscriptions
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Managers can create ical subscriptions" ON ical_subscriptions
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Managers can update ical subscriptions" ON ical_subscriptions
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    ) WITH CHECK (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Managers can delete ical subscriptions" ON ical_subscriptions
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Platform admins manage ical subscriptions" ON ical_subscriptions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- ============================================================
-- RLS: calendar_events
-- ============================================================
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar events" ON calendar_events
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Leads can create calendar events" ON calendar_events
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead'::user_role)
    );

CREATE POLICY "Leads can update calendar events" ON calendar_events
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead'::user_role)
    ) WITH CHECK (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Managers can delete calendar events" ON calendar_events
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Platform admins manage calendar events" ON calendar_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
