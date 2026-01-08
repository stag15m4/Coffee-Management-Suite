-- =====================================================
-- TIP PAYOUT CALCULATOR SCHEMA
-- Multi-tenant tip distribution tracking
-- =====================================================

-- Create tip_employees table (employees who receive tips)
CREATE TABLE IF NOT EXISTS tip_employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one employee name per tenant
    UNIQUE(tenant_id, name)
);

-- Create tip_weekly_data table (weekly tip totals)
CREATE TABLE IF NOT EXISTS tip_weekly_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    week_key DATE NOT NULL, -- Monday of the week
    cash_tips DECIMAL(10,2) DEFAULT 0,
    cc_tips DECIMAL(10,2) DEFAULT 0,
    cash_entries JSONB DEFAULT '[]'::jsonb, -- Array of 7 daily values
    cc_entries JSONB DEFAULT '[]'::jsonb, -- Array of 7 daily values
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per week per tenant
    UNIQUE(tenant_id, week_key)
);

-- Create tip_employee_hours table (hours per employee per week)
CREATE TABLE IF NOT EXISTS tip_employee_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES tip_employees(id) ON DELETE CASCADE,
    week_key DATE NOT NULL, -- Monday of the week
    hours DECIMAL(6,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per employee per week
    UNIQUE(employee_id, week_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tip_employees_tenant ON tip_employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tip_weekly_data_tenant ON tip_weekly_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tip_weekly_data_week ON tip_weekly_data(week_key);
CREATE INDEX IF NOT EXISTS idx_tip_employee_hours_tenant ON tip_employee_hours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tip_employee_hours_week ON tip_employee_hours(week_key);
CREATE INDEX IF NOT EXISTS idx_tip_employee_hours_employee ON tip_employee_hours(employee_id);

-- Enable RLS
ALTER TABLE tip_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_weekly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_employee_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tip_employees
CREATE POLICY "Users can view own tenant tip_employees" ON tip_employees
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Leads can insert tip_employees" ON tip_employees
    FOR INSERT
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Leads can update tip_employees" ON tip_employees
    FOR UPDATE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Managers can delete tip_employees" ON tip_employees
    FOR DELETE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- RLS Policies for tip_weekly_data
CREATE POLICY "Users can view own tenant tip_weekly_data" ON tip_weekly_data
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Leads can insert tip_weekly_data" ON tip_weekly_data
    FOR INSERT
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Leads can update tip_weekly_data" ON tip_weekly_data
    FOR UPDATE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Managers can delete tip_weekly_data" ON tip_weekly_data
    FOR DELETE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- RLS Policies for tip_employee_hours
CREATE POLICY "Users can view own tenant tip_employee_hours" ON tip_employee_hours
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Leads can insert tip_employee_hours" ON tip_employee_hours
    FOR INSERT
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Leads can update tip_employee_hours" ON tip_employee_hours
    FOR UPDATE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('lead')
    );

CREATE POLICY "Managers can delete tip_employee_hours" ON tip_employee_hours
    FOR DELETE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- =====================================================
-- NOTES:
-- - week_key is always the Monday of the week
-- - CC tips are reduced by 3.5% fee in frontend calculations
-- - hours stored as decimal (e.g., 8.5 for 8h 30m)
-- - Leads can access this module, Managers/Owners can delete
-- =====================================================
