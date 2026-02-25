-- Device tokens for push notifications (mobile app)
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'unknown',
    device_name TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_device_token UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_tenant ON device_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = true;

-- Row-Level Security
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own device tokens
CREATE POLICY "Users can view own device tokens" ON device_tokens
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own device tokens" ON device_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own device tokens" ON device_tokens
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own device tokens" ON device_tokens
    FOR DELETE USING (user_id = auth.uid());

-- Managers can read tokens for their tenant (needed for sending notifications)
CREATE POLICY "Tenant members can read tenant device tokens" ON device_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.tenant_id = device_tokens.tenant_id
              AND user_profiles.role IN ('owner', 'manager')
              AND user_profiles.is_active = true
        )
    );

-- Platform admins have full access
CREATE POLICY "Platform admins manage device tokens" ON device_tokens
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
