-- QuickBooks Online integration — OAuth tokens stored on tenants table
-- Follows same pattern as Square integration (migration 098)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qbo_realm_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qbo_access_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qbo_refresh_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qbo_token_expires_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qbo_connected_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qbo_last_sync_at TIMESTAMPTZ;
