-- 142: Fix constraint violations and tighten recipe_vendors RLS
--
-- 1) tip_payout_approvals.calculated_by is NOT NULL but its FK uses
--    ON DELETE SET NULL — a contradiction that crashes at runtime when a
--    user_profile is deleted.  Switch to ON DELETE RESTRICT so the delete
--    is blocked instead (the audit trail must be preserved).
--
-- 2) tip_payout_approvals is missing UNIQUE(tenant_id, week_key).
--    The server relies on error 23505 to prevent duplicate approvals per
--    tenant per week, but without this constraint the check never fires.
--
-- 3) recipe_vendors INSERT/UPDATE/DELETE policies (from migration 137)
--    allow any tenant member to mutate vendor records.  Restrict write
--    operations to managers and above.

BEGIN;

-- ============================================================
-- 1) Fix calculated_by FK: NOT NULL + ON DELETE SET NULL -> RESTRICT
-- ============================================================

-- Drop the existing FK (Postgres auto-names it <table>_<col>_fkey)
ALTER TABLE tip_payout_approvals
    DROP CONSTRAINT IF EXISTS tip_payout_approvals_calculated_by_fkey;

ALTER TABLE tip_payout_approvals
    ADD CONSTRAINT tip_payout_approvals_calculated_by_fkey
    FOREIGN KEY (calculated_by) REFERENCES user_profiles(id)
    ON DELETE RESTRICT;

-- approved_by is nullable so ON DELETE SET NULL is valid there — no change needed.

-- ============================================================
-- 2) Add UNIQUE(tenant_id, week_key) for duplicate-approval guard
-- ============================================================

ALTER TABLE tip_payout_approvals
    ADD CONSTRAINT uq_tip_payout_approvals_tenant_week
    UNIQUE (tenant_id, week_key);

-- ============================================================
-- 3) Tighten recipe_vendors write policies to require manager role
-- ============================================================

-- Drop existing write policies (SELECT and platform-admin policies stay)
DROP POLICY IF EXISTS "Tenants can insert their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can update their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can delete their own vendors" ON recipe_vendors;

-- INSERT: managers and above only
CREATE POLICY "Tenants can insert their own vendors" ON recipe_vendors
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- UPDATE: managers and above only
CREATE POLICY "Tenants can update their own vendors" ON recipe_vendors
    FOR UPDATE
    USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- DELETE: managers and above only
CREATE POLICY "Tenants can delete their own vendors" ON recipe_vendors
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

COMMIT;
