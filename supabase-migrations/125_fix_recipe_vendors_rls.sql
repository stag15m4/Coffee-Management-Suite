-- Migration 125: Fix recipe_vendors RLS policies
-- Original policies used auth.jwt() ->> 'tenant_id' which trusts JWT claims
-- directly instead of using the secure can_access_tenant() helper.
-- This could allow cross-tenant data access via JWT manipulation.

DROP POLICY IF EXISTS "Tenants can view their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can insert their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can update their own vendors" ON recipe_vendors;
DROP POLICY IF EXISTS "Tenants can delete their own vendors" ON recipe_vendors;

-- SELECT: use can_access_tenant() for multi-location support
CREATE POLICY "Tenants can view their own vendors" ON recipe_vendors
    FOR SELECT USING (can_access_tenant(tenant_id));

-- INSERT: only managers+ can add vendors
CREATE POLICY "Tenants can insert their own vendors" ON recipe_vendors
    FOR INSERT WITH CHECK (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- UPDATE: only managers+ can edit vendors
CREATE POLICY "Tenants can update their own vendors" ON recipe_vendors
    FOR UPDATE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- DELETE: only managers+ can remove vendors
CREATE POLICY "Tenants can delete their own vendors" ON recipe_vendors
    FOR DELETE USING (
        can_access_tenant(tenant_id)
        AND has_role_or_higher('manager')
    );

-- Platform admin bypass
CREATE POLICY "Platform admins manage all vendors" ON recipe_vendors
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
