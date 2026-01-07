-- =====================================================
-- ERWIN MILLS SUITE - MULTI-TENANT SCHEMA
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create ENUM types for roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'manager', 'lead', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tenants table - Each business using the platform
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (e.g., "erwin-mills")
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tenant branding - Custom logo and colors per business
CREATE TABLE IF NOT EXISTS tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#C9A227', -- Gold
    secondary_color TEXT DEFAULT '#4A3728', -- Brown
    accent_color TEXT DEFAULT '#F5F0E1', -- Cream
    background_color TEXT DEFAULT '#FFFDF7', -- Light cream
    company_name TEXT,
    tagline TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 4. User profiles - Links Supabase Auth users to tenants and roles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'employee',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 6. Insert default tenant (Erwin Mills) with branding
INSERT INTO tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Erwin Mills Coffee Co.', 'erwin-mills')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_branding (tenant_id, company_name, tagline)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Erwin Mills Coffee Co.',
    'Recipe Cost Manager'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get current user's tenant_id from JWT
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id 
        FROM user_profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM user_profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has required role or higher
CREATE OR REPLACE FUNCTION has_role_or_higher(required_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    current_role user_role;
    role_order INTEGER;
    required_order INTEGER;
BEGIN
    current_role := get_current_user_role();
    
    IF current_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Define role hierarchy: owner > manager > lead > employee
    SELECT CASE current_role
        WHEN 'owner' THEN 4
        WHEN 'manager' THEN 3
        WHEN 'lead' THEN 2
        WHEN 'employee' THEN 1
        ELSE 0
    END INTO role_order;
    
    SELECT CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'manager' THEN 3
        WHEN 'lead' THEN 2
        WHEN 'employee' THEN 1
        ELSE 0
    END INTO required_order;
    
    RETURN role_order >= required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Multi-tenant schema created successfully!
-- Next: Run 002_add_tenant_to_tables.sql to add tenant_id to existing tables
