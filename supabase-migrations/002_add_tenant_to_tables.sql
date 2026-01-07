-- =====================================================
-- ADD TENANT_ID TO EXISTING TABLES
-- Run this AFTER 001_multi_tenant_schema.sql
-- =====================================================

-- Default tenant ID for existing data
-- This assigns all current data to Erwin Mills
DO $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

    -- Add tenant_id to ingredients table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ingredients' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE ingredients ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE ingredients SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE ingredients ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON ingredients(tenant_id);
    END IF;

    -- Add tenant_id to ingredient_categories table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ingredient_categories' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE ingredient_categories ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE ingredient_categories SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE ingredient_categories ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_ingredient_categories_tenant ON ingredient_categories(tenant_id);
    END IF;

    -- Add tenant_id to product_categories table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_categories' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE product_categories ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE product_categories SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE product_categories ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_product_categories_tenant ON product_categories(tenant_id);
    END IF;

    -- Add tenant_id to recipes table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recipes' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE recipes ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE recipes SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE recipes ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON recipes(tenant_id);
    END IF;

    -- Add tenant_id to base_templates table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'base_templates' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE base_templates ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE base_templates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE base_templates ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_base_templates_tenant ON base_templates(tenant_id);
    END IF;

    -- Add tenant_id to overhead_settings table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overhead_settings' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE overhead_settings ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE overhead_settings SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE overhead_settings ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_overhead_settings_tenant ON overhead_settings(tenant_id);
    END IF;

    -- Add tenant_id to drink_sizes table (if not global)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drink_sizes' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE drink_sizes ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        UPDATE drink_sizes SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        ALTER TABLE drink_sizes ALTER COLUMN tenant_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_drink_sizes_tenant ON drink_sizes(tenant_id);
    END IF;

END $$;

-- =====================================================
-- NOTE: Junction/child tables inherit tenant through parent
-- recipe_ingredients -> recipe -> tenant
-- base_template_ingredients -> base_template -> tenant
-- recipe_size_pricing -> recipe -> tenant
-- recipe_size_bases -> recipe -> tenant
-- =====================================================

-- Success message
-- Tenant columns added to all tables!
-- Next: Run 003_row_level_security.sql to enable RLS
