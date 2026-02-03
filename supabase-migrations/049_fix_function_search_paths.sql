-- =====================================================
-- FIX FUNCTION SEARCH PATHS FOR SECURITY
-- Addresses Supabase security warning about mutable search_path
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Get max locations for a tenant (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_max_locations(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    override_limit INTEGER;
    plan_limit INTEGER;
BEGIN
    -- Check for override first
    SELECT max_locations_override INTO override_limit
    FROM public.tenants
    WHERE id = p_tenant_id;
    
    IF override_limit IS NOT NULL THEN
        RETURN override_limit;
    END IF;
    
    -- Get limit from subscription plan
    SELECT sp.max_locations INTO plan_limit
    FROM public.tenants t
    JOIN public.subscription_plans sp ON sp.id = t.subscription_plan
    WHERE t.id = p_tenant_id;
    
    -- Default to 1 if no plan found
    RETURN COALESCE(plan_limit, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- HELPER FUNCTION: Get current location count for a tenant (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_location_count(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    loc_count INTEGER;
BEGIN
    -- Count child locations (the parent counts as 1, plus children)
    SELECT COUNT(*) + 1 INTO loc_count
    FROM public.tenants
    WHERE parent_tenant_id = p_tenant_id
    AND is_active = true;
    
    RETURN loc_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- HELPER FUNCTION: Check if tenant can add a new location (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION can_add_location(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    current_count := public.get_tenant_location_count(p_tenant_id);
    max_allowed := public.get_tenant_max_locations(p_tenant_id);
    
    RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- HELPER FUNCTION: Get location usage info for a tenant (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_location_usage(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    current_count := public.get_tenant_location_count(p_tenant_id);
    max_allowed := public.get_tenant_max_locations(p_tenant_id);
    
    RETURN json_build_object(
        'current_count', current_count,
        'max_allowed', max_allowed,
        'can_add', current_count < max_allowed,
        'remaining', GREATEST(0, max_allowed - current_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- TRIGGER FUNCTION: Enforce location limits on insert (FIXED)
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
        can_add := public.can_add_location(parent_id);
        
        IF NOT can_add THEN
            RAISE EXCEPTION 'Location limit reached. Upgrade your subscription to add more locations.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- All location-limit functions now have fixed search_path = ''
-- This addresses the Supabase security warning about mutable search paths
