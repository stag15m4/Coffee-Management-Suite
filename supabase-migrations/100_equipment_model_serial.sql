-- Add model and serial_number fields to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS serial_number TEXT;
