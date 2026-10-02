-- Migration 159: "Internal" modules unlock for the whole tenant the
-- platform creator owns, not just for individually-flagged platform admins.
--
-- get_tenant_enabled_modules() has always gated rollout_status = 'internal'
-- on caller_is_admin — a per-USER flag (platform_admins). That meant only
-- Seth's own login saw internal features; his team (Ava, managers, etc.)
-- testing under their own accounts in the same tenant did not, even though
-- the whole point of "internal" is for that tenant to dogfake new features
-- before they're rolled out generally.
--
-- Decision: "internal" means visible tenant-wide for the tenant whose OWNER
-- is a platform admin (the platform creator's own tenant) — not per-user,
-- and not extended to any other tenant's owner, since they're a customer,
-- not the platform creator. A tenant qualifies only while its own owner
-- account is both active and an active platform admin; this is derived from
-- existing data, not a new tenant flag, so it can't drift out of sync.

CREATE OR REPLACE FUNCTION tenant_owned_by_platform_admin(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN platform_admins pa ON pa.id = up.id AND pa.is_active = true
        WHERE up.tenant_id = p_tenant_id AND up.role = 'owner' AND up.is_active = true
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    effective_tenant_id UUID;
    parent_id UUID;
    tenant_plan TEXT;
    caller_is_admin BOOLEAN;
    tenant_is_internal BOOLEAN;
    result TEXT[];
BEGIN
    caller_is_admin := is_platform_admin();

    SELECT parent_tenant_id INTO parent_id
    FROM tenants
    WHERE id = p_tenant_id;

    IF parent_id IS NOT NULL THEN
        effective_tenant_id := parent_id;
    ELSE
        effective_tenant_id := p_tenant_id;
    END IF;

    tenant_is_internal := caller_is_admin OR tenant_owned_by_platform_admin(effective_tenant_id);

    SELECT subscription_plan INTO tenant_plan
    FROM tenants
    WHERE id = effective_tenant_id;

    IF tenant_plan IS NULL OR tenant_plan = '' THEN
        tenant_plan := 'free';
    END IF;

    IF tenant_plan IN ('free', 'beta', 'premium', 'professional') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND (tenant_plan IN ('beta', 'professional') OR tenant_is_internal))
            OR (m.rollout_status = 'internal' AND tenant_is_internal)
          );
    ELSE
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = effective_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND tenant_is_internal)
            OR (m.rollout_status = 'internal' AND tenant_is_internal)
          );
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
