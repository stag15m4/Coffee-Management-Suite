-- =====================================================
-- FIX ALL RLS POLICIES FOR ALL MODULES
-- Run this in Supabase SQL Editor to ensure all modules work
-- =====================================================

-- =====================================================
-- TIP PAYOUT MODULE
-- =====================================================

-- tip_employees table
DROP POLICY IF EXISTS "Allow authenticated users to read tip_employees" ON tip_employees;
CREATE POLICY "Allow authenticated users to read tip_employees" ON tip_employees
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert tip_employees" ON tip_employees;
CREATE POLICY "Allow authenticated users to insert tip_employees" ON tip_employees
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update tip_employees" ON tip_employees;
CREATE POLICY "Allow authenticated users to update tip_employees" ON tip_employees
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete tip_employees" ON tip_employees;
CREATE POLICY "Allow authenticated users to delete tip_employees" ON tip_employees
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- tip_weekly_data table
DROP POLICY IF EXISTS "Allow authenticated users to read tip_weekly_data" ON tip_weekly_data;
CREATE POLICY "Allow authenticated users to read tip_weekly_data" ON tip_weekly_data
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert tip_weekly_data" ON tip_weekly_data;
CREATE POLICY "Allow authenticated users to insert tip_weekly_data" ON tip_weekly_data
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update tip_weekly_data" ON tip_weekly_data;
CREATE POLICY "Allow authenticated users to update tip_weekly_data" ON tip_weekly_data
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- tip_employee_hours table
DROP POLICY IF EXISTS "Allow authenticated users to read tip_employee_hours" ON tip_employee_hours;
CREATE POLICY "Allow authenticated users to read tip_employee_hours" ON tip_employee_hours
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert tip_employee_hours" ON tip_employee_hours;
CREATE POLICY "Allow authenticated users to insert tip_employee_hours" ON tip_employee_hours
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update tip_employee_hours" ON tip_employee_hours;
CREATE POLICY "Allow authenticated users to update tip_employee_hours" ON tip_employee_hours
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete tip_employee_hours" ON tip_employee_hours;
CREATE POLICY "Allow authenticated users to delete tip_employee_hours" ON tip_employee_hours
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- CASH DEPOSIT MODULE
-- =====================================================

-- cash_activity table
DROP POLICY IF EXISTS "Allow authenticated users to read cash_activity" ON cash_activity;
CREATE POLICY "Allow authenticated users to read cash_activity" ON cash_activity
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert cash_activity" ON cash_activity;
CREATE POLICY "Allow authenticated users to insert cash_activity" ON cash_activity
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update cash_activity" ON cash_activity;
CREATE POLICY "Allow authenticated users to update cash_activity" ON cash_activity
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete cash_activity" ON cash_activity;
CREATE POLICY "Allow authenticated users to delete cash_activity" ON cash_activity
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- COFFEE ORDER MODULE
-- =====================================================

-- tenant_coffee_vendors table
DROP POLICY IF EXISTS "Allow authenticated users to read tenant_coffee_vendors" ON tenant_coffee_vendors;
CREATE POLICY "Allow authenticated users to read tenant_coffee_vendors" ON tenant_coffee_vendors
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert tenant_coffee_vendors" ON tenant_coffee_vendors;
CREATE POLICY "Allow authenticated users to insert tenant_coffee_vendors" ON tenant_coffee_vendors
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update tenant_coffee_vendors" ON tenant_coffee_vendors;
CREATE POLICY "Allow authenticated users to update tenant_coffee_vendors" ON tenant_coffee_vendors
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- tenant_coffee_products table
DROP POLICY IF EXISTS "Allow authenticated users to read tenant_coffee_products" ON tenant_coffee_products;
CREATE POLICY "Allow authenticated users to read tenant_coffee_products" ON tenant_coffee_products
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert tenant_coffee_products" ON tenant_coffee_products;
CREATE POLICY "Allow authenticated users to insert tenant_coffee_products" ON tenant_coffee_products
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update tenant_coffee_products" ON tenant_coffee_products;
CREATE POLICY "Allow authenticated users to update tenant_coffee_products" ON tenant_coffee_products
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete tenant_coffee_products" ON tenant_coffee_products;
CREATE POLICY "Allow authenticated users to delete tenant_coffee_products" ON tenant_coffee_products
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- coffee_order_history table (SKIP if doesn't exist - run 008_coffee_order_schema.sql first)
-- DROP POLICY IF EXISTS "Allow authenticated users to read coffee_order_history" ON coffee_order_history;
-- CREATE POLICY "Allow authenticated users to read coffee_order_history" ON coffee_order_history
--     FOR SELECT USING (auth.uid() IS NOT NULL);

-- DROP POLICY IF EXISTS "Allow authenticated users to insert coffee_order_history" ON coffee_order_history;
-- CREATE POLICY "Allow authenticated users to insert coffee_order_history" ON coffee_order_history
--     FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- EQUIPMENT MAINTENANCE MODULE
-- =====================================================

-- equipment table
DROP POLICY IF EXISTS "Allow authenticated users to read equipment" ON equipment;
CREATE POLICY "Allow authenticated users to read equipment" ON equipment
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert equipment" ON equipment;
CREATE POLICY "Allow authenticated users to insert equipment" ON equipment
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update equipment" ON equipment;
CREATE POLICY "Allow authenticated users to update equipment" ON equipment
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete equipment" ON equipment;
CREATE POLICY "Allow authenticated users to delete equipment" ON equipment
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- maintenance_tasks table
DROP POLICY IF EXISTS "Allow authenticated users to read maintenance_tasks" ON maintenance_tasks;
CREATE POLICY "Allow authenticated users to read maintenance_tasks" ON maintenance_tasks
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance_tasks" ON maintenance_tasks;
CREATE POLICY "Allow authenticated users to insert maintenance_tasks" ON maintenance_tasks
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update maintenance_tasks" ON maintenance_tasks;
CREATE POLICY "Allow authenticated users to update maintenance_tasks" ON maintenance_tasks
    FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to delete maintenance_tasks" ON maintenance_tasks;
CREATE POLICY "Allow authenticated users to delete maintenance_tasks" ON maintenance_tasks
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- maintenance_logs table
DROP POLICY IF EXISTS "Allow authenticated users to read maintenance_logs" ON maintenance_logs;
CREATE POLICY "Allow authenticated users to read maintenance_logs" ON maintenance_logs
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance_logs" ON maintenance_logs;
CREATE POLICY "Allow authenticated users to insert maintenance_logs" ON maintenance_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- TENANT/USER TABLES
-- =====================================================

-- tenants table
DROP POLICY IF EXISTS "Allow authenticated users to read tenants" ON tenants;
CREATE POLICY "Allow authenticated users to read tenants" ON tenants
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_profiles table
DROP POLICY IF EXISTS "Allow authenticated users to read user_profiles" ON user_profiles;
CREATE POLICY "Allow authenticated users to read user_profiles" ON user_profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow users to update own profile" ON user_profiles;
CREATE POLICY "Allow users to update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- tenant_branding table
DROP POLICY IF EXISTS "Allow authenticated users to read tenant_branding" ON tenant_branding;
CREATE POLICY "Allow authenticated users to read tenant_branding" ON tenant_branding
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- SUCCESS - All module tables now accessible
-- =====================================================
