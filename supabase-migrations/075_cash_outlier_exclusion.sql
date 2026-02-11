-- Add excluded_from_average flag for outlier days (festivals, events, etc.)
-- Separate from the existing "flagged" field which is for follow-up
ALTER TABLE cash_activity ADD COLUMN IF NOT EXISTS excluded_from_average BOOLEAN DEFAULT FALSE;
