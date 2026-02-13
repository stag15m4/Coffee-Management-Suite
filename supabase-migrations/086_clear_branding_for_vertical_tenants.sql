-- =====================================================
-- Clear branding color overrides for tenants that have a vertical assigned.
-- When a vertical provides theme colors, tenant_branding colors should be
-- null so the vertical theme takes effect. Only explicit user customizations
-- should populate these fields.
-- =====================================================

-- Clear color fields for any tenant whose tenant record has a vertical_id.
-- Keep non-color fields (logo_url, company_name, tagline) intact.
UPDATE tenant_branding
SET
    primary_color = NULL,
    secondary_color = NULL,
    accent_color = NULL,
    background_color = NULL,
    updated_at = now()
WHERE tenant_id IN (
    SELECT id FROM tenants WHERE vertical_id IS NOT NULL
);

-- Also fix any remaining cream/warm backgrounds on other tenants
UPDATE tenant_branding
SET
    accent_color = '#F5F5F5',
    background_color = '#FFFFFF',
    updated_at = now()
WHERE background_color IN ('#FFFDF7', '#F5F0E1')
  AND tenant_id NOT IN (
    SELECT id FROM tenants WHERE vertical_id IS NOT NULL
  );
