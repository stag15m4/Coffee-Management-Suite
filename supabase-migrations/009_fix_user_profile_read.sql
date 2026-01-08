-- =====================================================
-- FIX USER PROFILE RLS - BREAK CIRCULAR DEPENDENCY
-- Run this AFTER all previous migrations
-- =====================================================
-- Problem: Original policies used get_current_tenant_id() which reads
-- from user_profiles, creating a circular dependency that hangs queries.
--
-- Solution: Use direct auth.uid() checks and inline subqueries.
-- =====================================================

-- First, drop all problematic policies on user_profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Owners can read profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Owners can manage users in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Owners can insert users in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own name only" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Owners can manage users" ON user_profiles;

-- Ensure RLS is enabled (it may have been disabled for testing)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- POLICY 1: Users can read their OWN profile using auth.uid() directly
-- This is the critical policy that breaks the circular dependency
CREATE POLICY "Users can read own profile by auth uid" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- POLICY 2: Users can update their own profile (name only - role/tenant enforced by backend)
CREATE POLICY "Users can update own name" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Note: For owner functionality to manage other users, use:
-- 1. A backend API with service role key (bypasses RLS)
-- 2. Or add owner policies carefully after testing basic auth works

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- User profile RLS fixed!
-- - Users can read their own profile via auth.uid()
-- - Users can update their own profile
-- - Owner management should go through backend API
