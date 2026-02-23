-- =====================================================
-- RETAIL LABELS FOR COFFEE ORDERS
-- Adds retail_labels JSONB column to coffee_order_history
-- Stores { productId: retailLabelCount } for 5lb products
-- 12oz products are always 100% retail-labeled (implicit)
-- =====================================================

ALTER TABLE coffee_order_history
  ADD COLUMN IF NOT EXISTS retail_labels JSONB DEFAULT NULL;
