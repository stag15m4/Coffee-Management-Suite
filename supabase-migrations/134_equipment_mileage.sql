-- Add mileage tracking for vehicles
-- current_mileage on equipment: the latest known odometer reading
-- mileage_at_completion on maintenance_logs: odometer at time of service

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS current_mileage integer;

ALTER TABLE maintenance_logs
  ADD COLUMN IF NOT EXISTS mileage_at_completion integer;
