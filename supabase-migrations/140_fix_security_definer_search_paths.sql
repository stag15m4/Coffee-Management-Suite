-- =====================================================
-- FIX SECURITY DEFINER FUNCTIONS MISSING SET search_path
-- Audit finding 2.19: All SECURITY DEFINER functions must pin
-- their search_path to prevent schema-hijacking attacks.
--
-- Three functions from 001_multi_tenant_schema.sql were created
-- with SECURITY DEFINER but no SET search_path clause.
-- This migration re-creates them with SET search_path = public.
-- =====================================================

-- 1. get_current_tenant_id() — originally in 001_multi_tenant_schema.sql:74
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id
        FROM public.user_profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. get_current_user_role() — originally in 001_multi_tenant_schema.sql:86
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role
        FROM public.user_profiles
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. has_role_or_higher(user_role) — originally in 001_multi_tenant_schema.sql:98
CREATE OR REPLACE FUNCTION has_role_or_higher(required_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_current_role user_role;
    role_order INTEGER;
    required_order INTEGER;
BEGIN
    user_current_role := get_current_user_role();

    IF user_current_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Define role hierarchy: owner > manager > lead > employee
    SELECT CASE user_current_role
        WHEN 'owner' THEN 4
        WHEN 'manager' THEN 3
        WHEN 'lead' THEN 2
        WHEN 'employee' THEN 1
        ELSE 0
    END INTO role_order;

    SELECT CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'manager' THEN 3
        WHEN 'lead' THEN 2
        WHEN 'employee' THEN 1
        ELSE 0
    END INTO required_order;

    RETURN role_order >= required_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
