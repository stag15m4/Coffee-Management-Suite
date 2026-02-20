-- =====================================================
-- BETA INVITE SUPPORT
-- Adds invited_email tracking to license_codes
-- and index for efficient beta code queries
-- =====================================================

-- Track which email a beta invite was sent to
ALTER TABLE license_codes ADD COLUMN IF NOT EXISTS invited_email TEXT;

-- Index for quickly finding beta codes
CREATE INDEX IF NOT EXISTS idx_license_codes_beta
    ON license_codes(subscription_plan, created_at DESC)
    WHERE subscription_plan = 'beta';
