-- Migration 124: Fix blackout_dates SELECT policy
-- The original policy only checked user_tenant_assignments, missing the user's
-- primary tenant from user_profiles. Users at their primary location couldn't
-- see blackout dates.

DROP POLICY IF EXISTS "tenant_view_blackouts" ON blackout_dates;

CREATE POLICY "tenant_view_blackouts" ON blackout_dates
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR tenant_id IN (
            SELECT tenant_id FROM user_tenant_assignments
            WHERE user_id = auth.uid() AND is_active = true
        )
    );
