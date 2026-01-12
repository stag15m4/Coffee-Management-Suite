-- =====================================================
-- FIX SELECT POLICY RECURSION
-- The previous policy had a subquery that could cause issues
-- =====================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;

-- Create simpler SELECT policy that avoids recursion
-- Users can ALWAYS read their own profile (no subquery needed)
CREATE POLICY "user_profiles_select_own" ON user_profiles
FOR SELECT USING (id = (SELECT auth.uid()));

-- Separate policy for owners/managers to read tenant profiles
-- This uses a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION get_user_role_and_tenant(user_id uuid)
RETURNS TABLE(role text, tenant_id uuid) 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text, tenant_id FROM user_profiles WHERE id = user_id;
$$ LANGUAGE sql STABLE;

CREATE POLICY "user_profiles_select_tenant" ON user_profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM get_user_role_and_tenant((SELECT auth.uid())) AS ut
    WHERE ut.tenant_id = user_profiles.tenant_id
    AND ut.role IN ('owner', 'manager')
  )
);
