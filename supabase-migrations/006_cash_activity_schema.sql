-- =====================================================
-- CASH ACTIVITY TRACKING SCHEMA
-- Multi-tenant cash deposit and activity tracking
-- =====================================================

-- Create cash_activity table
CREATE TABLE IF NOT EXISTS cash_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    drawer_date DATE NOT NULL,
    gross_revenue DECIMAL(10,2) DEFAULT 0,
    starting_drawer DECIMAL(10,2) DEFAULT 200,
    cash_sales DECIMAL(10,2) DEFAULT 0,
    tip_pool DECIMAL(10,2) DEFAULT 0,
    owner_tips DECIMAL(10,2) DEFAULT 0,
    pay_in DECIMAL(10,2) DEFAULT 0,
    pay_out DECIMAL(10,2) DEFAULT 0,
    actual_deposit DECIMAL(10,2) DEFAULT 0,
    calculated_deposit DECIMAL(10,2) GENERATED ALWAYS AS (
        cash_sales - tip_pool - owner_tips - pay_out + pay_in - (200 - starting_drawer)
    ) STORED,
    notes TEXT,
    flagged BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per date per tenant
    UNIQUE(tenant_id, drawer_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_activity_tenant ON cash_activity(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_activity_date ON cash_activity(drawer_date);
CREATE INDEX IF NOT EXISTS idx_cash_activity_archived ON cash_activity(archived);

-- Enable RLS
ALTER TABLE cash_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cash_activity
CREATE POLICY "Users can view own tenant cash_activity" ON cash_activity
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers can insert cash_activity" ON cash_activity
    FOR INSERT
    WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can update cash_activity" ON cash_activity
    FOR UPDATE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    )
    WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('manager')
    );

CREATE POLICY "Managers can delete cash_activity" ON cash_activity
    FOR DELETE
    USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('manager')
    );

-- =====================================================
-- NOTES:
-- - calculated_deposit is auto-computed by PostgreSQL
-- - archived flag allows hiding old years without deleting
-- - flagged marks entries needing follow-up
-- =====================================================
