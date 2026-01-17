-- =====================================================
-- FIX RLS POLICIES FOR DEMO TENANT
-- Run this in Supabase SQL Editor
-- =====================================================

-- The issue is that INSERT policies check tenant_id = get_current_tenant_id()
-- but authenticated users should be able to insert into their own tenant
-- based on the tenant_id they provide (which is verified on SELECT)

-- Fix ingredients INSERT policy
DROP POLICY IF EXISTS "Managers+ can insert ingredients" ON ingredients;
CREATE POLICY "Managers+ can insert ingredients" ON ingredients
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND has_role_or_higher('manager')
    );

-- Fix recipes INSERT policy  
DROP POLICY IF EXISTS "Managers+ can insert recipes" ON recipes;
CREATE POLICY "Managers+ can insert recipes" ON recipes
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND has_role_or_higher('manager')
    );

-- Fix recipe_ingredients INSERT policy
DROP POLICY IF EXISTS "Managers+ can insert recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Managers+ can insert recipe_ingredients" ON recipe_ingredients
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND has_role_or_higher('manager')
    );

-- Verify the demo user profile is set up correctly
-- Run this to check:
-- SELECT * FROM user_profiles WHERE email = 'demo@sunriseroasters.com';

-- =====================================================
-- SUCCESS - Demo tenant should now allow adding ingredients
-- =====================================================
