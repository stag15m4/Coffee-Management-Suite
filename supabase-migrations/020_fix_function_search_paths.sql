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
    WHERE id = auth.uid()
  );
$$;

-- Fix get_tenant_enabled_modules function
CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tenant_plan TEXT;
    result TEXT[];
BEGIN
    -- Get the tenant's subscription plan
    SELECT subscription_plan INTO tenant_plan
    FROM tenants
    WHERE id = p_tenant_id;

    -- If no plan, default to 'free'
    IF tenant_plan IS NULL THEN
        tenant_plan := 'free';
    END IF;

    -- For free trial, test & eval, and premium: get all modules from plan
    IF tenant_plan IN ('free', 'test_eval', 'premium') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        LEFT JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
        WHERE 
            (tmo.is_enabled = true) OR 
            (tmo.is_enabled IS NULL AND spm.plan_id IS NOT NULL);
    ELSE
        -- For à la carte: get modules from tenant_module_subscriptions + overrides
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        LEFT JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = p_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = p_tenant_id
        WHERE 
            (tmo.is_enabled = true) OR 
            (tmo.is_enabled IS NULL AND tms.tenant_id IS NOT NULL);
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_enabled_modules(UUID) TO authenticated;
