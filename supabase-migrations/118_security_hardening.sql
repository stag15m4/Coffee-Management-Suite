-- ============================================================
-- Migration 118: Security hardening for RLS policies and
-- database functions found in second-pass audit.
-- ============================================================

-- H6: Fix user_profiles UPDATE policy — prevent self-privilege escalation
-- Users must not be able to change their own role or tenant_id.
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (
  id = auth.uid()
  OR (
    is_owner_or_manager()
    AND tenant_id = get_my_tenant_id()
  )
)
WITH CHECK (
  CASE
    -- Self-update: cannot change role or tenant
    WHEN id = auth.uid() THEN
      tenant_id = get_my_tenant_id()
      AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    -- Manager/owner updating others: allowed
    ELSE true
  END
);

-- M13: Fix is_platform_admin() to check is_active
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- L6: Fix feedback_submissions INSERT policy — enforce user_id and tenant_id
DROP POLICY IF EXISTS "Users can submit feedback" ON feedback_submissions;
CREATE POLICY "Users can submit feedback" ON feedback_submissions
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid())
);

-- L7: Fix platform admin feedback SELECT policy — wrong column name
DROP POLICY IF EXISTS "Platform admins can view all feedback" ON feedback_submissions;
CREATE POLICY "Platform admins can view all feedback" ON feedback_submissions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE id = auth.uid() AND is_active = true)
);

-- L1: Fix license code generation to use cryptographic randomness
CREATE OR REPLACE FUNCTION generate_license_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  random_bytes BYTEA;
  i INTEGER;
BEGIN
  random_bytes := gen_random_bytes(12);
  FOR i IN 1..12 LOOP
    result := result || substr(chars, (get_byte(random_bytes, i - 1) % length(chars)) + 1, 1);
    IF i = 4 OR i = 8 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- H7: Add auth check to redeem_license_code()
-- Wrap the function to verify caller owns the tenant
CREATE OR REPLACE FUNCTION redeem_license_code(p_code TEXT, p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_license_id UUID;
  v_reseller_id UUID;
  v_subscription_plan TEXT;
BEGIN
  -- Verify the caller has access to this tenant
  IF NOT public.can_access_tenant(p_tenant_id) AND NOT public.is_platform_admin() THEN
    RETURN NULL;
  END IF;

  -- Find valid unredeemed code
  SELECT id, reseller_id, subscription_plan
  INTO v_license_id, v_reseller_id, v_subscription_plan
  FROM public.license_codes
  WHERE code = p_code
    AND redeemed_at IS NULL
    AND expires_at > NOW();

  IF v_license_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mark as redeemed
  UPDATE public.license_codes
  SET redeemed_at = NOW(), tenant_id = p_tenant_id
  WHERE id = v_license_id AND redeemed_at IS NULL;

  -- Link tenant to reseller
  UPDATE public.tenants
  SET reseller_id = v_reseller_id,
      license_code_id = v_license_id,
      subscription_plan = COALESCE(v_subscription_plan, subscription_plan)
  WHERE id = p_tenant_id;

  -- Increment reseller seat count
  UPDATE public.resellers
  SET seats_used = seats_used + 1
  WHERE id = v_reseller_id;

  RETURN v_license_id;
END;
$$;
