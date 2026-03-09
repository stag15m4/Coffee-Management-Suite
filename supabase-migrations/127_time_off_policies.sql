-- Time-Off Policies: tenant-configurable PTO accrual and balance tracking
-- Supports: none, accrual (hours-per-hours-worked), fixed annual, milestone-based

-- ─── POLICIES TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_off_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- e.g. "Standard PTO", "Sick Leave"
  policy_type TEXT NOT NULL DEFAULT 'none'
    CHECK (policy_type IN ('none', 'accrual', 'fixed_annual', 'milestone')),
  categories TEXT[] NOT NULL DEFAULT '{vacation}',  -- which time_off_request categories this covers
  -- Accrual: earn `accrual_hours` per `accrual_per_hours_worked` hours worked
  accrual_hours DECIMAL(8,2) DEFAULT 0,
  accrual_per_hours_worked DECIMAL(8,2) DEFAULT 0,
  -- Fixed annual: granted upfront or per pay period
  annual_hours DECIMAL(8,2) DEFAULT 0,
  grant_method TEXT DEFAULT 'upfront'
    CHECK (grant_method IN ('upfront', 'per_pay_period')),
  -- Milestone tiers (JSON array): [{"after_months": 12, "accrual_hours": 1, "accrual_per_hours_worked": 15}]
  milestone_tiers JSONB DEFAULT '[]'::jsonb,
  -- Caps & carryover
  max_balance_hours DECIMAL(8,2) DEFAULT NULL,       -- NULL = no cap
  carryover_type TEXT DEFAULT 'none'
    CHECK (carryover_type IN ('none', 'unlimited', 'capped')),
  carryover_max_hours DECIMAL(8,2) DEFAULT 0,
  -- Waiting period before accrual starts
  waiting_period_days INTEGER DEFAULT 0,
  -- Which roles can receive this policy (empty = all roles)
  eligible_roles TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_off_policies_tenant ON time_off_policies(tenant_id);

ALTER TABLE time_off_policies ENABLE ROW LEVEL SECURITY;

-- Everyone in the tenant can see policies
CREATE POLICY "time_off_policies_select" ON time_off_policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_policies.tenant_id
        AND uta.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Only managers+ can manage policies
CREATE POLICY "time_off_policies_insert" ON time_off_policies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_policies.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "time_off_policies_update" ON time_off_policies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_policies.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "time_off_policies_delete" ON time_off_policies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_policies.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );


-- ─── BALANCES TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_off_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES time_off_policies(id) ON DELETE CASCADE,
  balance_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  used_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  pending_hours DECIMAL(10,2) NOT NULL DEFAULT 0,   -- hours in pending requests
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, employee_id, policy_id, year)
);

CREATE INDEX idx_time_off_balances_tenant ON time_off_balances(tenant_id);
CREATE INDEX idx_time_off_balances_employee ON time_off_balances(employee_id);

ALTER TABLE time_off_balances ENABLE ROW LEVEL SECURITY;

-- Employees see their own balances, managers see all in tenant
CREATE POLICY "time_off_balances_select" ON time_off_balances
  FOR SELECT USING (
    (employee_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_balances.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager', 'lead')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Only managers+ can insert/update balances (accrual system writes these)
CREATE POLICY "time_off_balances_insert" ON time_off_balances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_balances.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "time_off_balances_update" ON time_off_balances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_balances.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "time_off_balances_delete" ON time_off_balances
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_balances.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );


-- ─── ACCRUAL LOG TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_off_accrual_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES time_off_policies(id) ON DELETE CASCADE,
  balance_id UUID NOT NULL REFERENCES time_off_balances(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('accrual', 'usage', 'adjustment', 'carryover', 'grant', 'pending', 'pending_release')),
  hours DECIMAL(10,2) NOT NULL,           -- positive = credit, negative = debit
  description TEXT,                        -- e.g. "Accrual for pay period 2026-03-01 to 2026-03-14"
  reference_id UUID DEFAULT NULL,          -- FK to timesheet_approvals or time_off_requests
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accrual_log_tenant ON time_off_accrual_log(tenant_id);
CREATE INDEX idx_accrual_log_employee ON time_off_accrual_log(employee_id);
CREATE INDEX idx_accrual_log_balance ON time_off_accrual_log(balance_id);

ALTER TABLE time_off_accrual_log ENABLE ROW LEVEL SECURITY;

-- Employees see their own log, managers see all
CREATE POLICY "time_off_accrual_log_select" ON time_off_accrual_log
  FOR SELECT USING (
    (employee_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_accrual_log.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager', 'lead')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Only managers+ can insert log entries
CREATE POLICY "time_off_accrual_log_insert" ON time_off_accrual_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = time_off_accrual_log.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Log entries are immutable (no update/delete policies)
