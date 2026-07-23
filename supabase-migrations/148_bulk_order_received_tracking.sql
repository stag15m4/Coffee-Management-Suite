-- 148: Outstanding bulk-order tracking
-- An order is "outstanding" when sent_to_vendor = true and received_at IS NULL.
-- Marked received from the Bulk Ordering page; shown on the shop dashboard.

ALTER TABLE coffee_order_history ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Fast dashboard lookup of open orders
CREATE INDEX IF NOT EXISTS idx_coffee_history_outstanding
  ON coffee_order_history(tenant_id, order_date DESC)
  WHERE sent_to_vendor = true AND received_at IS NULL;
