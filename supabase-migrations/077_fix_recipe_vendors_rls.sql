-- Fix RLS policies on recipe_vendors to use the correct tenant lookup pattern.
-- The original policies used auth.jwt() ->> 'tenant_id' which doesn't exist
-- in the JWT. All other tables use a subquery on user_profiles.

DROP POLICY IF EXISTS "Tenants can view their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can insert their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can update their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can delete their own vendors" ON recipe_vendors;

CREATE POLICY "Tenants can view their own vendors"
  ON recipe_vendors FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Tenants can insert their own vendors"
  ON recipe_vendors FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Tenants can update their own vendors"
  ON recipe_vendors FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Tenants can delete their own vendors"
  ON recipe_vendors FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
