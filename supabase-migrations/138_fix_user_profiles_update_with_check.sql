-- ============================================================
-- Migration 138: CFS-001 — Fix user_profiles UPDATE policy
-- missing WITH CHECK on is_active field.
--
-- Migration 118 added a WITH CHECK that prevents users from
-- changing their own role and tenant_id, but omitted is_active.
-- An employee could still deactivate/reactivate accounts or
-- keep themselves active after an admin deactivated them.
--
-- This migration recreates the policy with a complete WITH CHECK
-- that locks down role, tenant_id, AND is_active for self-updates.
-- ============================================================

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE
USING (
  -- Users can see/update their own row
  id = auth.uid()
  OR
  -- Owners/managers can update profiles in their tenant
  (
    is_owner_or_manager()
    AND tenant_id = get_my_tenant_id()
  )
)
WITH CHECK (
  CASE
    -- Self-update: cannot change role, tenant_id, or is_active
    WHEN id = auth.uid() THEN
      role = (SELECT role FROM user_profiles WHERE id = auth.uid())
      AND tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
      AND is_active = (SELECT is_active FROM user_profiles WHERE id = auth.uid())
    -- Manager/owner updating others in their tenant: allowed
    ELSE true
  END
);
