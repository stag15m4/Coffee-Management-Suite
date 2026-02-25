-- =====================================================
-- PRICING RESTRUCTURE — Go-to-Market 2026
--
-- New B2C tiers: Starter (free), Essential ($49/mo), Professional ($99/mo), A La Carte ($29/module)
-- New B2B reseller tiers: Authorized (20%), Silver (30%), Gold (40%)
-- Per-location pricing model
-- Grandfathers existing paying tenants
-- =====================================================

-- =========================
-- PART A: New columns on subscription_plans
-- =========================

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_modules INTEGER DEFAULT NULL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT NULL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS annual_price DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_locations INTEGER DEFAULT NULL;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';

-- =========================
-- PART B: Insert new subscription plans
-- =========================

INSERT INTO subscription_plans (id, name, description, monthly_price, annual_price, max_modules, max_users, max_locations, display_order, is_active, features) VALUES
  ('starter', 'Starter', 'Free forever — 1 location, 1 module, up to 3 users. 14-day full access trial.', 0, 0, 1, 3, 1, 1, true, '["1 module of your choice", "1 location", "Up to 3 users", "14-day full access trial"]'::jsonb),
  ('essential', 'Essential', 'Pick up to 3 modules per location. Unlimited users.', 49.00, 39.00, 3, NULL, NULL, 3, true, '["Up to 3 modules", "Per-location pricing", "Unlimited users", "Email support"]'::jsonb),
  ('professional', 'Professional', 'All modules, unlimited users, custom branding. Per location.', 99.00, 79.00, NULL, NULL, NULL, 4, true, '["All 6 modules included", "Per-location pricing", "Unlimited users", "Custom branding", "Priority support"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  max_modules = EXCLUDED.max_modules,
  max_users = EXCLUDED.max_users,
  max_locations = EXCLUDED.max_locations,
  display_order = EXCLUDED.display_order,
  features = EXCLUDED.features;

-- Update existing plans with new column values
UPDATE subscription_plans SET max_modules = NULL, max_users = NULL, max_locations = 1,
  features = '["All modules (trial)", "1 location", "14-day trial"]'::jsonb
WHERE id = 'free';

UPDATE subscription_plans SET
  monthly_price = 29.00,
  description = 'Individual modules at $29/mo each per location',
  features = '["Pick individual modules", "Per-location pricing", "Add or remove anytime"]'::jsonb
WHERE id = 'alacarte';

-- Move legacy plans down in display order
UPDATE subscription_plans SET display_order = 10 WHERE id = 'premium';
UPDATE subscription_plans SET display_order = 11 WHERE id = 'beta';
UPDATE subscription_plans SET display_order = 12 WHERE id = 'alacarte';

-- =========================
-- PART C: Update module pricing to $29/mo
-- =========================

UPDATE modules SET monthly_price = 29.00 WHERE id IN (
  'recipe-costing', 'tip-payout', 'cash-deposit',
  'bulk-ordering', 'equipment-maintenance', 'admin-tasks'
);

-- =========================
-- PART D: Professional plan gets all modules
-- =========================

INSERT INTO subscription_plan_modules (plan_id, module_id)
SELECT 'professional', module_id FROM subscription_plan_modules WHERE plan_id = 'premium'
ON CONFLICT DO NOTHING;

-- Also ensure professional gets equipment-maintenance and admin-tasks
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
  ('professional', 'recipe-costing'),
  ('professional', 'tip-payout'),
  ('professional', 'cash-deposit'),
  ('professional', 'bulk-ordering'),
  ('professional', 'equipment-maintenance'),
  ('professional', 'admin-tasks')
ON CONFLICT DO NOTHING;

-- =========================
-- PART E: Reseller tier columns
-- =========================

ALTER TABLE resellers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'authorized';
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 20;
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS minimum_seats INTEGER DEFAULT 0;
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly';
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS annual_commitment INTEGER DEFAULT 0;
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMP WITH TIME ZONE;

-- Add check constraints (safe with DO block)
DO $$
BEGIN
  ALTER TABLE resellers ADD CONSTRAINT resellers_tier_check
    CHECK (tier IN ('authorized', 'silver', 'gold'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE resellers ADD CONSTRAINT resellers_billing_cycle_check
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- PART F: Tenant billing fields
-- =========================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billable_locations INTEGER DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_grandfathered BOOLEAN DEFAULT false;

DO $$
BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_billing_interval_check
    CHECK (billing_interval IN ('monthly', 'annual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- PART G: Reseller volume discount tiers (reference table)
-- =========================

CREATE TABLE IF NOT EXISTS reseller_volume_tiers (
  id SERIAL PRIMARY KEY,
  min_locations INTEGER NOT NULL,
  max_locations INTEGER,
  discount_percent NUMERIC(5,2) NOT NULL,
  label TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE reseller_volume_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Volume tiers readable by authenticated users" ON reseller_volume_tiers;
CREATE POLICY "Volume tiers readable by authenticated users" ON reseller_volume_tiers
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Platform admins can manage volume tiers" ON reseller_volume_tiers;
CREATE POLICY "Platform admins can manage volume tiers" ON reseller_volume_tiers
  FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Seed volume tiers
INSERT INTO reseller_volume_tiers (min_locations, max_locations, discount_percent, label) VALUES
  (5, 9, 15.00, '5-9 locations'),
  (10, 24, 25.00, '10-24 locations'),
  (25, 49, 30.00, '25-49 locations'),
  (50, NULL, 35.00, '50+ locations')
ON CONFLICT DO NOTHING;

-- =========================
-- PART H: Update get_tenant_enabled_modules for new plans
-- =========================

CREATE OR REPLACE FUNCTION get_tenant_enabled_modules(p_tenant_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    effective_tenant_id UUID;
    parent_id UUID;
    tenant_plan TEXT;
    caller_is_admin BOOLEAN;
    result TEXT[];
BEGIN
    -- Check if the caller is a platform admin
    caller_is_admin := is_platform_admin();

    -- Check if this tenant is a child location (has parent_tenant_id)
    SELECT parent_tenant_id INTO parent_id
    FROM tenants
    WHERE id = p_tenant_id;

    -- Use parent's subscription if this is a child location
    IF parent_id IS NOT NULL THEN
        effective_tenant_id := parent_id;
    ELSE
        effective_tenant_id := p_tenant_id;
    END IF;

    -- Get the effective tenant's subscription plan
    SELECT subscription_plan INTO tenant_plan
    FROM tenants
    WHERE id = effective_tenant_id;

    -- If no plan set, default to 'free' (trial)
    IF tenant_plan IS NULL OR tenant_plan = '' THEN
        tenant_plan := 'free';
    END IF;

    -- Full-access plans: free trial, beta, premium (legacy), professional (new)
    IF tenant_plan IN ('free', 'beta', 'premium', 'professional') THEN
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = tenant_plan
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND (tenant_plan IN ('beta', 'professional') OR caller_is_admin))
            OR (m.rollout_status = 'internal' AND caller_is_admin)
          );
    ELSE
        -- Selective plans: starter, essential, alacarte — use tenant_module_subscriptions
        SELECT ARRAY_AGG(m.id) INTO result
        FROM modules m
        INNER JOIN tenant_module_subscriptions tms ON tms.module_id = m.id AND tms.tenant_id = effective_tenant_id
        LEFT JOIN tenant_module_overrides tmo ON tmo.module_id = m.id AND tmo.tenant_id = effective_tenant_id
        WHERE (tmo.is_enabled IS NULL OR tmo.is_enabled = true)
          AND (
            m.rollout_status = 'ga'
            OR (m.rollout_status = 'beta' AND caller_is_admin)
            OR (m.rollout_status = 'internal' AND caller_is_admin)
          );
    END IF;

    RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================
-- PART I: Grandfather existing paying tenants
-- =========================

UPDATE tenants SET is_grandfathered = true
WHERE subscription_plan IN ('premium', 'alacarte')
  AND subscription_status = 'active';

-- =========================
-- VERIFICATION
-- =========================

SELECT '=== NEW SUBSCRIPTION PLANS ===' as info;
SELECT id, name, monthly_price, annual_price, max_modules, max_users, max_locations, display_order
FROM subscription_plans ORDER BY display_order;

SELECT '=== UPDATED MODULE PRICING ===' as info;
SELECT id, name, monthly_price FROM modules ORDER BY display_order;

SELECT '=== PROFESSIONAL PLAN MODULES ===' as info;
SELECT * FROM subscription_plan_modules WHERE plan_id = 'professional';

SELECT '=== RESELLER VOLUME TIERS ===' as info;
SELECT * FROM reseller_volume_tiers ORDER BY min_locations;
