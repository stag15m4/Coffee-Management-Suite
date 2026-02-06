-- =====================================================
-- ADD UNIT COLUMN TO BASE_TEMPLATE_INGREDIENTS
-- Allows base template ingredients to specify a unit (oz, each, gram, etc.)
-- Run this in Supabase SQL Editor
-- =====================================================

ALTER TABLE base_template_ingredients
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'each';
