-- Add per-tenant starting drawer default
-- Each location (child tenant) can have its own default starting drawer amount
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS starting_drawer_default DECIMAL(10,2) DEFAULT 200;
