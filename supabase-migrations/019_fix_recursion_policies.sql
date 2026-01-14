-- =====================================================
-- FIX INFINITE RECURSION IN USER_PROFILES POLICIES
-- The issue: Policies query user_profiles to check permissions,
-- which triggers the same policies, causing infinite recursion.
-- Solution: Use SECURITY DEFINER functions that bypass RLS.
-- =====================================================

-- Step 1: Create helper functions with SECURITY DEFINER
-- These bypass RLS and can safely query user_profiles

-- Function to get current user's tenant_id
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Function to check if current user is owner or manager
CREATE OR REPLACE FUNCTION is_owner_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'manager')
  );
$$;

-- Step 2: Drop ALL existing user_profiles policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Managers can read tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can create users" ON user_profiles;
DROP POLICY IF EXISTS "Managers can update tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can insert users in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can read tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Owners and managers can update tenant users" ON user_profiles;

-- Step 3: Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create new policies using the helper functions (no recursion!)

-- SELECT: Users can read their own profile OR if they're owner/manager in same tenant
CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT USING (
  id = auth.uid()
  OR (
    is_owner_or_manager() 
    AND tenant_id = get_my_tenant_id()
  )
);

-- INSERT: Only owners/managers can create users in their tenant
CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT WITH CHECK (
  is_owner_or_manager()
  AND tenant_id = get_my_tenant_id()
);

-- UPDATE: Users can update own profile, or owner/manager can update tenant profiles
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (
  id = auth.uid()
  OR (
    is_owner_or_manager()
    AND tenant_id = get_my_tenant_id()
  )
);

-- Step 5: Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_owner_or_manager() TO authenticated;

-- Verify policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
