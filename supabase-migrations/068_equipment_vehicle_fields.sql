-- Add vehicle-specific fields to equipment table
-- These fields are only relevant when the equipment category is "Vehicle"
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS license_state TEXT,
  ADD COLUMN IF NOT EXISTS license_plate TEXT,
  ADD COLUMN IF NOT EXISTS vin TEXT;
