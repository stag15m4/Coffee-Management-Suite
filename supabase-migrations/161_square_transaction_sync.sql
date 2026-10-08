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
--
-- square_transactions_sync_watermark is the oldest date the sync still
-- needs to retry (a day with no cash_activity row yet to attach a count
-- to). It only advances past a given day once that day actually has a row
-- to update, so a backlog of un-logged cash deposit days — the normal
-- state of affairs for an owner who's behind on data entry — never falls
-- permanently out of range just because it's more than a few days old.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_transactions_last_sync_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_transactions_sync_watermark DATE;
