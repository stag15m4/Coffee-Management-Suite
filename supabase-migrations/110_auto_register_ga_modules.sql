-- =====================================================
-- 110: Auto-register GA modules into subscription plans
--
-- When a module's rollout_status changes to 'ga',
-- automatically add it to all full-access plans.
-- This eliminates manual INSERT statements per module.
-- =====================================================

CREATE OR REPLACE FUNCTION auto_register_ga_module()
RETURNS TRIGGER AS $$
DECLARE
    full_access_plan TEXT;
BEGIN
    -- Only fire when rollout_status transitions TO 'ga'
    IF NEW.rollout_status = 'ga' AND (OLD IS NULL OR OLD.rollout_status IS DISTINCT FROM 'ga') THEN
        -- Insert into all full-access subscription plans
        FOR full_access_plan IN
            SELECT id FROM subscription_plans
            WHERE id IN ('free', 'beta', 'premium', 'professional')
              AND is_active = true
        LOOP
            INSERT INTO subscription_plan_modules (plan_id, module_id)
            VALUES (full_access_plan, NEW.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_register_ga_module ON modules;

CREATE TRIGGER trg_auto_register_ga_module
    AFTER INSERT OR UPDATE OF rollout_status ON modules
    FOR EACH ROW
    EXECUTE FUNCTION auto_register_ga_module();

-- Backfill: ensure all existing GA modules are in all full-access plans
INSERT INTO subscription_plan_modules (plan_id, module_id)
SELECT sp.id, m.id
FROM subscription_plans sp
CROSS JOIN modules m
WHERE sp.id IN ('free', 'beta', 'premium', 'professional')
  AND sp.is_active = true
  AND m.rollout_status = 'ga'
ON CONFLICT DO NOTHING;
