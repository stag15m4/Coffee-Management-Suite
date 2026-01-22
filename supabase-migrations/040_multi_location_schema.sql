-- =====================================================
-- MULTI-LOCATION HIERARCHY SCHEMA
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Add parent_tenant_id to tenants table for location hierarchy
-- NULL = standalone/parent organization
-- Value = this is a child location of the parent
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS parent_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- Add index for parent lookups
CREATE INDEX IF NOT EXISTS idx_tenants_parent ON tenants(parent_tenant_id);

-- 2. Create user_tenant_assignments table
-- Allows users to be assigned to multiple locations with specific roles
CREATE TABLE IF NOT EXISTS user_tenant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'employee',
    is_primary BOOLEAN NOT NULL DEFAULT false, -- Primary location for this user
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id) -- User can only have one assignment per tenant
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_user ON user_tenant_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_assignments_tenant ON user_tenant_assignments(tenant_id);

-- 3. Helper function to get all tenant IDs user has access to
CREATE OR REPLACE FUNCTION get_user_accessible_tenants()
RETURNS SETOF UUID AS $$
DECLARE
    primary_tenant_id UUID;
BEGIN
    -- Get user's primary tenant from user_profiles
    SELECT tenant_id INTO primary_tenant_id
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Return primary tenant
    RETURN NEXT primary_tenant_id;
    
    -- Return all assigned tenants from user_tenant_assignments
    RETURN QUERY
    SELECT uta.tenant_id
    FROM user_tenant_assignments uta
    WHERE uta.user_id = auth.uid()
    AND uta.is_active = true
    AND uta.tenant_id != primary_tenant_id;
    
    -- If user is owner of a parent tenant, also return all child tenants
    IF (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'owner' THEN
        RETURN QUERY
        SELECT t.id
        FROM tenants t
        WHERE t.parent_tenant_id = primary_tenant_id
        AND t.is_active = true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Helper function to check if user can access a specific tenant
CREATE OR REPLACE FUNCTION can_access_tenant(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    primary_tenant_id UUID;
    user_role_val user_role;
BEGIN
    -- Get user's primary tenant and role
    SELECT tenant_id, role INTO primary_tenant_id, user_role_val
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Direct access to primary tenant
    IF check_tenant_id = primary_tenant_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check user_tenant_assignments
    IF EXISTS (
        SELECT 1 FROM user_tenant_assignments
        WHERE user_id = auth.uid()
        AND tenant_id = check_tenant_id
        AND is_active = true
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- If owner, check if this is a child tenant of their primary tenant
    IF user_role_val = 'owner' THEN
        IF EXISTS (
            SELECT 1 FROM tenants
            WHERE id = check_tenant_id
            AND parent_tenant_id = primary_tenant_id
            AND is_active = true
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Helper function to get child tenants of a parent
CREATE OR REPLACE FUNCTION get_child_tenants(parent_id UUID)
RETURNS SETOF tenants AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM tenants
    WHERE parent_tenant_id = parent_id
    AND is_active = true
    ORDER BY name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Helper function to check if current tenant is a parent (has child locations)
CREATE OR REPLACE FUNCTION is_parent_tenant(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenants
        WHERE parent_tenant_id = check_tenant_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. RLS policy for user_tenant_assignments
ALTER TABLE user_tenant_assignments ENABLE ROW LEVEL SECURITY;

-- Owners can manage assignments for their tenant's users
CREATE POLICY "Owners can manage tenant assignments"
ON user_tenant_assignments
FOR ALL
USING (
    -- Owner of the target tenant
    tenant_id = get_current_tenant_id() AND has_role_or_higher('owner'::user_role)
    OR
    -- Owner of parent tenant can manage child tenant assignments
    EXISTS (
        SELECT 1 FROM tenants t
        WHERE t.id = user_tenant_assignments.tenant_id
        AND t.parent_tenant_id = get_current_tenant_id()
        AND has_role_or_higher('owner'::user_role)
    )
)
WITH CHECK (
    tenant_id = get_current_tenant_id() AND has_role_or_higher('owner'::user_role)
    OR
    EXISTS (
        SELECT 1 FROM tenants t
        WHERE t.id = user_tenant_assignments.tenant_id
        AND t.parent_tenant_id = get_current_tenant_id()
        AND has_role_or_higher('owner'::user_role)
    )
);

-- Users can read their own assignments
CREATE POLICY "Users can read own assignments"
ON user_tenant_assignments
FOR SELECT
USING (user_id = auth.uid());

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Multi-location hierarchy schema created successfully!
-- 
-- Key features:
-- - tenants.parent_tenant_id: Links child locations to parent organization
-- - user_tenant_assignments: Allows users to work at multiple locations
-- - get_user_accessible_tenants(): Returns all tenants a user can access
-- - can_access_tenant(tenant_id): Checks if user can access specific tenant
-- - get_child_tenants(parent_id): Returns all child locations of a parent
-- - is_parent_tenant(tenant_id): Checks if tenant has child locations
