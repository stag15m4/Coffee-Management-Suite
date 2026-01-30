-- =====================================================
-- ADD SALES PORTION FOOD SIZE
-- This creates a single "Sales Portion" size for food items
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, rename any existing "Standard" food sizes to "Sales Portion"
UPDATE drink_sizes 
SET name = 'Sales Portion' 
WHERE drink_type ILIKE 'food' AND name = 'Standard';

-- Get the next display order and insert for tenants that don't have a Food size
DO $$
DECLARE
  next_order INTEGER;
  tenant_rec RECORD;
BEGIN
  -- Insert a Sales Portion food size for each tenant that has drink_sizes
  FOR tenant_rec IN 
    SELECT DISTINCT tenant_id FROM drink_sizes WHERE tenant_id IS NOT NULL
  LOOP
    -- Get max display order for this tenant
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
    FROM drink_sizes WHERE tenant_id = tenant_rec.tenant_id;
    
    -- Insert Sales Portion food size if it doesn't already exist
    INSERT INTO drink_sizes (name, size_oz, display_order, drink_type, tenant_id)
    SELECT 'Sales Portion', 1, next_order, 'Food', tenant_rec.tenant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM drink_sizes 
      WHERE tenant_id = tenant_rec.tenant_id 
      AND drink_type ILIKE 'food'
    );
  END LOOP;
END $$;

-- Success message
-- A "Sales Portion" size with drink_type = 'Food' has been added/renamed for each tenant
