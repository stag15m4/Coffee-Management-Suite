-- 096: Enable tip-only employees to use the kiosk time clock
-- These employees don't have Supabase auth accounts but can clock in/out via PIN

-- 1. Add kiosk_pin to tip_employees
ALTER TABLE tip_employees ADD COLUMN IF NOT EXISTS kiosk_pin TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_employees_kiosk_pin_tenant
  ON tip_employees(tenant_id, kiosk_pin)
  WHERE kiosk_pin IS NOT NULL AND is_active = true;

-- 2. Auto-generate PINs for existing active tip employees
DO $$
DECLARE
    r RECORD;
    new_pin TEXT;
    attempts INT;
BEGIN
    FOR r IN
        SELECT id, tenant_id FROM tip_employees
        WHERE is_active = true AND kiosk_pin IS NULL
    LOOP
        attempts := 0;
        LOOP
            new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
            -- Check uniqueness within tenant across BOTH tables
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles
                WHERE tenant_id = r.tenant_id AND kiosk_pin = new_pin AND is_active = true
            ) AND NOT EXISTS (
                SELECT 1 FROM tip_employees
                WHERE tenant_id = r.tenant_id AND kiosk_pin = new_pin AND is_active = true
            ) THEN
                UPDATE tip_employees SET kiosk_pin = new_pin WHERE id = r.id;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END LOOP;
END $$;

-- 3. Add tip_employee_id and employee_name to time_clock_entries
-- employee_id stays for user_profile employees; tip_employee_id for tip-only employees
ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS tip_employee_id UUID REFERENCES tip_employees(id);
ALTER TABLE time_clock_entries ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE time_clock_entries ALTER COLUMN employee_id DROP NOT NULL;

-- 4. Backfill employee_name for existing entries
UPDATE time_clock_entries tce
SET employee_name = up.full_name
FROM user_profiles up
WHERE tce.employee_id = up.id AND tce.employee_name IS NULL;

-- 5. Same columns on time_clock_breaks (tip_employee_id not needed, just inherits from entry)
-- No changes needed for breaks table

-- 6. Update RLS to allow reading tip employee entries
-- The existing SELECT policy uses can_read_tenant_data(tenant_id) which works for both
-- The INSERT policy checks employee_id = auth.uid() which is for authenticated users only
-- Kiosk inserts bypass RLS via server-side Drizzle, so no RLS changes needed
