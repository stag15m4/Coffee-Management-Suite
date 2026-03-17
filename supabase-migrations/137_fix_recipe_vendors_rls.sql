-- Migration 136: Fix recipe_vendors RLS policies
-- Migration 074 used auth.jwt() ->> 'tenant_id' which is never set in Supabase Auth,
-- making all RLS policies on recipe_vendors effectively broken (always deny).
-- Migration 125 partially fixed this but omitted WITH CHECK on UPDATE, which means
-- a row's tenant_id could be changed to a different tenant on update.
-- This migration drops all existing policies and recreates them correctly using
-- can_access_tenant() with proper WITH CHECK clauses.

-- Drop all existing policies (from 074 and 125)
DROP POLICY IF EXISTS "Tenants can view their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can insert their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can update their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can delete their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Platform admins manage all vendors" ON recipe_vendors;

-- SELECT: all tenant members can view their vendors
CREATE POLICY "Tenants can view their own vendors" ON recipe_vendors
    FOR SELECT USING (can_access_tenant(tenant_id));

-- INSERT: WITH CHECK ensures rows can only be created for accessible tenants
CREATE POLICY "Tenants can insert their own vendors" ON recipe_vendors
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

-- UPDATE: USING restricts which rows can be seen; WITH CHECK prevents
-- changing tenant_id to a tenant the user cannot access
CREATE POLICY "Tenants can update their own vendors" ON recipe_vendors
    FOR UPDATE
    USING (can_access_tenant(tenant_id))
    WITH CHECK (can_access_tenant(tenant_id));

-- DELETE: only rows belonging to accessible tenants can be removed
CREATE POLICY "Tenants can delete their own vendors" ON recipe_vendors
    FOR DELETE USING (can_access_tenant(tenant_id));

-- Platform admin bypass for all operations
CREATE POLICY "Platform admins manage all vendors" ON recipe_vendors
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
