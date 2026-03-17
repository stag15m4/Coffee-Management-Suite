-- =====================================================
-- CREATE get_my_tenant_id() AS ALIAS FOR get_current_tenant_id()
--
-- Migration 043 and others reference get_my_tenant_id(), which was
-- originally defined in migration 019. This migration replaces it
-- with a thin wrapper around get_current_tenant_id() (defined in
-- migration 001) to consolidate on a single canonical implementation.
--
-- Per audit finding 2.19: uses SECURITY DEFINER + SET search_path.
-- =====================================================

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_current_tenant_id();
$$;

-- Ensure authenticated users can call this function
GRANT EXECUTE ON FUNCTION get_my_tenant_id() TO authenticated;
