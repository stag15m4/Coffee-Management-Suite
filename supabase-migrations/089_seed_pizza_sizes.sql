-- Seed pizza-appropriate recipe sizes for Pompeii Pizza
-- Without sizes, the recipe ingredient UI has nothing to loop over,
-- so the "Add Ingredient" form never renders.

INSERT INTO drink_sizes (name, size_oz, drink_type, display_order, tenant_id) VALUES
  ('Personal 10"',     10, 'Food', 1, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Medium 14"',       14, 'Food', 2, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Large 18"',        18, 'Food', 3, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('By the Slice',      2, 'Food', 4, '90b638eb-aa80-4cdd-b1a9-445154369026'),
  ('Bulk Dough Batch',  0, 'bulk', 5, '90b638eb-aa80-4cdd-b1a9-445154369026')
ON CONFLICT DO NOTHING;
