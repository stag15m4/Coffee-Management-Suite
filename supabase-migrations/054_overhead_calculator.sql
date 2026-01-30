-- Migration 054: Overhead Calculator
-- Adds operating_days_per_week to overhead_settings
-- Creates overhead_items table for custom overhead line items

-- Add operating_days_per_week to overhead_settings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overhead_settings' AND column_name = 'operating_days_per_week'
    ) THEN
        ALTER TABLE overhead_settings ADD COLUMN operating_days_per_week INTEGER DEFAULT 7;
    END IF;
END $$;

-- Create overhead_items table for custom overhead line items
CREATE TABLE IF NOT EXISTS overhead_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for tenant_id
CREATE INDEX IF NOT EXISTS idx_overhead_items_tenant ON overhead_items(tenant_id);

-- Enable RLS
ALTER TABLE overhead_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their tenant overhead items" ON overhead_items;
DROP POLICY IF EXISTS "Users can insert overhead items for their tenant" ON overhead_items;
DROP POLICY IF EXISTS "Users can update their tenant overhead items" ON overhead_items;
DROP POLICY IF EXISTS "Users can delete their tenant overhead items" ON overhead_items;

-- Create RLS policies
CREATE POLICY "Users can view their tenant overhead items"
    ON overhead_items FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()
        )
        OR
        tenant_id IN (
            SELECT id FROM tenants WHERE parent_tenant_id IN (
                SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert overhead items for their tenant"
    ON overhead_items FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their tenant overhead items"
    ON overhead_items FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their tenant overhead items"
    ON overhead_items FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()
        )
    );
