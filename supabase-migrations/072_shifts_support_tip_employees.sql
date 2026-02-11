-- Allow shifts to reference either user_profiles (logged-in users) or
-- tip_employees (tip-roster-only workers who may not have accounts).
--
-- employee_id (FK to user_profiles) becomes nullable.
-- tip_employee_id (FK to tip_employees) is added as nullable.
-- employee_name (TEXT) always stores the display name regardless of source.
-- At least one identifier must be present.

-- 1. Add new columns
ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS tip_employee_id UUID REFERENCES tip_employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS employee_name TEXT;

-- 2. Make employee_id nullable
ALTER TABLE shifts ALTER COLUMN employee_id DROP NOT NULL;

-- 3. Backfill employee_name from existing user_profiles joins
UPDATE shifts s
SET employee_name = up.full_name
FROM user_profiles up
WHERE s.employee_id = up.id
  AND s.employee_name IS NULL;

-- 4. Add check: at least one of employee_id or tip_employee_id must be set
ALTER TABLE shifts
    ADD CONSTRAINT shifts_has_employee
    CHECK (employee_id IS NOT NULL OR tip_employee_id IS NOT NULL);

-- 5. Index the new FK
CREATE INDEX IF NOT EXISTS idx_shifts_tip_employee ON shifts(tip_employee_id);

-- 6. Also add the same columns to shift_templates
ALTER TABLE shift_templates
    ADD COLUMN IF NOT EXISTS tip_employee_id UUID REFERENCES tip_employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS employee_name TEXT;

-- Make employee_id nullable on templates too
ALTER TABLE shift_templates ALTER COLUMN employee_id DROP NOT NULL;
