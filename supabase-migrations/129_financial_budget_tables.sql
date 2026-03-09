-- Financial Budget & Forecast module tables
-- Supports per-location budgets with company-wide roll-up
-- Chart of Accounts imported from QuickBooks Online

-- =====================================================
-- Chart of Accounts (imported from QBO or added manually)
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_number TEXT,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('Revenue', 'COGS', 'Expense', 'Other')),
    detail_type TEXT,
    parent_id UUID REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE,
    depth INT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_coa_tenant ON budget_chart_of_accounts(tenant_id);
CREATE INDEX idx_budget_coa_parent ON budget_chart_of_accounts(tenant_id, parent_id);
CREATE INDEX idx_budget_coa_type ON budget_chart_of_accounts(tenant_id, account_type);

ALTER TABLE budget_chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_coa_select" ON budget_chart_of_accounts
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "budget_coa_insert" ON budget_chart_of_accounts
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "budget_coa_update" ON budget_chart_of_accounts
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "budget_coa_delete" ON budget_chart_of_accounts
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- =====================================================
-- Fiscal Years
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    year INT NOT NULL,
    start_month INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'locked')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, year)
);

CREATE INDEX idx_budget_fy_tenant ON budget_fiscal_years(tenant_id);

ALTER TABLE budget_fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_fy_select" ON budget_fiscal_years
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "budget_fy_insert" ON budget_fiscal_years
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "budget_fy_update" ON budget_fiscal_years
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "budget_fy_delete" ON budget_fiscal_years
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- =====================================================
-- Budget Line Items (one row per account × month)
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year_id UUID NOT NULL REFERENCES budget_fiscal_years(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES budget_chart_of_accounts(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    budget_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_amount NUMERIC(12,2),
    forecast_amount NUMERIC(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, fiscal_year_id, account_id, month)
);

CREATE INDEX idx_budget_lines_fy ON budget_line_items(tenant_id, fiscal_year_id);
CREATE INDEX idx_budget_lines_account ON budget_line_items(account_id);

ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_lines_select" ON budget_line_items
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "budget_lines_insert" ON budget_line_items
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "budget_lines_update" ON budget_line_items
    FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE POLICY "budget_lines_delete" ON budget_line_items
    FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

-- =====================================================
-- Import Logs (audit trail for CSV imports)
-- =====================================================
CREATE TABLE IF NOT EXISTS budget_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    import_type TEXT NOT NULL CHECK (import_type IN ('chart_of_accounts', 'actuals')),
    file_name TEXT NOT NULL,
    rows_imported INT NOT NULL DEFAULT 0,
    rows_skipped INT NOT NULL DEFAULT 0,
    errors JSONB,
    imported_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_import_logs_tenant ON budget_import_logs(tenant_id);

ALTER TABLE budget_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_import_logs_select" ON budget_import_logs
    FOR SELECT USING (can_access_tenant(tenant_id));

CREATE POLICY "budget_import_logs_insert" ON budget_import_logs
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
