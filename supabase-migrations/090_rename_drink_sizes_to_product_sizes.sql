-- Rename drink_sizes to product_sizes for multi-vertical support.
-- Coffee shops use ounces, pizza shops use inches, etc.

-- 1. Rename table
ALTER TABLE drink_sizes RENAME TO product_sizes;

-- 2. Rename columns to be vertical-neutral
ALTER TABLE product_sizes RENAME COLUMN size_oz TO size_value;
ALTER TABLE product_sizes RENAME COLUMN drink_type TO product_type;

-- 3. Add unit column (existing rows default to 'oz' for backward compat)
ALTER TABLE product_sizes ADD COLUMN size_unit TEXT NOT NULL DEFAULT 'oz';

-- 4. Set Pompeii Pizza food sizes to inches
UPDATE product_sizes SET size_unit = 'in'
WHERE tenant_id = '90b638eb-aa80-4cdd-b1a9-445154369026'
  AND product_type = 'Food';

-- 5. Slice and bulk entries use count, not inches
UPDATE product_sizes SET size_unit = 'count'
WHERE tenant_id = '90b638eb-aa80-4cdd-b1a9-445154369026'
  AND (name ILIKE '%slice%' OR name ILIKE '%bulk%');

-- 6. Rename index
ALTER INDEX IF EXISTS idx_drink_sizes_tenant RENAME TO idx_product_sizes_tenant;

-- 7. Recreate RLS policies on new table name
DROP POLICY IF EXISTS "Allow authenticated users to read drink_sizes" ON product_sizes;
CREATE POLICY "Allow authenticated users to read product_sizes" ON product_sizes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert drink_sizes" ON product_sizes;
CREATE POLICY "Allow authenticated users to insert product_sizes" ON product_sizes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete drink_sizes" ON product_sizes;
CREATE POLICY "Allow authenticated users to delete product_sizes" ON product_sizes
  FOR DELETE USING (auth.uid() IS NOT NULL);
