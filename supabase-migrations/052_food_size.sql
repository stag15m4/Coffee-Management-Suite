-- =====================================================
-- ADD STANDARD FOOD SIZE
-- This creates a single "Standard" size for food items
-- Run this in Supabase SQL Editor
-- =====================================================

-- Get the next display order
DO $$
DECLARE
  next_order INTEGER;
  tenant_rec RECORD;
BEGIN
  -- Insert a Standard food size for each tenant that has drink_sizes
  FOR tenant_rec IN 
    SELECT DISTINCT tenant_id FROM drink_sizes WHERE tenant_id IS NOT NULL
  LOOP
    -- Get max display order for this tenant
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
    FROM drink_sizes WHERE tenant_id = tenant_rec.tenant_id;
    
    -- Insert Standard food size if it doesn't already exist
    INSERT INTO drink_sizes (name, size_oz, display_order, drink_type, tenant_id)
    SELECT 'Standard', 1, next_order, 'Food', tenant_rec.tenant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM drink_sizes 
      WHERE tenant_id = tenant_rec.tenant_id 
      AND drink_type ILIKE 'food'
    );
  END LOOP;
END $$;

-- Success message
-- A "Standard" size with drink_type = 'Food' has been added for each tenant
