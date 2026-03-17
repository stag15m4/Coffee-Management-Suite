-- ============================================================================
-- 144: Time Clock Location Scoping
-- Adds location_id to time_clock_entries so multi-location tenants can
-- distinguish which child location (store) an employee clocked in at.
-- Nullable for backwards compatibility with existing entries.
-- ============================================================================

-- 1. Add location_id column referencing tenants (child location)
ALTER TABLE time_clock_entries
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- 2. Composite index for location-scoped queries
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_tenant_location_clockin
  ON time_clock_entries (tenant_id, location_id, clock_in);
