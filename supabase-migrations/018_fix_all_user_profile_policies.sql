-- =====================================================
-- FIX ALL USER PROFILE RLS POLICIES
-- This fixes the login issue and performance warnings
-- =====================================================

-- Step 1: Drop ALL existing user_profiles policies
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

-- Step 2: Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create SINGLE optimized policy for SELECT
-- Using (SELECT auth.uid()) for better performance (cached per query)
CREATE POLICY "user_profiles_select_policy" ON user_profiles
FOR SELECT USING (
  -- Users can always read their own profile
  id = (SELECT auth.uid())
  OR
  -- Owners/managers can read profiles in their tenant
  EXISTS (
    SELECT 1 FROM user_profiles AS viewer
    WHERE viewer.id = (SELECT auth.uid())
    AND viewer.tenant_id = user_profiles.tenant_id
    AND viewer.role IN ('owner', 'manager')
  )
);

-- Step 4: Create SINGLE policy for INSERT
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
FOR INSERT WITH CHECK (
  -- Only owners/managers can create users in their tenant
  EXISTS (
    SELECT 1 FROM user_profiles AS creator
    WHERE creator.id = (SELECT auth.uid())
    AND creator.tenant_id = user_profiles.tenant_id
    AND creator.role IN ('owner', 'manager')
  )
);

-- Step 5: Create SINGLE policy for UPDATE
CREATE POLICY "user_profiles_update_policy" ON user_profiles
FOR UPDATE USING (
  -- Users can update their own profile
  id = (SELECT auth.uid())
  OR
  -- Owners/managers can update profiles in their tenant
  EXISTS (
    SELECT 1 FROM user_profiles AS editor
    WHERE editor.id = (SELECT auth.uid())
    AND editor.tenant_id = user_profiles.tenant_id
    AND editor.role IN ('owner', 'manager')
  )
);

-- Verify the policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
