-- =====================================================
-- OWNER INSERT CHILD LOCATIONS POLICY
-- Run this AFTER 041_multi_location_rls_policies.sql
-- 
-- Allows Owners to insert child locations (tenants)
-- under their parent tenant.
-- =====================================================

-- Allow Owners to insert child tenants (locations) under their parent tenant
DROP POLICY IF EXISTS "Owners can insert child locations" ON tenants;
CREATE POLICY "Owners can insert child locations" ON tenants
    FOR INSERT WITH CHECK (
        -- User must be an owner in their current tenant
        has_role_or_higher('owner'::user_role)
        -- The new location must be a child of the owner's current tenant
        AND parent_tenant_id = get_user_tenant_id()
    );

-- Allow Owners to update child locations they have access to
DROP POLICY IF EXISTS "Owners can update child locations" ON tenants;
CREATE POLICY "Owners can update child locations" ON tenants
    FOR UPDATE USING (
        -- Can only update tenants they have access to
        can_access_tenant(id)
        -- Must be an owner
        AND has_role_or_higher('owner'::user_role)
    )
    WITH CHECK (
        -- Can only update tenants they have access to
        can_access_tenant(id)
        -- Must be an owner
        AND has_role_or_higher('owner'::user_role)
        -- Cannot change parent_tenant_id (prevent moving locations between tenants)
        -- This is enforced by ensuring the value stays within accessible tenants
    );

-- Allow Owners to delete child locations (not the parent tenant itself)
DROP POLICY IF EXISTS "Owners can delete child locations" ON tenants;
CREATE POLICY "Owners can delete child locations" ON tenants
    FOR DELETE USING (
        -- Can only delete child tenants (not the root parent)
        parent_tenant_id IS NOT NULL
        -- Must have access to this tenant
        AND can_access_tenant(id)
        -- Must be an owner
        AND has_role_or_higher('owner'::user_role)
    );
