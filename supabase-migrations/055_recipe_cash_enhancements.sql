-- Migration 055: Recipe Cost Manager & Cash Deposit Enhancements

-- Add hours_open_per_day to overhead_settings for cost per minute calculation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overhead_settings' AND column_name = 'hours_open_per_day'
    ) THEN
        ALTER TABLE overhead_settings ADD COLUMN hours_open_per_day DECIMAL(4,2) DEFAULT 8;
    END IF;
END $$;

-- Update overhead_items frequency constraint to include bi-weekly
ALTER TABLE overhead_items DROP CONSTRAINT IF EXISTS overhead_items_frequency_check;
ALTER TABLE overhead_items ADD CONSTRAINT overhead_items_frequency_check 
    CHECK (frequency IN ('daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'annual'));

-- Add cash_refund field to cash_activity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cash_activity' AND column_name = 'cash_refund'
    ) THEN
        ALTER TABLE cash_activity ADD COLUMN cash_refund DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add owner_tips_enabled to overhead_settings (tenant-level setting)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overhead_settings' AND column_name = 'owner_tips_enabled'
    ) THEN
        ALTER TABLE overhead_settings ADD COLUMN owner_tips_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;
