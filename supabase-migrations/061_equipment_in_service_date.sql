-- Add in_service_date to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS in_service_date DATE;
