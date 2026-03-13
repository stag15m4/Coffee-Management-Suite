-- Forecast & scenario planning tables for Financial Budget module
-- Adds scenario-based forecasting, driver-based projections, and seasonal adjustments

-- =====================================================
-- Add prior_year_actual to budget_line_items
-- =====================================================
ALTER TABLE budget_line_items ADD COLUMN IF NOT EXISTS prior_year_actual NUMERIC(12,2);

-- =====================================================
-- Forecast Scenarios (e.g., "Base Case", "Optimistic")
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_forecast_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year_id UUID NOT NULL REFERENCES budget_fiscal_years(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, fiscal_year_id, name)
);

CREATE INDEX idx_forecast_scenarios_tenant ON budget_forecast_scenarios(tenant_id, fiscal_year_id);
ALTER TABLE budget_forecast_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecast_scenarios_select" ON budget_forecast_scenarios
    FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "forecast_scenarios_insert" ON budget_forecast_scenarios
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "forecast_scenarios_update" ON budget_forecast_scenarios
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "forecast_scenarios_delete" ON budget_forecast_scenarios
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- =====================================================
-- Forecast Line Items (per scenario × account × month)
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_forecast_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES budget_forecast_scenarios(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    forecast_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, scenario_id, account_id, month)
);

CREATE INDEX idx_forecast_lines_scenario ON budget_forecast_line_items(tenant_id, scenario_id);
CREATE INDEX idx_forecast_lines_account ON budget_forecast_line_items(account_id);
ALTER TABLE budget_forecast_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecast_lines_select" ON budget_forecast_line_items
    FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "forecast_lines_insert" ON budget_forecast_line_items
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "forecast_lines_update" ON budget_forecast_line_items
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "forecast_lines_delete" ON budget_forecast_line_items
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- =====================================================
-- Forecast Drivers (rules like "Payroll = 30% of Revenue")
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_forecast_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES budget_forecast_scenarios(id) ON DELETE CASCADE,
    target_account_id UUID NOT NULL REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE,
    driver_type TEXT NOT NULL CHECK (driver_type IN ('percentage_of_account', 'fixed_amount', 'growth_rate', 'per_unit')),
    source_account_id UUID REFERENCES budget_chart_of_accounts(id) ON DELETE SET NULL,
    driver_value NUMERIC(12,4) NOT NULL DEFAULT 0,
    apply_months INT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
    priority INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecast_drivers_scenario ON budget_forecast_drivers(tenant_id, scenario_id);
ALTER TABLE budget_forecast_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecast_drivers_select" ON budget_forecast_drivers
    FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "forecast_drivers_insert" ON budget_forecast_drivers
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "forecast_drivers_update" ON budget_forecast_drivers
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "forecast_drivers_delete" ON budget_forecast_drivers
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- =====================================================
-- Seasonal Patterns (named templates with 12 month weights)
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_seasonal_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    month_weights NUMERIC(5,4)[] NOT NULL DEFAULT '{1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE budget_seasonal_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasonal_patterns_select" ON budget_seasonal_patterns
    FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "seasonal_patterns_insert" ON budget_seasonal_patterns
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "seasonal_patterns_update" ON budget_seasonal_patterns
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "seasonal_patterns_delete" ON budget_seasonal_patterns
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
