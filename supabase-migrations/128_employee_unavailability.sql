-- Employee Unavailability: employees flag dates/times they can't work.
-- No approval needed — just visibility for managers when building schedules.

CREATE TABLE IF NOT EXISTS employee_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME DEFAULT NULL,          -- only if not all_day
  end_time TIME DEFAULT NULL,            -- only if not all_day
  reason TEXT,                           -- optional note ("class", "appointment", etc.)
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_day INTEGER DEFAULT NULL,   -- 0=Sun..6=Sat, for weekly recurring
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_unavail_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_unavail_tenant ON employee_unavailability(tenant_id);
CREATE INDEX idx_unavail_employee ON employee_unavailability(employee_id);
CREATE INDEX idx_unavail_dates ON employee_unavailability(start_date, end_date);

ALTER TABLE employee_unavailability ENABLE ROW LEVEL SECURITY;

-- Everyone in tenant can see all unavailability (needed for schedule visibility)
CREATE POLICY "unavail_select" ON employee_unavailability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = employee_unavailability.tenant_id
        AND uta.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Employees can insert their own unavailability
CREATE POLICY "unavail_insert" ON employee_unavailability
  FOR INSERT WITH CHECK (
    (employee_id = auth.uid() AND EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = employee_unavailability.tenant_id
        AND uta.user_id = auth.uid()
    ))
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Employees can update their own; managers can update any
CREATE POLICY "unavail_update" ON employee_unavailability
  FOR UPDATE USING (
    (employee_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = employee_unavailability.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );

-- Employees can delete their own; managers can delete any
CREATE POLICY "unavail_delete" ON employee_unavailability
  FOR DELETE USING (
    (employee_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_tenant_assignments uta
      WHERE uta.tenant_id = employee_unavailability.tenant_id
        AND uta.user_id = auth.uid()
        AND uta.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
  );
