-- 095: Kiosk PIN-based clock in/out
-- Adds kiosk_code to tenants and kiosk_pin to user_profiles
-- for shared iPad time clock kiosk

-- 1a. Add kiosk_code to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kiosk_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_kiosk_code
  ON tenants(UPPER(kiosk_code)) WHERE kiosk_code IS NOT NULL;

-- 1b. Add kiosk_pin to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS kiosk_pin TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_kiosk_pin_tenant
  ON user_profiles(tenant_id, kiosk_pin)
  WHERE kiosk_pin IS NOT NULL AND is_active = true;

-- 1c. Auto-generate PINs for existing active employees
DO $$
DECLARE
    r RECORD;
    new_pin TEXT;
    attempts INT;
BEGIN
    FOR r IN
        SELECT id, tenant_id FROM user_profiles
        WHERE is_active = true AND kiosk_pin IS NULL
    LOOP
        attempts := 0;
        LOOP
            new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles
                WHERE tenant_id = r.tenant_id AND kiosk_pin = new_pin AND is_active = true
            ) THEN
                UPDATE user_profiles SET kiosk_pin = new_pin WHERE id = r.id;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END LOOP;
END $$;

-- 1d. Trigger to auto-generate PIN for new employees
CREATE OR REPLACE FUNCTION generate_kiosk_pin()
RETURNS TRIGGER AS $$
DECLARE
    new_pin TEXT;
    attempts INT := 0;
BEGIN
    IF NEW.kiosk_pin IS NULL AND NEW.is_active = true THEN
        LOOP
            new_pin := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles
                WHERE tenant_id = NEW.tenant_id AND kiosk_pin = new_pin AND is_active = true AND id != NEW.id
            ) THEN
                NEW.kiosk_pin := new_pin;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_kiosk_pin ON user_profiles;
CREATE TRIGGER trg_generate_kiosk_pin
    BEFORE INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION generate_kiosk_pin();
