-- Migration 023: Update pricing structure & Auto-create user profiles
-- Each module is $25/month except Recipe Cost Manager ($50/month standalone)
-- Premium Suite is $125/month for all modules

-- =====================================================
-- PART 1: UPDATE PRICING
-- =====================================================

-- Update module pricing (using id column, not slug)
UPDATE modules SET monthly_price = 25.00 WHERE id = 'tip-payout';
UPDATE modules SET monthly_price = 25.00 WHERE id = 'cash-deposit';
UPDATE modules SET monthly_price = 25.00 WHERE id = 'bulk-ordering';
UPDATE modules SET monthly_price = 25.00 WHERE id = 'equipment-maintenance';
UPDATE modules SET monthly_price = 50.00 WHERE id = 'recipe-costing';

-- Update Premium Suite price
UPDATE subscription_plans SET monthly_price = 125.00 WHERE id = 'premium';

-- Also update the description to reflect new pricing
UPDATE subscription_plans SET description = 'Pick individual modules at $25/month each' WHERE id = 'alacarte';

-- =====================================================
-- PART 2: AUTO-CREATE USER PROFILES ON SIGNUP
-- =====================================================

-- Function to handle new user signups
-- This creates a user_profiles entry when a new auth user is created
-- It uses metadata from the signup to determine tenant_id and role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_full_name TEXT;
BEGIN
    -- Get tenant_id from user metadata (set during signup)
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    
    -- Get role from metadata, default to 'employee'
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
    
    -- Get full name from metadata
    v_full_name := NEW.raw_user_meta_data->>'full_name';
    
    -- Only create profile if tenant_id is provided
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO public.user_profiles (id, tenant_id, email, full_name, role, is_active)
        VALUES (
            NEW.id,
            v_tenant_id,
            NEW.email,
            v_full_name,
            v_role::user_role,
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- PART 3: BACKFILL EXISTING USERS (Optional)
-- =====================================================
-- If you have existing auth users without user_profiles, 
-- you can manually insert them. Example:
--
-- INSERT INTO user_profiles (id, tenant_id, email, role, is_active)
-- SELECT 
--     au.id,
--     '00000000-0000-0000-0000-000000000001', -- Your tenant ID
--     au.email,
--     'owner',  -- Set appropriate role
--     true
-- FROM auth.users au
-- LEFT JOIN user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

SELECT '=== UPDATED MODULES PRICING ===' as info;
SELECT id, name, monthly_price, is_premium_only FROM modules ORDER BY display_order;

SELECT '=== UPDATED SUBSCRIPTION PLANS ===' as info;
SELECT id, name, description, monthly_price FROM subscription_plans ORDER BY display_order;

SELECT '=== TRIGGER STATUS ===' as info;
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
