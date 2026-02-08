-- Fix tenant admin tables RLS to use can_access_tenant() / can_read_tenant_data()
-- instead of direct user_profiles.tenant_id checks, matching the pattern used
-- by all other tables since migration 041.

-- =====================================================
-- TENANT_USAGE_METRICS
-- =====================================================
DROP POLICY IF EXISTS "Tenants can view own metrics" ON tenant_usage_metrics;
CREATE POLICY "Users can view accessible tenant metrics" ON tenant_usage_metrics
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- TENANT_ACTIVITY_LOG
-- =====================================================
DROP POLICY IF EXISTS "Tenants can view own activity" ON tenant_activity_log;
CREATE POLICY "Users can view accessible tenant activity" ON tenant_activity_log
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- TENANT_MODULE_SUBSCRIPTIONS
-- =====================================================
DROP POLICY IF EXISTS "Tenants can read own module subscriptions" ON tenant_module_subscriptions;
CREATE POLICY "Users can view accessible module subscriptions" ON tenant_module_subscriptions
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- =====================================================
-- TENANT_MODULE_OVERRIDES
-- =====================================================
DROP POLICY IF EXISTS "Tenants can read own module overrides" ON tenant_module_overrides;
CREATE POLICY "Users can view accessible module overrides" ON tenant_module_overrides
    FOR SELECT USING (can_read_tenant_data(tenant_id));
