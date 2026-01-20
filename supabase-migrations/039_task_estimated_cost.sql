-- Migration 039: Add estimated_cost field to maintenance_tasks and admin_tasks
-- This allows managers to forecast expenses by seeing approximate costs on task cards

-- Add estimated_cost to maintenance_tasks
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10, 2);

-- Add estimated_cost to admin_tasks
ALTER TABLE admin_tasks 
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN maintenance_tasks.estimated_cost IS 'Approximate cost for this maintenance task (for expense forecasting)';
COMMENT ON COLUMN admin_tasks.estimated_cost IS 'Approximate cost/budget for this administrative task (for expense forecasting)';
