-- =====================================================
-- ADD CASCADE DELETE TO BASE_TEMPLATE_INGREDIENTS
-- This ensures ingredients are automatically deleted when a template is deleted
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop existing foreign key constraint if it exists
DO $$
BEGIN
    -- Try to drop the constraint (it may have different names)
    BEGIN
        ALTER TABLE base_template_ingredients DROP CONSTRAINT IF EXISTS base_template_ingredients_base_template_id_fkey;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        ALTER TABLE base_template_ingredients DROP CONSTRAINT IF EXISTS fk_base_template;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
END $$;

-- Add foreign key constraint with ON DELETE CASCADE
ALTER TABLE base_template_ingredients
ADD CONSTRAINT base_template_ingredients_base_template_id_fkey 
FOREIGN KEY (base_template_id) REFERENCES base_templates(id) ON DELETE CASCADE;

-- Success message
-- base_template_ingredients will now be automatically deleted when parent template is deleted
