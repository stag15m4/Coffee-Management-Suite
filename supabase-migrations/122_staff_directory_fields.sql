-- =====================================================
-- STAFF DIRECTORY FIELDS
--
-- Adds phone, date_of_birth, and address fields to
-- user_profiles for the staff directory feature.
-- =====================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
