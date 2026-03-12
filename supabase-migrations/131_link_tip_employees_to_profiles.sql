-- Link tip_employees to user_profiles with an optional FK.
-- This replaces the fragile name-based deduplication with a proper DB relationship.

ALTER TABLE tip_employees
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tip_employees_user_profile_id
  ON tip_employees(user_profile_id) WHERE user_profile_id IS NOT NULL;

-- Backfill: link tip_employees to user_profiles where names match exactly (case-insensitive)
-- within the same tenant. Only link if there's exactly one match to avoid ambiguity.
UPDATE tip_employees te
SET user_profile_id = sub.profile_id
FROM (
  SELECT te2.id AS tip_id, up.id AS profile_id
  FROM tip_employees te2
  JOIN user_profiles up
    ON up.tenant_id = te2.tenant_id
    AND lower(trim(up.full_name)) = lower(trim(te2.name))
    AND up.is_active = true
  WHERE te2.user_profile_id IS NULL
  -- Only link if there's exactly one matching profile per tip employee name+tenant
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles up2
    WHERE up2.tenant_id = te2.tenant_id
      AND lower(trim(up2.full_name)) = lower(trim(te2.name))
      AND up2.is_active = true
      AND up2.id != up.id
  )
) sub
WHERE te.id = sub.tip_id;
