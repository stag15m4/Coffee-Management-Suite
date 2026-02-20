-- =====================================================
-- MODULE USAGE ANALYTICS
-- Adds INSERT policy so client-side tracking works,
-- and indexes for efficient module_visit queries
-- =====================================================

-- Allow authenticated users to insert activity logs for their own tenant
CREATE POLICY "Users can insert activity for own tenant" ON tenant_activity_log
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Index for module_visit action queries
CREATE INDEX IF NOT EXISTS idx_tenant_activity_log_module_visit
    ON tenant_activity_log(action, created_at DESC)
    WHERE action = 'module_visit';

-- Index for per-tenant activity lookups
CREATE INDEX IF NOT EXISTS idx_tenant_activity_log_tenant_action
    ON tenant_activity_log(tenant_id, action, created_at DESC);
