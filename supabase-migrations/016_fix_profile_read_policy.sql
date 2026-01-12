-- =====================================================
-- FIX PROFILE READ POLICY
-- Run this AFTER 015_allow_user_creation.sql
-- =====================================================
-- Problem: The SELECT policy from 015 uses subqueries that may
-- interfere with basic profile reading.
--
-- Solution: Drop the problematic SELECT policy and keep only
-- the simple "read own profile" policy from 009.
-- =====================================================

-- Drop the potentially problematic SELECT policy from 015
DROP POLICY IF EXISTS "Owners and managers can read tenant profiles" ON user_profiles;

-- Keep the original simple policy from 009 (already exists, just ensuring it's there)
-- This allows users to read their own profile without complex subqueries
DROP POLICY IF EXISTS "Users can read own profile by auth uid" ON user_profiles;
CREATE POLICY "Users can read own profile by auth uid" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Add a separate policy for owners/managers to read OTHER profiles in their tenant
-- This uses a more careful approach with EXISTS instead of subqueries
CREATE POLICY "Owners and managers can read other tenant profiles" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles AS my_profile
            WHERE my_profile.id = auth.uid()
            AND my_profile.tenant_id = user_profiles.tenant_id
            AND my_profile.role IN ('owner', 'manager')
        )
    );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Profile read policies fixed!
-- Users can read their own profile.
-- Owners and managers can also read other profiles in their tenant.
