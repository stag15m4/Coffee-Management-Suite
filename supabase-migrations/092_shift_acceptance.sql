-- Shift Acceptance/Decline
-- Employees can accept or decline published shifts assigned to them.
-- Acceptance is tracked separately from the scheduling status (draft/published/cancelled).

-- 1. Add acceptance columns to shifts
ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS acceptance TEXT,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- 2. Constrain acceptance values
ALTER TABLE shifts
    ADD CONSTRAINT shifts_acceptance_check
    CHECK (acceptance IS NULL OR acceptance IN ('accepted', 'declined'));

-- 3. Index for quick lookups of pending/declined shifts
CREATE INDEX IF NOT EXISTS idx_shifts_acceptance
    ON shifts(tenant_id, acceptance)
    WHERE acceptance IS NOT NULL;

-- 4. RLS: Allow employees to update acceptance on their own published shifts
-- (additive — existing lead+ UPDATE policy remains)
CREATE POLICY "Employees can accept/decline own shifts" ON shifts
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND employee_id = auth.uid()
        AND status = 'published'
    ) WITH CHECK (
        can_access_tenant(tenant_id)
        AND employee_id = auth.uid()
        AND status = 'published'
    );
