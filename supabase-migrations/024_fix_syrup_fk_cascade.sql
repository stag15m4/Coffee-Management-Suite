-- =====================================================
-- FIX SYRUP RECIPE FOREIGN KEY CASCADE
-- Changes ON DELETE SET NULL to ON DELETE CASCADE
-- This prevents the check_ingredient_or_syrup constraint violation
-- =====================================================

-- Drop the existing foreign key constraint
ALTER TABLE recipe_ingredients 
DROP CONSTRAINT IF EXISTS recipe_ingredients_syrup_recipe_id_fkey;

-- Re-add with CASCADE instead of SET NULL
ALTER TABLE recipe_ingredients 
ADD CONSTRAINT recipe_ingredients_syrup_recipe_id_fkey 
FOREIGN KEY (syrup_recipe_id) 
REFERENCES recipes(id) 
ON DELETE CASCADE;

-- Verify
SELECT 'Foreign key updated to CASCADE - deleting recipes will now automatically remove their syrup references' as status;
