-- Migration 162: Tax-inclusive menu pricing
--
-- Some tenants price their menu board in round, tax-inclusive numbers
-- (e.g. a flat $5.00 that already has sales tax baked in) rather than
-- entering a pre-tax price and letting a POS add tax at checkout. Left
-- alone, every Menu Pricing margin/profit calculation treats that full
-- $5.00 as real revenue — but the tax portion is collected on the
-- customer's behalf and owed to the state, not earned by the business,
-- so leaving it in overstates margin.
--
-- Lives on overhead_settings, which is already one row per tenant (and
-- per child location within a multi-location tenant) — the natural place
-- for a setting that can vary location to location, since sales tax
-- itself is often set at the municipality/county level.

ALTER TABLE overhead_settings ADD COLUMN IF NOT EXISTS prices_include_tax BOOLEAN DEFAULT false;
-- Decimal fraction (0.0825 for 8.25%), not a whole percentage.
ALTER TABLE overhead_settings ADD COLUMN IF NOT EXISTS sales_tax_rate NUMERIC(6, 4) DEFAULT 0;
