-- =====================================================
-- CHILD LOCATION MODULE INHERITANCE
-- Run this AFTER 043_owner_insert_child_locations.sql
-- 
-- Updates get_tenant_enabled_modules to check parent 
-- tenant's subscription for child locations.
-- =====================================================

-- Update get_tenant_enabled_modules to inherit from parent tenant's subscription
CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    effective_tenant_id UUID;
    parent_id UUID;
    tenant_plan TEXT;
    result TEXT[];
BEGIN
    -- Check if this tenant is a child location (has parent_tenant_id)
    SELECT parent_tenant_id INTO parent_id
    FROM tenants
    WHERE id = p_tenant_id;

    -- Use parent's subscription if this is a child location
    IF parent_id IS NOT NULL THEN
        effective_tenant_id := parent_id;
    ELSE
        effective_tenant_id := p_tenant_id;
    END IF;

    -- Get the effective tenant's subscription plan
    SELECT subscription_plan INTO tenant_plan
    FROM tenants
    WHERE id = effective_tenant_id;

    -- If no plan set, default to 'free' (trial)
    IF tenant_plan IS NULL OR tenant_plan = '' THEN
        tenant_plan := 'free';
    END IF;

    -- For free trial, test & eval, and premium: get all modules from plan
    IF tenant_plan IN ('free', 'test_eval', 'premium') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE tmo.is_enabled IS NULL OR tmo.is_enabled = true;
    ELSE
        -- For à la carte: get modules from tenant_module_subscriptions + overrides
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = effective_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE tmo.is_enabled IS NULL OR tmo.is_enabled = true;
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
