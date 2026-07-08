-- 145: Add daily transaction count to cash activity
-- Number of transactions rung up that day, entered with the daily numbers.
-- Nullable — historical rows stay NULL unless backfilled.

ALTER TABLE cash_activity ADD COLUMN IF NOT EXISTS transaction_count INTEGER;

COMMENT ON COLUMN cash_activity.transaction_count IS 'Number of transactions for the day (optional, entered with daily numbers)';
