-- =====================================================
-- FIX USER PROFILE READ - BREAK CIRCULAR DEPENDENCY
-- Run this AFTER all previous migrations
-- =====================================================
-- The problem: get_current_tenant_id() reads from user_profiles,
-- but reading user_profiles requires RLS which calls get_current_tenant_id()
-- This creates an infinite loop/deadlock.

-- Solution: Allow users to read their OWN profile using auth.uid() directly
-- This doesn't require looking up tenant_id first.

-- Drop the problematic SELECT policy that uses get_current_tenant_id()
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;

-- Create a policy that lets users read their own profile using auth.uid() directly
-- This breaks the circular dependency
DROP POLICY IF EXISTS "Users can read own profile by auth uid" ON user_profiles;
CREATE POLICY "Users can read own profile by auth uid" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Also allow owners to read all profiles in their tenant (for admin pages)
-- This still works because by the time an owner queries other profiles,
-- they've already fetched their own profile (via the policy above)
DROP POLICY IF EXISTS "Owners can read profiles in their tenant" ON user_profiles;
CREATE POLICY "Owners can read profiles in their tenant" ON user_profiles
    FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'owner'
    );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- User profile RLS fixed!
-- Users can now read their own profile without circular dependency.
-- Owners can read all profiles in their tenant.
