-- =====================================================
-- CALENDAR & WORKFORCE MODULE SCHEMA
-- Employee scheduling, time-off, time clock, and payroll
-- =====================================================

-- 1. ENUM types
DO $$ BEGIN
    CREATE TYPE shift_status AS ENUM ('draft', 'published', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE time_off_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE time_off_category AS ENUM ('vacation', 'sick', 'personal', 'bereavement', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Shifts table (scheduled shifts)
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position TEXT,
    notes TEXT,
    status shift_status NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_date ON shifts(tenant_id, date);

-- 3. Shift templates (weekly recurring patterns)
CREATE TABLE IF NOT EXISTS shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    position TEXT,
    employee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_tenant ON shift_templates(tenant_id);

-- 4. Time-off requests
CREATE TABLE IF NOT EXISTS time_off_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    category time_off_category NOT NULL DEFAULT 'personal',
    reason TEXT,
    status time_off_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_time_off_tenant ON time_off_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_off_employee ON time_off_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_off_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_dates ON time_off_requests(start_date, end_date);

-- 5. Time clock entries (clock in/out)
CREATE TABLE IF NOT EXISTS time_clock_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    notes TEXT,
    is_edited BOOLEAN DEFAULT false,
    edited_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_tenant ON time_clock_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_employee ON time_clock_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_in ON time_clock_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_time_clock_tenant_date ON time_clock_entries(tenant_id, clock_in);

-- 6. Time clock breaks
CREATE TABLE IF NOT EXISTS time_clock_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    time_clock_entry_id UUID NOT NULL REFERENCES time_clock_entries(id) ON DELETE CASCADE,
    break_start TIMESTAMPTZ NOT NULL,
    break_end TIMESTAMPTZ,
    break_type TEXT DEFAULT 'break',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breaks_entry ON time_clock_breaks(time_clock_entry_id);
CREATE INDEX IF NOT EXISTS idx_breaks_tenant ON time_clock_breaks(tenant_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- SHIFTS RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shifts" ON shifts
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Leads can create shifts" ON shifts
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead'::user_role)
    );

CREATE POLICY "Leads can update shifts" ON shifts
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead'::user_role)
    ) WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('lead'::user_role)
    );

CREATE POLICY "Managers can delete shifts" ON shifts
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Platform admins manage shifts" ON shifts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- SHIFT TEMPLATES RLS
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shift templates" ON shift_templates
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Managers can create shift templates" ON shift_templates
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Managers can update shift templates" ON shift_templates
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    ) WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Managers can delete shift templates" ON shift_templates
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Platform admins manage shift templates" ON shift_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- TIME OFF REQUESTS RLS
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view time off requests" ON time_off_requests
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Employees can request time off" ON time_off_requests
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND employee_id = auth.uid()
    );

CREATE POLICY "Employees and leads can update time off" ON time_off_requests
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND (
            employee_id = auth.uid()
            OR has_role_or_higher('lead'::user_role)
        )
    ) WITH CHECK (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Employees can delete own pending requests" ON time_off_requests
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND (
            (employee_id = auth.uid() AND status = 'pending')
            OR has_role_or_higher('manager'::user_role)
        )
    );

CREATE POLICY "Platform admins manage time off" ON time_off_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- TIME CLOCK ENTRIES RLS
ALTER TABLE time_clock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view time clock entries" ON time_clock_entries
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Employees can clock in" ON time_clock_entries
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND employee_id = auth.uid()
    );

CREATE POLICY "Employees and managers can update clock entries" ON time_clock_entries
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND (
            employee_id = auth.uid()
            OR has_role_or_higher('manager'::user_role)
        )
    ) WITH CHECK (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Managers can delete clock entries" ON time_clock_entries
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Platform admins manage time clock" ON time_clock_entries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- TIME CLOCK BREAKS RLS
ALTER TABLE time_clock_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view breaks" ON time_clock_breaks
    FOR SELECT USING (can_read_tenant_data(tenant_id));

CREATE POLICY "Employees can manage breaks" ON time_clock_breaks
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Employees can update breaks" ON time_clock_breaks
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
    );

CREATE POLICY "Managers can delete breaks" ON time_clock_breaks
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager'::user_role)
    );

CREATE POLICY "Platform admins manage breaks" ON time_clock_breaks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- MODULE REGISTRATION
-- =====================================================

INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('calendar-workforce', 'Calendar & Workforce', 'Employee scheduling, time-off management, time clock, and payroll export', 19.99, false, 7)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price;

-- Enable for free trial, test & eval, and premium plans
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'calendar-workforce'),
    ('test_eval', 'calendar-workforce'),
    ('premium', 'calendar-workforce')
ON CONFLICT DO NOTHING;
