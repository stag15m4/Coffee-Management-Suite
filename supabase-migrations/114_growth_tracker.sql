-- Growth Tracker: monthly revenue tracking for MoM and YoY growth analysis
-- Lives within the Cash Deposit module

-- 1. New table for monthly revenue data
CREATE TABLE IF NOT EXISTS growth_tracker_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  gross_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, year, month)
);

-- 2. Add business opening date to overhead_settings
ALTER TABLE overhead_settings
  ADD COLUMN IF NOT EXISTS growth_open_month INT,
  ADD COLUMN IF NOT EXISTS growth_open_year INT;

-- 3. RLS policies
ALTER TABLE growth_tracker_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_tracker_monthly_select"
  ON growth_tracker_monthly FOR SELECT
  USING (can_access_tenant(tenant_id));

CREATE POLICY "growth_tracker_monthly_insert"
  ON growth_tracker_monthly FOR INSERT
  WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "growth_tracker_monthly_update"
  ON growth_tracker_monthly FOR UPDATE
  USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "growth_tracker_monthly_delete"
  ON growth_tracker_monthly FOR DELETE
  USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- 4. Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_growth_tracker_monthly_tenant
  ON growth_tracker_monthly(tenant_id, year, month);

-- 5. Auto-update updated_at trigger
CREATE TRIGGER growth_tracker_monthly_updated_at
  BEFORE UPDATE ON growth_tracker_monthly
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
