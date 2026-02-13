-- Fix category unique constraints to be tenant-scoped (not global)
-- Previously, ingredient_categories.name had a global unique constraint,
-- preventing different tenants from having categories with the same name (e.g. "Sauce").

ALTER TABLE ingredient_categories DROP CONSTRAINT IF EXISTS ingredient_categories_name_key;
ALTER TABLE ingredient_categories
  ADD CONSTRAINT ingredient_categories_name_tenant_key UNIQUE (name, tenant_id);

ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_name_key;
ALTER TABLE product_categories
  ADD CONSTRAINT product_categories_name_tenant_key UNIQUE (name, tenant_id);

-- Seed pizza-appropriate categories for Pompeii Pizza
INSERT INTO product_categories (name, display_order, tenant_id) VALUES
  ('Pizzas',              1, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Calzones & Stromboli',2, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Pasta',               3, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Appetizers',          4, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Salads',              5, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Subs & Sandwiches',   6, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Desserts',            7, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Beverages',           8, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Sides',               9, '90b638eb-aa80-4cdd-b1a9-445154369026')
ON CONFLICT DO NOTHING;

INSERT INTO ingredient_categories (name, display_order, tenant_id) VALUES
  ('Dough & Flour',    1, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Cheese',           2, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Sauce',            3, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Meats',            4, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Vegetables',       5, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Herbs & Spices',   6, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Oils & Vinegar',   7, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Seafood',          8, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Pasta & Grains',   9, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Supplies',        10, '90b638eb-aa80-4cdd-b1a9-445154369026')
ON CONFLICT DO NOTHING;
