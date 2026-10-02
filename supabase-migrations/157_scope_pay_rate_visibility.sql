-- Migration 157: Restrict hourly_rate/annual_salary/pay_frequency to the
-- employee themself or a manager+, instead of every tenant member.
--
-- user_profiles' SELECT policy (migration 041, "Users can view accessible
-- profiles") is intentionally tenant-wide: names, avatars, and roles need to
-- be visible across the team for the directory, @mentions, schedule
-- dropdowns, etc. Row-level security can't restrict individual columns
-- within that same policy, so a plain employee's own session can currently
-- read every coworker's hourly wage directly off that broad row access —
-- the app's UI simply never renders it to them, but the data is not
-- actually protected.
--
-- Fix: revoke column-level SELECT on the pay columns from `authenticated`
-- (closes direct access for everyone, including via the existing broad
-- profiles query), and expose them only through a narrow view whose own
-- WHERE clause enforces self-or-manager. Client code that legitimately
-- needs pay data (self pay estimate, manager/payroll views) reads from this
-- view instead of the base table.

CREATE OR REPLACE VIEW user_pay_rates AS
SELECT id, tenant_id, hourly_rate, annual_salary, pay_frequency
FROM user_profiles
WHERE can_access_tenant(tenant_id)
  AND (id = auth.uid() OR has_role_or_higher('manager'::user_role));

GRANT SELECT ON user_pay_rates TO authenticated;

REVOKE SELECT (hourly_rate, annual_salary, pay_frequency) ON user_profiles FROM authenticated;

-- ---------------------------------------------------------------------------
-- While scoping read access, also close a write-side gap found in the same
-- table: "user_profiles_update" (migration 138) locks a self-update's
-- WITH CHECK against changing role/tenant_id/is_active, but never covered
-- hourly_rate, annual_salary, pay_frequency, or manager_id. Today, any
-- employee can directly update their own row with a new hourly_rate (give
-- themselves a raise) or manager_id with no server involved at all — RLS
-- lets it through. is_exempt is deliberately left self-editable for
-- managers+ (TimeClockTab's own "My time clock" toggle updates the viewer's
-- own row this way) but still locked for a plain employee doing the same.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR
  (
    is_owner_or_manager()
    AND tenant_id = get_my_tenant_id()
  )
)
WITH CHECK (
  CASE
    WHEN id = auth.uid() THEN
      role = (SELECT role FROM user_profiles WHERE id = auth.uid())
      AND tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
      AND is_active = (SELECT is_active FROM user_profiles WHERE id = auth.uid())
      AND hourly_rate IS NOT DISTINCT FROM (SELECT hourly_rate FROM user_profiles WHERE id = auth.uid())
      AND annual_salary IS NOT DISTINCT FROM (SELECT annual_salary FROM user_profiles WHERE id = auth.uid())
      AND pay_frequency IS NOT DISTINCT FROM (SELECT pay_frequency FROM user_profiles WHERE id = auth.uid())
      AND manager_id IS NOT DISTINCT FROM (SELECT manager_id FROM user_profiles WHERE id = auth.uid())
      AND (
        is_exempt IS NOT DISTINCT FROM (SELECT is_exempt FROM user_profiles WHERE id = auth.uid())
        OR has_role_or_higher('manager'::user_role)
      )
    ELSE true
  END
);
