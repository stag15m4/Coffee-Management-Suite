-- Migration 160: Actual-volume overhead costing
--
-- The existing "Overhead per Item" (Settings tab) assumes the shop makes a
-- drink every `minutes_per_drink` minutes for the ENTIRE time it's open —
-- i.e. a cost-per-minute rate amortized over total open minutes, not over
-- how many items are actually sold. At real-world volume (well under that
-- assumed full-capacity throughput), this systematically under-allocates
-- overhead to every item, overstating margin on the Menu Pricing page.
--
-- This migration adds items_per_transaction to overhead_settings, which
-- lets the app derive a real "Actual Volume" overhead-per-item rate from
-- the transaction_count already logged on Cash Deposits (migration 145),
-- instead of the assumed-full-capacity rate. Defaults to 1 (conservative:
-- treats each transaction as a single item) and is user-editable from the
-- Menu Cost Manager Settings tab.

ALTER TABLE overhead_settings ADD COLUMN IF NOT EXISTS items_per_transaction NUMERIC(6, 2) DEFAULT 1;
