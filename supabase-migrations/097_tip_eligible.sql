-- Add tip eligibility flag to tip_employees
-- Managers may not legally participate in tip pools unless specific conditions are met.
-- Default true so all existing employees remain eligible.
ALTER TABLE tip_employees ADD COLUMN IF NOT EXISTS tip_eligible BOOLEAN DEFAULT true;
