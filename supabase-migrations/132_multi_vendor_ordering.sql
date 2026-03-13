-- =====================================================
-- MULTI-VENDOR BULK ORDERING
-- =====================================================
-- Changes:
-- 1. Remove UNIQUE(tenant_id) on tenant_coffee_vendors so tenants can have multiple vendors
-- 2. Add supports_retail_labels flag to tenant_coffee_vendors (false for non-coffee vendors)
-- 3. Add vendor_id FK to tenant_coffee_products (link products to a vendor)
-- 4. Add vendor_id FK to coffee_order_history (link orders to a vendor)
-- 5. Backfill vendor_id on existing products and orders
-- =====================================================

-- 1. Drop the one-vendor-per-tenant constraint
ALTER TABLE tenant_coffee_vendors DROP CONSTRAINT IF EXISTS tenant_coffee_vendors_tenant_id_key;

-- 2. Add supports_retail_labels to vendors (existing coffee vendors default true)
ALTER TABLE tenant_coffee_vendors
  ADD COLUMN IF NOT EXISTS supports_retail_labels BOOLEAN NOT NULL DEFAULT true;

-- 3. Add vendor_id to products
ALTER TABLE tenant_coffee_products
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES tenant_coffee_vendors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_coffee_products_vendor ON tenant_coffee_products(vendor_id);

-- 4. Add vendor_id to order history
ALTER TABLE coffee_order_history
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES tenant_coffee_vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_history_vendor ON coffee_order_history(vendor_id);

-- 5. Backfill: link existing products and orders to the tenant's existing vendor
UPDATE tenant_coffee_products p
SET vendor_id = v.id
FROM tenant_coffee_vendors v
WHERE p.tenant_id = v.tenant_id
  AND p.vendor_id IS NULL;

UPDATE coffee_order_history h
SET vendor_id = v.id
FROM tenant_coffee_vendors v
WHERE h.tenant_id = v.tenant_id
  AND h.vendor_id IS NULL;

-- =====================================================
-- SUCCESS
-- Run this in Supabase SQL editor after migration 131
-- =====================================================
