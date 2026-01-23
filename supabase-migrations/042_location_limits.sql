-- =====================================================
-- LOCATION LIMITS BASED ON SUBSCRIPTION
-- Meters the number of locations a tenant can have based on their plan
-- =====================================================

-- Add max_locations column to subscription_plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_locations INTEGER DEFAULT 1;

-- Set default location limits per plan
-- Free Trial: 1 location (limited to try the system)
-- À La Carte: 1 location (pay extra for more)
-- Test & Eval: 3 locations (for evaluation)
-- Premium: 5 locations (standard enterprise tier)
UPDATE subscription_plans SET max_locations = 1 WHERE id = 'free';
UPDATE subscription_plans SET max_locations = 1 WHERE id = 'alacarte';
UPDATE subscription_plans SET max_locations = 3 WHERE id = 'test_eval';
UPDATE subscription_plans SET max_locations = 5 WHERE id = 'premium';

-- Add max_locations_override to tenants table for platform admin overrides
-- NULL means use the plan's limit, a number overrides it
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_locations_override INTEGER DEFAULT NULL;

-- =====================================================
-- HELPER FUNCTION: Get max locations for a tenant
-- Returns the maximum number of locations allowed
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_max_locations(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    override_limit INTEGER;
    plan_limit INTEGER;
BEGIN
    -- Check for override first
    SELECT max_locations_override INTO override_limit
    FROM tenants
    WHERE id = p_tenant_id;
    
    IF override_limit IS NOT NULL THEN
        RETURN override_limit;
    END IF;
    
    -- Get limit from subscription plan
    SELECT sp.max_locations INTO plan_limit
    FROM tenants t
    JOIN subscription_plans sp ON sp.id = t.subscription_plan
    WHERE t.id = p_tenant_id;
    
    -- Default to 1 if no plan found
    RETURN COALESCE(plan_limit, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Get current location count for a tenant
-- Counts direct child locations (parent_tenant_id = tenant_id)
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_location_count(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    loc_count INTEGER;
BEGIN
    -- Count child locations (the parent counts as 1, plus children)
    SELECT COUNT(*) + 1 INTO loc_count
    FROM tenants
    WHERE parent_tenant_id = p_tenant_id
    AND is_active = true;
    
    RETURN loc_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Check if tenant can add a new location
-- Returns true if under the limit, false if at/over limit
-- =====================================================
CREATE OR REPLACE FUNCTION can_add_location(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    current_count := get_tenant_location_count(p_tenant_id);
    max_allowed := get_tenant_max_locations(p_tenant_id);
    
    RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Get location usage info for a tenant
-- Returns JSON with current count, max allowed, and can_add flag
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_location_usage(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    current_count := get_tenant_location_count(p_tenant_id);
    max_allowed := get_tenant_max_locations(p_tenant_id);
    
    RETURN json_build_object(
        'current_count', current_count,
        'max_allowed', max_allowed,
        'can_add', current_count < max_allowed,
        'remaining', GREATEST(0, max_allowed - current_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Enforce location limits on insert
-- Prevents creating child locations beyond the limit
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_location_limit()
RETURNS TRIGGER AS $$
DECLARE
    parent_id UUID;
    can_add BOOLEAN;
BEGIN
    -- Only check if this is a child location (has parent_tenant_id)
    IF NEW.parent_tenant_id IS NOT NULL THEN
        parent_id := NEW.parent_tenant_id;
        
        -- Check if the parent can add more locations
        can_add := can_add_location(parent_id);
        
        IF NOT can_add THEN
            RAISE EXCEPTION 'Location limit reached. Upgrade your subscription to add more locations.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_location_limit ON tenants;

-- Create trigger on tenants table
CREATE TRIGGER check_location_limit
    BEFORE INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION enforce_location_limit();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Location limits have been added to subscription plans.
-- 
-- Default limits:
-- - Free Trial: 1 location
-- - À La Carte: 1 location  
-- - Test & Eval: 3 locations
-- - Premium: 5 locations
--
-- Platform admins can override limits per-tenant using max_locations_override
--
-- Helper functions:
-- - get_tenant_max_locations(tenant_id) - Get max allowed locations
-- - get_tenant_location_count(tenant_id) - Get current location count
-- - can_add_location(tenant_id) - Check if can add more locations
-- - get_tenant_location_usage(tenant_id) - Get full usage info as JSON
--
-- Enforcement:
-- - Database trigger prevents inserting child locations beyond limit
-- - UI shows usage indicator and disables Add button at limit
