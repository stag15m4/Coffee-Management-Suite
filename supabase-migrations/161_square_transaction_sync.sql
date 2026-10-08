-- Migration 161: Square transaction count auto-sync
--
-- Adds a dedicated last-sync marker for pulling daily transaction counts
-- from Square's Orders API, separate from square_last_sync_at (which
-- tracks the existing timecard/shift sync) so the two syncs' incremental
-- windows don't interfere with each other.
--
-- This feeds cash_activity.transaction_count (migration 145) automatically
-- instead of requiring manual entry, which in turn feeds the "Actual
-- Volume" overhead costing added in migration 160.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_transactions_last_sync_at TIMESTAMPTZ;
