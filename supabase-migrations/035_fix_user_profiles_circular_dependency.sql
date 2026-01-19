-- =====================================================
-- FIX USER PROFILES CIRCULAR DEPENDENCY
-- The current SELECT policy queries user_profiles within itself
-- causing infinite recursion and timeouts
-- =====================================================

-- Step 1: Create a SECURITY DEFINER function to get user's role and tenant
-- This bypasses RLS to avoid circular dependency
CREATE OR REPLACE FUNCTION get_my_profile_info()
RETURNS TABLE(user_tenant_id uuid, user_role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id, role::text
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Step 2: Drop all existing user_profiles policies
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile by auth uid" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own name" ON user_profiles;
DROP POLICY IF EXISTS "Managers can read tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can create users" ON user_profiles;
DROP POLICY IF EXISTS "Managers can update tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can read tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can read other tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can insert new users" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can insert users in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can update tenant users" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can update tenant profiles" ON user_profiles;

-- Step 3: Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple SELECT policy that avoids recursion
-- Users can read their own profile OR profiles in their tenant if owner/manager
CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT USING (
  -- Users can always read their own profile (no recursion - direct auth.uid() check)
  id = auth.uid()
  OR
  -- Owners/managers can read other profiles in their tenant (uses function to avoid recursion)
  (
    user_profiles.tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
  )
);

-- Step 5: Create INSERT policy using the function
CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT WITH CHECK (
  -- Only owners/managers can create users in their tenant
  user_profiles.tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
  AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
);

-- Step 6: Create UPDATE policy using the function
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (
  -- Users can update their own profile
  id = auth.uid()
  OR
  -- Owners/managers can update profiles in their tenant
  (
    user_profiles.tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
  )
);

-- Verify the new policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
