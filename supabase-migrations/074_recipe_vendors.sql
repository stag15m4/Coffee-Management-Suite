-- Create recipe_vendors table for vendor contact management
-- Replaces the denormalized text vendor field on ingredients
CREATE TABLE IF NOT EXISTS recipe_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE recipe_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own vendors"
  ON recipe_vendors FOR SELECT
  USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenants can insert their own vendors"
  ON recipe_vendors FOR INSERT
  WITH CHECK (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenants can update their own vendors"
  ON recipe_vendors FOR UPDATE
  USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenants can delete their own vendors"
  ON recipe_vendors FOR DELETE
  USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- Add vendor_id FK to ingredients (nullable — existing rows keep text vendor)
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES recipe_vendors(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_recipe_vendors_tenant ON recipe_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_vendor_id ON ingredients(vendor_id);
