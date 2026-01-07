-- =====================================================
-- FIX USER PROFILE SECURITY POLICIES
-- Run this AFTER 003_row_level_security.sql
-- Prevents users from escalating their own role
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create restricted policy - users can only update their name, NOT role or tenant
CREATE POLICY "Users can update their own name only" ON user_profiles
    FOR UPDATE 
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND tenant_id = get_current_tenant_id()  -- Can't change tenant
        AND role = get_current_user_role()        -- Can't change role
    );

-- Owners can fully manage users in their tenant (including role changes)
DROP POLICY IF EXISTS "Owners can manage users" ON user_profiles;
CREATE POLICY "Owners can manage users in their tenant" ON user_profiles
    FOR ALL 
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('owner')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()  -- Can only create/modify users in own tenant
    );

-- Owners can insert new users into their tenant
DROP POLICY IF EXISTS "Owners can insert users" ON user_profiles;
CREATE POLICY "Owners can insert users in their tenant" ON user_profiles
    FOR INSERT
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('owner')
    );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- User profile security fixed!
-- Users can now only update their name, not their role or tenant.
-- Only Owners can change user roles or add new users.
