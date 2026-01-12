-- =====================================================
-- ALLOW OWNERS AND MANAGERS TO CREATE USERS
-- Run this AFTER 009_fix_user_profile_read.sql
-- =====================================================
-- Problem: Migration 009 removed insert policies for user_profiles,
-- so owners/managers cannot create new team members from the app.
--
-- Solution: Add INSERT policy for owners and managers to create users
-- in their own tenant with equal or lower role level.
-- =====================================================

-- POLICY: Owners and Managers can insert new users in their tenant
-- Uses a subquery to check current user's tenant and role
CREATE POLICY "Owners and managers can insert users in their tenant" ON user_profiles
    FOR INSERT
    WITH CHECK (
        -- The new user must be in the same tenant as the current user
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (
            -- Owners can create any role
            (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'owner'
            OR (
                -- Managers can create managers, leads, or employees (not owners)
                (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'manager'
                AND role IN ('manager', 'lead', 'employee')
            )
        )
    );

-- POLICY: Owners and Managers can read all profiles in their tenant
-- This allows the admin-users page to list all team members
CREATE POLICY "Owners and managers can read tenant profiles" ON user_profiles
    FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (
            (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('owner', 'manager')
        )
    );

-- POLICY: Owners and Managers can update users in their tenant
-- Owners can update anyone, managers cannot update owners
CREATE POLICY "Owners and managers can update tenant users" ON user_profiles
    FOR UPDATE
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (
            (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'owner'
            OR (
                (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'manager'
                AND role != 'owner'
            )
        )
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- User creation enabled for owners and managers!
-- Owners can create any role.
-- Managers can create managers, leads, or employees.
