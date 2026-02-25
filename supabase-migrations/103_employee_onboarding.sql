-- =====================================================
-- EMPLOYEE ONBOARDING PROGRESS
--
-- Per-user onboarding state for non-owner roles.
-- Tracks welcome card dismissal and module intro nudges.
-- =====================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{}';
