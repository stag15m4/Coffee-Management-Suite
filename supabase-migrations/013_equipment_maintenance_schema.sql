-- =====================================================
-- EQUIPMENT MAINTENANCE MODULE SCHEMA
-- Tracks equipment and maintenance tasks with time-based or usage-based intervals
-- =====================================================

-- Add the new module to the modules table
INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('equipment-maintenance', 'Equipment Maintenance', 'Track equipment maintenance schedules and history', 19.99, false, 5)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    is_premium_only = EXCLUDED.is_premium_only;

-- Add to Free Trial plan
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'equipment-maintenance')
ON CONFLICT DO NOTHING;

-- Add to Test & Eval plan
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('test_eval', 'equipment-maintenance')
ON CONFLICT DO NOTHING;

-- Add to Premium plan
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('premium', 'equipment-maintenance')
ON CONFLICT DO NOTHING;

-- =====================================================
-- EQUIPMENT TABLE
-- Stores equipment items for each tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_tenant ON equipment(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_active ON equipment(tenant_id, is_active);

-- =====================================================
-- MAINTENANCE TASKS TABLE
-- Defines maintenance tasks for each piece of equipment
-- Supports either time-based OR usage-based intervals
-- =====================================================
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Interval type: 'time' or 'usage'
    interval_type TEXT NOT NULL DEFAULT 'time' CHECK (interval_type IN ('time', 'usage')),
    
    -- Time-based interval fields (when interval_type = 'time')
    interval_days INTEGER,
    
    -- Usage-based interval fields (when interval_type = 'usage')
    interval_units INTEGER,
    usage_unit_label TEXT,
    current_usage INTEGER DEFAULT 0,
    
    -- Status tracking
    last_completed_at TIMESTAMP WITH TIME ZONE,
    next_due_at TIMESTAMP WITH TIME ZONE,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_tenant ON maintenance_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_equipment ON maintenance_tasks(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_due ON maintenance_tasks(next_due_at);

-- =====================================================
-- MAINTENANCE LOGS TABLE
-- Records when maintenance tasks are completed
-- =====================================================
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_by TEXT,
    notes TEXT,
    
    -- For usage-based: record the usage at time of maintenance
    usage_at_completion INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_tenant ON maintenance_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_task ON maintenance_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_date ON maintenance_logs(completed_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Equipment policies
CREATE POLICY "Users can view own tenant equipment" ON equipment
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can insert equipment" ON equipment
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can update equipment" ON equipment
    FOR UPDATE USING (tenant_id = get_current_tenant_id()) 
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers+ can delete equipment" ON equipment
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- Maintenance tasks policies
CREATE POLICY "Users can view own tenant tasks" ON maintenance_tasks
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can insert tasks" ON maintenance_tasks
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can update tasks" ON maintenance_tasks
    FOR UPDATE USING (tenant_id = get_current_tenant_id()) 
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers+ can delete tasks" ON maintenance_tasks
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- Maintenance logs policies
CREATE POLICY "Users can view own tenant logs" ON maintenance_logs
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can insert logs" ON maintenance_logs
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can update logs" ON maintenance_logs
    FOR UPDATE USING (tenant_id = get_current_tenant_id()) 
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers+ can delete logs" ON maintenance_logs
    FOR DELETE USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- =====================================================
-- SUCCESS
-- Run this in Supabase SQL editor
-- =====================================================
