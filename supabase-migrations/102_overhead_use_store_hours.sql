-- =====================================================
-- SYNC OVERHEAD OPERATING HOURS FROM STORE PROFILE
--
-- Adds use_store_hours flag to overhead_settings so the
-- recipe costing calculation can auto-derive days/week
-- and hours/day from store_operating_hours.
--
-- Existing tenants keep their manual values (false).
-- New tenants default to auto (true).
-- =====================================================

ALTER TABLE overhead_settings ADD COLUMN IF NOT EXISTS use_store_hours BOOLEAN DEFAULT true;

-- Preserve existing manual values for current tenants
UPDATE overhead_settings SET use_store_hours = false WHERE id IS NOT NULL;
