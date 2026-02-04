-- Add start_date field to user_profiles table for tracking employee tenure
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing users with their created_at date as start_date
UPDATE user_profiles
SET start_date = created_at::date
WHERE start_date IS NULL;
