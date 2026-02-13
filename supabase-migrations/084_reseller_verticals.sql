-- =====================================================
-- RESELLER VERTICAL & WHITE-LABEL SYSTEM
-- Connects the reseller system to the vertical engine.
-- Resellers can create custom verticals for their
-- referred tenants, with revenue share tracking.
-- =====================================================

-- =====================================================
-- 1. LINK VERTICALS TO RESELLERS
-- NULL reseller_id = system-defined vertical
-- Non-NULL = reseller-created custom vertical
-- =====================================================
ALTER TABLE verticals ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_verticals_reseller ON verticals(reseller_id) WHERE reseller_id IS NOT NULL;

-- =====================================================
-- 2. ADD VERTICAL_ID TO LICENSE CODES
-- Allows codes to be scoped to a specific vertical
-- so redeemed tenants auto-assign the right vertical
-- =====================================================
ALTER TABLE license_codes ADD COLUMN IF NOT EXISTS vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

-- =====================================================
-- 3. ADD REVENUE SHARE TO RESELLERS
-- Percentage of subscription revenue shared with reseller
-- =====================================================
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS revenue_share_percent NUMERIC(5,2) DEFAULT 0;

-- =====================================================
-- 4. RLS: RESELLERS CAN VIEW THEIR OWN VERTICALS
-- (Platform admins already have full access from 080)
-- =====================================================

-- Allow resellers to view verticals they created
-- Uses the tenant's reseller_id to match
CREATE POLICY "Resellers can view their own verticals" ON verticals
    FOR SELECT USING (
        reseller_id IS NOT NULL AND
        reseller_id IN (
            SELECT r.id FROM resellers r
            JOIN tenants t ON t.reseller_id = r.id
            JOIN user_profiles up ON up.tenant_id = t.id
            WHERE up.user_id = auth.uid()
        )
    );

-- =====================================================
-- 5. UPDATE redeem_license_code TO SET VERTICAL
-- If the license code has a vertical_id, auto-assign
-- it to the tenant on redemption
-- =====================================================
CREATE OR REPLACE FUNCTION redeem_license_code(p_code TEXT, p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_license_id UUID;
    v_reseller_id UUID;
    v_vertical_id UUID;
BEGIN
    -- Find valid unredeemed code
    SELECT id, reseller_id, vertical_id
    INTO v_license_id, v_reseller_id, v_vertical_id
    FROM public.license_codes
    WHERE code = UPPER(REPLACE(p_code, '-', ''))
    AND redeemed_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

    IF v_license_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Mark code as redeemed
    UPDATE public.license_codes
    SET redeemed_at = NOW(),
        tenant_id = p_tenant_id
    WHERE id = v_license_id;

    -- Link tenant to reseller and optionally set vertical
    UPDATE public.tenants
    SET reseller_id = v_reseller_id,
        license_code_id = v_license_id,
        vertical_id = COALESCE(v_vertical_id, vertical_id)
    WHERE id = p_tenant_id;

    -- Increment reseller's seats_used
    UPDATE public.resellers
    SET seats_used = seats_used + 1
    WHERE id = v_reseller_id;

    RETURN v_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- SUCCESS
-- =====================================================
-- White-label reseller system extended:
--
-- verticals:
--   + reseller_id    — links custom verticals to their creator
--
-- license_codes:
--   + vertical_id    — auto-assigns vertical on code redemption
--
-- resellers:
--   + revenue_share_percent — tracks revenue share (0-100)
--
-- Updated:
--   redeem_license_code() — now sets vertical_id on tenant
--
-- RLS:
--   Resellers can view their own verticals
