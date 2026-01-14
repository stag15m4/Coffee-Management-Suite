-- =====================================================
-- FIX FUNCTION SEARCH PATH WARNINGS
-- Adds SET search_path = public to prevent mutable search_path issues
-- =====================================================

-- Fix is_platform_admin function
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = auth.uid()
  );
$$;

-- Fix get_tenant_enabled_modules function
CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT m.module_key),
    ARRAY[]::TEXT[]
  )
  FROM tenant_module_subscriptions tms
  JOIN subscription_plans sp ON tms.plan_id = sp.id
  JOIN subscription_plan_modules spm ON sp.id = spm.plan_id
  JOIN modules m ON spm.module_id = m.id
  WHERE tms.tenant_id = p_tenant_id
    AND tms.is_active = true
    AND (tms.expires_at IS NULL OR tms.expires_at > NOW())
  UNION
  SELECT m.module_key
  FROM tenant_module_overrides tmo
  JOIN modules m ON tmo.module_id = m.id
  WHERE tmo.tenant_id = p_tenant_id
    AND tmo.is_enabled = true;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_enabled_modules(UUID) TO authenticated;
