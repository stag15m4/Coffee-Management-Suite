-- =====================================================
-- MODULE ROLLOUT PHASES + RENAME TEST_EVAL TO BETA
--
-- Adds rollout lifecycle (internal → beta → ga) to modules
-- Renames test_eval subscription plan to beta
-- Updates get_tenant_enabled_modules to respect rollout_status
-- =====================================================

-- =========================
-- PART A: Add rollout_status to modules
-- =========================

ALTER TABLE modules ADD COLUMN IF NOT EXISTS rollout_status TEXT NOT NULL DEFAULT 'ga';

-- Set calendar-workforce to internal (platform admin only)
UPDATE modules SET rollout_status = 'internal' WHERE id = 'calendar-workforce';

-- =========================
-- PART B: Rename test_eval plan to beta
-- =========================

-- 1. Insert new beta plan (copy from test_eval, but free and unpublished)
INSERT INTO subscription_plans (id, name, description, monthly_price, display_order, is_active, is_published, max_locations)
SELECT 'beta', 'Beta', 'Full access for beta testing', 0, display_order, is_active, false, max_locations
FROM subscription_plans WHERE id = 'test_eval'
ON CONFLICT (id) DO NOTHING;

-- 2. Copy plan-module links
INSERT INTO subscription_plan_modules (plan_id, module_id)
SELECT 'beta', module_id FROM subscription_plan_modules WHERE plan_id = 'test_eval'
ON CONFLICT DO NOTHING;

-- 3. Migrate tenants from test_eval to beta
UPDATE tenants SET subscription_plan = 'beta' WHERE subscription_plan = 'test_eval';

-- 4. Migrate license codes
UPDATE license_codes SET subscription_plan = 'beta' WHERE subscription_plan = 'test_eval';

-- 5. Clean up old test_eval plan
DELETE FROM subscription_plan_modules WHERE plan_id = 'test_eval';
DELETE FROM subscription_plans WHERE id = 'test_eval';

-- =========================
-- PART C: Update get_tenant_enabled_modules with rollout filtering
-- =========================

CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    effective_tenant_id UUID;
    parent_id UUID;
    tenant_plan TEXT;
    caller_is_admin BOOLEAN;
    result TEXT[];
BEGIN
    -- Check if the caller is a platform admin
    caller_is_admin := is_platform_admin();

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

    -- For free trial, beta, and premium: get all modules from plan
    IF tenant_plan IN ('free', 'beta', 'premium') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND (tenant_plan = 'beta' OR caller_is_admin))
            OR (m.rollout_status = 'internal' AND caller_is_admin)
          );
    ELSE
        -- For à la carte: get modules from tenant_module_subscriptions + overrides
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = effective_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND (tenant_plan = 'beta' OR caller_is_admin))
            OR (m.rollout_status = 'internal' AND caller_is_admin)
          );
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================
-- PART D: Ensure platform admins can update modules table
-- =========================

-- Drop existing policy if it exists, then create
DO $$
BEGIN
    DROP POLICY IF EXISTS "Platform admins can update modules" ON modules;
    CREATE POLICY "Platform admins can update modules" ON modules
        FOR UPDATE USING (is_platform_admin()) WITH CHECK (is_platform_admin());
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
