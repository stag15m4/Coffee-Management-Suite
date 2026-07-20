-- 147: Persisted Connecteam 429 circuit-breaker cooldown
-- Stored in the DB so a redeploy doesn't reset the cooldown and re-poke an
-- already-exhausted shared account quota.

ALTER TABLE connecteam_settings ADD COLUMN IF NOT EXISTS rate_limited_until TIMESTAMPTZ;
