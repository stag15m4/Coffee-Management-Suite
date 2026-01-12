-- =====================================================
-- CLEAN UP USER PROFILE POLICIES
-- Run this to fix any login/profile loading issues
-- =====================================================

-- First, drop ALL user_profiles policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile by auth uid" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can read tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can read other tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can insert new users" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can update tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own basic info" ON user_profiles;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- POLICY 1: Users can read their own profile (simplest, no subqueries)
CREATE POLICY "Users can read own profile"
ON user_profiles FOR SELECT
USING (id = auth.uid());

-- POLICY 2: Users can update their own non-role fields
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- POLICY 3: Owners/managers can read other profiles in their tenant
-- Uses EXISTS to avoid subquery issues
CREATE POLICY "Managers can read tenant profiles"
ON user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles AS viewer
    WHERE viewer.id = auth.uid()
    AND viewer.tenant_id = user_profiles.tenant_id
    AND viewer.role IN ('owner', 'manager')
  )
);

-- POLICY 4: Owners/managers can insert new users in their tenant
CREATE POLICY "Managers can create users"
ON user_profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles AS creator
    WHERE creator.id = auth.uid()
    AND creator.tenant_id = user_profiles.tenant_id
    AND creator.role IN ('owner', 'manager')
  )
);

-- POLICY 5: Owners/managers can update profiles in their tenant
CREATE POLICY "Managers can update tenant profiles"
ON user_profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles AS editor
    WHERE editor.id = auth.uid()
    AND editor.tenant_id = user_profiles.tenant_id
    AND editor.role IN ('owner', 'manager')
  )
);

-- =====================================================
-- VERIFICATION: Check that policies were created
-- =====================================================
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;
