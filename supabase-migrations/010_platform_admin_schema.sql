-- =====================================================
-- PLATFORM ADMIN SCHEMA
-- Adds superuser functionality for SaaS management
-- =====================================================

-- Platform Admins table - separate from tenant users
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Tenant usage metrics - aggregated stats per tenant
CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    recipe_count INTEGER DEFAULT 0,
    tip_entries_count INTEGER DEFAULT 0,
    cash_deposits_count INTEGER DEFAULT 0,
    coffee_orders_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, metric_date)
);

-- Tenant activity log - track major events
CREATE TABLE IF NOT EXISTS tenant_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add subscription fields to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basic';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days');
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_usage_metrics_tenant_date 
    ON tenant_usage_metrics(tenant_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_tenant_activity_log_tenant 
    ON tenant_activity_log(tenant_id, created_at DESC);

-- =====================================================
-- RLS POLICIES FOR PLATFORM ADMINS
-- =====================================================

-- Helper function to check if current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM platform_admins 
        WHERE id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for platform_admins
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read own record" ON platform_admins
    FOR SELECT USING (id = auth.uid());

-- =====================================================
-- GRANT PLATFORM ADMINS ACCESS TO TENANTS
-- =====================================================

-- Platform admins can read all tenants
CREATE POLICY "Platform admins can read all tenants" ON tenants
    FOR SELECT USING (is_platform_admin());

-- Platform admins can insert tenants
CREATE POLICY "Platform admins can insert tenants" ON tenants
    FOR INSERT WITH CHECK (is_platform_admin());

-- Platform admins can update tenants
CREATE POLICY "Platform admins can update tenants" ON tenants
    FOR UPDATE USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- GRANT PLATFORM ADMINS ACCESS TO TENANT_BRANDING
-- =====================================================

CREATE POLICY "Platform admins can read all branding" ON tenant_branding
    FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can insert branding" ON tenant_branding
    FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update branding" ON tenant_branding
    FOR UPDATE USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- GRANT PLATFORM ADMINS ACCESS TO USER_PROFILES
-- =====================================================

CREATE POLICY "Platform admins can read all profiles" ON user_profiles
    FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admins can insert profiles" ON user_profiles
    FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins can update profiles" ON user_profiles
    FOR UPDATE USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- RLS FOR NEW TABLES
-- =====================================================

-- RLS for tenant_usage_metrics
ALTER TABLE tenant_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own metrics" ON tenant_usage_metrics
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Platform admins can manage all metrics" ON tenant_usage_metrics
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- RLS for tenant_activity_log
ALTER TABLE tenant_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own activity" ON tenant_activity_log
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Platform admins can manage all activity" ON tenant_activity_log
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- SUCCESS
-- Platform admin schema created!
-- Run this in Supabase SQL editor
-- =====================================================
