-- Track when each user last logged in (for engagement/attrition monitoring)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Allow users to update their own last_login_at
-- (The existing RLS policy for user_profiles should already allow self-updates,
--  but ensure this column is covered.)
