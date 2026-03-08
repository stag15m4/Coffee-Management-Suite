-- =====================================================
-- FIX USER_PROFILES UPDATE RLS INFINITE RECURSION
--
-- The with_check clause had an inline subquery
-- (SELECT role FROM user_profiles WHERE id = auth.uid())
-- which triggered RLS evaluation recursively.
-- Replace with a SECURITY DEFINER function.
-- =====================================================

DROP FUNCTION IF EXISTS get_my_role();

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS user_profiles_update ON user_profiles;

CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE
  USING (
    (id = auth.uid()) OR (is_owner_or_manager() AND (tenant_id = get_my_tenant_id()))
  )
  WITH CHECK (
    CASE
      WHEN (id = auth.uid()) THEN (tenant_id = get_my_tenant_id() AND role::text = get_my_role())
      ELSE true
    END
  );
