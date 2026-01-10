-- =====================================================
-- Test & Eval Plan Updates + Customizable Coffee Ordering
-- =====================================================
-- Changes:
-- 1. T&E plan becomes free ($0) and unpublished
-- 2. New tables for tenant-specific coffee vendors and products
-- =====================================================

-- Add is_published column to subscription_plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;

-- Update T&E plan to be free and unpublished (only assignable by Platform Admin)
UPDATE subscription_plans 
SET monthly_price = 0, is_published = false 
WHERE id = 'test_eval';

-- =====================================================
-- TENANT COFFEE VENDORS
-- Each tenant can configure their own coffee vendor
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_coffee_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Coffee Vendor',
    contact_email TEXT,
    cc_email TEXT,
    logo_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- =====================================================
-- TENANT COFFEE PRODUCTS
-- Each tenant can define their own product catalog
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_coffee_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'default',
    default_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coffee_vendors_tenant ON tenant_coffee_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coffee_products_tenant ON tenant_coffee_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coffee_products_active ON tenant_coffee_products(tenant_id, is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- RLS for tenant_coffee_vendors
ALTER TABLE tenant_coffee_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant vendor" ON tenant_coffee_vendors;
CREATE POLICY "Users can view own tenant vendor" ON tenant_coffee_vendors
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Leads+ can manage vendor" ON tenant_coffee_vendors;
CREATE POLICY "Leads+ can manage vendor" ON tenant_coffee_vendors
    FOR ALL USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    ) WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    );

DROP POLICY IF EXISTS "Platform admins can manage all vendors" ON tenant_coffee_vendors;
CREATE POLICY "Platform admins can manage all vendors" ON tenant_coffee_vendors
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- RLS for tenant_coffee_products
ALTER TABLE tenant_coffee_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant products" ON tenant_coffee_products;
CREATE POLICY "Users can view own tenant products" ON tenant_coffee_products
    FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "Leads+ can manage products" ON tenant_coffee_products;
CREATE POLICY "Leads+ can manage products" ON tenant_coffee_products
    FOR ALL USING (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    ) WITH CHECK (
        tenant_id = get_current_tenant_id() 
        AND has_role_or_higher('lead')
    );

DROP POLICY IF EXISTS "Platform admins can manage all products" ON tenant_coffee_products;
CREATE POLICY "Platform admins can manage all products" ON tenant_coffee_products
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- =====================================================
-- MIGRATE EXISTING DATA
-- Create default vendor and products for tenants with existing coffee data
-- =====================================================

-- Create default vendor entry for tenants that have coffee prices configured
INSERT INTO tenant_coffee_vendors (tenant_id, display_name, contact_email)
SELECT DISTINCT tenant_id, 'Coffee Vendor', ''
FROM coffee_product_prices
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_coffee_vendors v WHERE v.tenant_id = coffee_product_prices.tenant_id
)
ON CONFLICT DO NOTHING;

-- Create default products for tenants (matching the original hardcoded list)
-- This inserts the default Five Star products for all tenants with existing data
INSERT INTO tenant_coffee_products (tenant_id, sku, name, size, category, default_price, display_order)
SELECT DISTINCT 
    cpp.tenant_id,
    CASE cpp.product_id
        WHEN 1 THEN 'espresso-5lb'
        WHEN 2 THEN 'double-stack-5lb'
        WHEN 3 THEN 'triple-stack-5lb'
        WHEN 4 THEN 'decaf-5lb'
        WHEN 5 THEN 'cold-brew-5lb'
        WHEN 6 THEN 'double-stack-12oz'
        WHEN 7 THEN 'triple-stack-12oz'
        WHEN 8 THEN 'decaf-12oz'
        WHEN 9 THEN 'espresso-12oz'
    END as sku,
    CASE cpp.product_id
        WHEN 1 THEN 'Espresso'
        WHEN 2 THEN 'Double Stack'
        WHEN 3 THEN 'Triple Stack'
        WHEN 4 THEN 'Decaf'
        WHEN 5 THEN 'Cold Brew'
        WHEN 6 THEN 'Double Stack'
        WHEN 7 THEN 'Triple Stack'
        WHEN 8 THEN 'Decaf'
        WHEN 9 THEN 'Espresso'
    END as name,
    CASE WHEN cpp.product_id <= 5 THEN '5lb' ELSE '12oz' END as size,
    CASE WHEN cpp.product_id <= 5 THEN '5lb' ELSE '12oz' END as category,
    cpp.price as default_price,
    cpp.product_id as display_order
FROM coffee_product_prices cpp
ON CONFLICT (tenant_id, sku) DO UPDATE SET
    default_price = EXCLUDED.default_price;

-- =====================================================
-- SUCCESS
-- Run this in Supabase SQL editor after migration 011
-- =====================================================
