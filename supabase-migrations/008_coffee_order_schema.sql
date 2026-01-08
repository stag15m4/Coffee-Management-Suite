-- Coffee Order Module Schema
-- Tables for product pricing and order history

-- Product Prices Table
CREATE TABLE IF NOT EXISTS coffee_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, product_id)
);

-- Coffee Order History Table
CREATE TABLE IF NOT EXISTS coffee_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '{}',
  units INTEGER NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2),
  notes TEXT,
  sent_to_vendor BOOLEAN DEFAULT FALSE,
  vendor_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coffee_prices_tenant ON coffee_product_prices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coffee_history_tenant ON coffee_order_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coffee_history_date ON coffee_order_history(order_date DESC);

-- Row Level Security
ALTER TABLE coffee_product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_order_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coffee_product_prices
CREATE POLICY "Users can view own tenant prices" ON coffee_product_prices
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Leads+ can insert prices" ON coffee_product_prices
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('lead')
  );

CREATE POLICY "Leads+ can update prices" ON coffee_product_prices
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('lead')
  ) WITH CHECK (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('lead')
  );

CREATE POLICY "Managers+ can delete prices" ON coffee_product_prices
  FOR DELETE USING (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('manager')
  );

-- RLS Policies for coffee_order_history
CREATE POLICY "Users can view own tenant orders" ON coffee_order_history
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Leads+ can insert orders" ON coffee_order_history
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('lead')
  );

CREATE POLICY "Leads+ can update orders" ON coffee_order_history
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('lead')
  ) WITH CHECK (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('lead')
  );

CREATE POLICY "Managers+ can delete orders" ON coffee_order_history
  FOR DELETE USING (
    tenant_id = get_current_tenant_id() 
    AND has_role_or_higher('manager')
  );
