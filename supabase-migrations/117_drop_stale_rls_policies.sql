-- ============================================================
-- Migration 117: Drop stale overly-permissive RLS policies
-- from migration 034 that use "auth.uid() IS NOT NULL"
-- (any authenticated user, regardless of tenant).
--
-- These were superseded by proper tenant-scoped policies in
-- migrations 038/041 but were never explicitly dropped.
-- PostgreSQL ORs multiple policies, so one permissive policy
-- defeats all restrictive ones.
-- ============================================================

-- tip_employees
DROP POLICY IF EXISTS "Allow authenticated users to read tip_employees" ON tip_employees;
DROP POLICY IF EXISTS "Allow authenticated users to insert tip_employees" ON tip_employees;
DROP POLICY IF EXISTS "Allow authenticated users to update tip_employees" ON tip_employees;
DROP POLICY IF EXISTS "Allow authenticated users to delete tip_employees" ON tip_employees;

-- tip_weekly_data
DROP POLICY IF EXISTS "Allow authenticated users to read tip_weekly_data" ON tip_weekly_data;
DROP POLICY IF EXISTS "Allow authenticated users to insert tip_weekly_data" ON tip_weekly_data;
DROP POLICY IF EXISTS "Allow authenticated users to update tip_weekly_data" ON tip_weekly_data;
DROP POLICY IF EXISTS "Allow authenticated users to delete tip_weekly_data" ON tip_weekly_data;

-- tip_employee_hours
DROP POLICY IF EXISTS "Allow authenticated users to read tip_employee_hours" ON tip_employee_hours;
DROP POLICY IF EXISTS "Allow authenticated users to insert tip_employee_hours" ON tip_employee_hours;
DROP POLICY IF EXISTS "Allow authenticated users to update tip_employee_hours" ON tip_employee_hours;
DROP POLICY IF EXISTS "Allow authenticated users to delete tip_employee_hours" ON tip_employee_hours;

-- cash_activity
DROP POLICY IF EXISTS "Allow authenticated users to read cash_activity" ON cash_activity;
DROP POLICY IF EXISTS "Allow authenticated users to insert cash_activity" ON cash_activity;
DROP POLICY IF EXISTS "Allow authenticated users to update cash_activity" ON cash_activity;
DROP POLICY IF EXISTS "Allow authenticated users to delete cash_activity" ON cash_activity;

-- tenant_coffee_vendors
DROP POLICY IF EXISTS "Allow authenticated users to read tenant_coffee_vendors" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Allow authenticated users to insert tenant_coffee_vendors" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Allow authenticated users to update tenant_coffee_vendors" ON tenant_coffee_vendors;
DROP POLICY IF EXISTS "Allow authenticated users to delete tenant_coffee_vendors" ON tenant_coffee_vendors;

-- tenant_coffee_products
DROP POLICY IF EXISTS "Allow authenticated users to read tenant_coffee_products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Allow authenticated users to insert tenant_coffee_products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Allow authenticated users to update tenant_coffee_products" ON tenant_coffee_products;
DROP POLICY IF EXISTS "Allow authenticated users to delete tenant_coffee_products" ON tenant_coffee_products;

-- equipment
DROP POLICY IF EXISTS "Allow authenticated users to read equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to insert equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to update equipment" ON equipment;
DROP POLICY IF EXISTS "Allow authenticated users to delete equipment" ON equipment;

-- maintenance_tasks
DROP POLICY IF EXISTS "Allow authenticated users to read maintenance_tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance_tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update maintenance_tasks" ON maintenance_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete maintenance_tasks" ON maintenance_tasks;

-- maintenance_logs
DROP POLICY IF EXISTS "Allow authenticated users to read maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Allow authenticated users to update maintenance_logs" ON maintenance_logs;
DROP POLICY IF EXISTS "Allow authenticated users to delete maintenance_logs" ON maintenance_logs;

-- tenants
DROP POLICY IF EXISTS "Allow authenticated users to read tenants" ON tenants;
DROP POLICY IF EXISTS "Allow authenticated users to update tenants" ON tenants;

-- user_profiles
DROP POLICY IF EXISTS "Allow authenticated users to read user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON user_profiles;

-- tenant_branding
DROP POLICY IF EXISTS "Allow authenticated users to read tenant_branding" ON tenant_branding;
DROP POLICY IF EXISTS "Allow authenticated users to insert tenant_branding" ON tenant_branding;
DROP POLICY IF EXISTS "Allow authenticated users to update tenant_branding" ON tenant_branding;
