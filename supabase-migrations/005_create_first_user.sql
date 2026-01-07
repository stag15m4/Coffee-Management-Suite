-- =====================================================
-- CREATE YOUR FIRST USER (OWNER)
-- 
-- STEP 1: First, sign up through the app's login page
--         (go to /login in your browser, but you can't log in yet)
--         
-- STEP 2: OR create a user in Supabase Dashboard:
--         Go to Authentication > Users > Add User
--         Enter your email and password
--         Copy the User UID that gets generated
--
-- STEP 3: Replace 'YOUR_USER_ID_HERE' below with that UID
--         Replace 'your.email@example.com' with your email
--         Replace 'Your Name' with your name
--         Then run this SQL
-- =====================================================

-- After creating a user in Supabase Auth, link them to a profile:
INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
VALUES (
    'YOUR_USER_ID_HERE',  -- Replace with actual user UUID from Supabase Auth
    '-- =====================================================
    -- CREATE YOUR FIRST USER (OWNER)
    -- 
    -- STEP 1: First, sign up through the app's login page
    --         (go to /login in your browser, but you can't log in yet)
    --         
    -- STEP 2: OR create a user in Supabase Dashboard:
    --         Go to Authentication > Users > Add User
    --         Enter your email and password
    --         Copy the User UID that gets generated
    --
    -- STEP 3: Replace 'YOUR_USER_ID_HERE' below with that UID
    --         Replace 'your.email@example.com' with your email
    --         Replace 'Your Name' with your name
    --         Then run this SQL
    -- =====================================================

    -- After creating a user in Supabase Auth, link them to a profile:
    INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (
        'YOUR_USER_ID_HERE',  -- Replace with actual user UUID from Supabase Auth
        '-- =====================================================
    -- CREATE YOUR FIRST USER (OWNER)
    -- 
    -- STEP 1: First, sign up through the app's login page
    --         (go to /login in your browser, but you can't log in yet)
    --         
    -- STEP 2: OR create a user in Supabase Dashboard:
    --         Go to Authentication > Users > Add User
    --         Enter your email and password
    --         Copy the User UID that gets generated
    --
    -- STEP 3: Replace 'YOUR_USER_ID_HERE' below with that UID
    --         Replace 'your.email@example.com' with your email
    --         Replace 'Your Name' with your name
    --         Then run this SQL
    -- =====================================================

    -- After creating a user in Supabase Auth, link them to a profile:
    INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (
        'YOUR_USER_ID_HERE',  -- Replace with actual user UUID from Supabase Auth
        '00000000-0000-0000-0000-000000000001',  -- Default Erwin Mills tenant
        'your.email@example.com',  -- Replace with your email
        'Your Name',  -- Replace with your name
        'owner',  -- This makes you an Owner with full access
        true
    );

    -- =====================================================
    -- ALTERNATIVE: If you want to create a test user quickly
    -- Go to Supabase Dashboard > Authentication > Users > Add User
    -- After creating, run this with the new user's ID
    -- =====================================================
',  -- Default Erwin Mills tenant
        'your.email@example.com',  -- Replace with your email
        'Your Name',  -- Replace with your name
        'owner',  -- This makes you an Owner with full access
        true
    );

    -- =====================================================
    -- ALTERNATIVE: If you want to create a test user quickly
    -- Go to Supabase Dashboard > Authentication > Users > Add User
    -- After creating, run this with the new user's ID
    -- =====================================================
',  -- Default Erwin Mills tenant
    'your.email@example.com',  -- Replace with your email
    'Your Name',  -- Replace with your name
    'owner',  -- This makes you an Owner with full access
    true
);

-- =====================================================
-- ALTERNATIVE: If you want to create a test user quickly
-- Go to Supabase Dashboard > Authentication > Users > Add User
-- After creating, run this with the new user's ID
-- =====================================================
