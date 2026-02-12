-- =====================================================
-- ROLE PERMISSIONS, MANAGER HIERARCHY & COMPENSATION
-- Customizable per-role permissions, manager assignment
-- for approval routing, and exempt/salary tracking.
-- =====================================================

-- 1. Tenant Role Settings (one row per role per tenant)
CREATE TABLE IF NOT EXISTS tenant_role_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    display_name TEXT NOT NULL,

    -- Permission flags
    approve_time_off BOOLEAN NOT NULL DEFAULT false,
    approve_time_edits BOOLEAN NOT NULL DEFAULT false,
    manage_shifts BOOLEAN NOT NULL DEFAULT false,
    delete_shifts BOOLEAN NOT NULL DEFAULT false,
    manage_recipes BOOLEAN NOT NULL DEFAULT false,
    manage_users BOOLEAN NOT NULL DEFAULT false,
    view_reports BOOLEAN NOT NULL DEFAULT false,
    export_payroll BOOLEAN NOT NULL DEFAULT false,
    manage_equipment BOOLEAN NOT NULL DEFAULT false,
    manage_tasks BOOLEAN NOT NULL DEFAULT false,
    manage_orders BOOLEAN NOT NULL DEFAULT false,
    manage_branding BOOLEAN NOT NULL DEFAULT false,
    manage_locations BOOLEAN NOT NULL DEFAULT false,
    manage_cash_deposits BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_tenant_role_settings_tenant ON tenant_role_settings(tenant_id);

-- 2. Add manager_id to user_profiles (primary/default manager)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager ON user_profiles(manager_id);

-- 3. Add manager_id to user_tenant_assignments (location-level override)
ALTER TABLE user_tenant_assignments ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_uta_manager ON user_tenant_assignments(manager_id);

-- 4. Add compensation columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS annual_salary DECIMAL(10,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pay_frequency TEXT DEFAULT 'biweekly';

-- Add check constraint for pay_frequency (safe for existing rows since default is valid)
DO $$ BEGIN
    ALTER TABLE user_profiles ADD CONSTRAINT chk_pay_frequency
        CHECK (pay_frequency IN ('weekly', 'biweekly', 'semi_monthly', 'monthly'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ROW LEVEL SECURITY for tenant_role_settings
-- =====================================================

ALTER TABLE tenant_role_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant role settings" ON tenant_role_settings
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Owners can insert role settings" ON tenant_role_settings
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)
    );

CREATE POLICY "Owners can update role settings" ON tenant_role_settings
    FOR UPDATE USING (
        can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)
    ) WITH CHECK (
        can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)
    );

CREATE POLICY "Owners can delete role settings" ON tenant_role_settings
    FOR DELETE USING (
        can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role)
    );

CREATE POLICY "Platform admins manage role settings" ON tenant_role_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- SEED FUNCTION — creates default role settings for a tenant
-- Idempotent: only inserts if no rows exist.
-- =====================================================

CREATE OR REPLACE FUNCTION seed_tenant_role_settings(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenant_role_settings WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO tenant_role_settings (
            tenant_id, role, display_name,
            approve_time_off, approve_time_edits, manage_shifts, delete_shifts,
            manage_recipes, manage_users, view_reports, export_payroll,
            manage_equipment, manage_tasks, manage_orders, manage_branding,
            manage_locations, manage_cash_deposits
        ) VALUES
        -- Owner: all true (locked in UI, never editable)
        (p_tenant_id, 'owner', 'Owner',
            true, true, true, true, true, true, true, true, true, true, true, true, true, true),
        -- Manager: most permissions
        (p_tenant_id, 'manager', 'Manager',
            true, true, true, true, true, true, true, true, true, true, true, false, false, true),
        -- Lead: approvals + scheduling + reports
        (p_tenant_id, 'lead', 'Lead',
            true, true, true, false, false, false, true, false, false, false, false, false, false, false),
        -- Employee: no management permissions
        (p_tenant_id, 'employee', 'Employee',
            false, false, false, false, false, false, false, false, false, false, false, false, false, false);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
