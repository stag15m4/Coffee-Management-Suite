-- 119: Auto-generate kiosk codes for all tenants
-- Every tenant should have a kiosk_code so the store profile page can display it

-- Generate 6-character alphanumeric codes for existing tenants that lack one
DO $$
DECLARE
    r RECORD;
    new_code TEXT;
    attempts INT;
BEGIN
    FOR r IN
        SELECT id FROM tenants WHERE kiosk_code IS NULL
    LOOP
        attempts := 0;
        LOOP
            -- Generate a 6-char uppercase alphanumeric code
            new_code := UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
            IF NOT EXISTS (
                SELECT 1 FROM tenants WHERE UPPER(kiosk_code) = new_code
            ) THEN
                UPDATE tenants SET kiosk_code = new_code WHERE id = r.id;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END LOOP;
END $$;

-- Trigger to auto-generate kiosk_code for new tenants
CREATE OR REPLACE FUNCTION generate_kiosk_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    attempts INT := 0;
BEGIN
    IF NEW.kiosk_code IS NULL THEN
        LOOP
            new_code := UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
            IF NOT EXISTS (
                SELECT 1 FROM tenants WHERE UPPER(kiosk_code) = new_code AND id != NEW.id
            ) THEN
                NEW.kiosk_code := new_code;
                EXIT;
            END IF;
            attempts := attempts + 1;
            IF attempts > 100 THEN EXIT; END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_kiosk_code ON tenants;
CREATE TRIGGER trg_generate_kiosk_code
    BEFORE INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION generate_kiosk_code();
