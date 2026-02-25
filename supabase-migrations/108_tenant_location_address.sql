-- Add location address and GPS geofence fields to tenants
-- Used by the mobile employee app for clock-in/out geofencing

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 100;
