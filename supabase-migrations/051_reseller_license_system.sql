-- =====================================================
-- WHOLESALE RESELLER & LICENSE CODE SYSTEM
-- Allows wholesale partners to purchase seats and distribute
-- license codes to their customers
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- RESELLERS TABLE
-- Wholesale partners who buy bulk seats
-- =====================================================
CREATE TABLE IF NOT EXISTS resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    company_address TEXT,
    seats_total INTEGER NOT NULL DEFAULT 0,
    seats_used INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resellers_email ON resellers(contact_email);
CREATE INDEX IF NOT EXISTS idx_resellers_active ON resellers(is_active);

-- =====================================================
-- LICENSE CODES TABLE
-- Redeemable codes for reseller distribution
-- =====================================================
CREATE TABLE IF NOT EXISTS license_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    subscription_plan TEXT DEFAULT 'premium',
    redeemed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_license_codes_code ON license_codes(code);
CREATE INDEX IF NOT EXISTS idx_license_codes_reseller ON license_codes(reseller_id);
CREATE INDEX IF NOT EXISTS idx_license_codes_unredeemed ON license_codes(redeemed_at) WHERE redeemed_at IS NULL;

-- =====================================================
-- ADD RESELLER_ID TO TENANTS TABLE
-- Links tenants to their reseller (NULL = direct customer)
-- =====================================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_code_id UUID REFERENCES license_codes(id) ON DELETE SET NULL;

-- Create index for reseller tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenants_reseller ON tenants(reseller_id) WHERE reseller_id IS NOT NULL;

-- =====================================================
-- RLS POLICIES FOR RESELLERS TABLE
-- Only platform admins can manage resellers
-- =====================================================
ALTER TABLE resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view resellers" ON resellers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can insert resellers" ON resellers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can update resellers" ON resellers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can delete resellers" ON resellers
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- RLS POLICIES FOR LICENSE CODES TABLE
-- Platform admins manage codes, but anyone can check validity for redemption
-- =====================================================
ALTER TABLE license_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view license codes" ON license_codes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Anyone can check unredeemed codes" ON license_codes
    FOR SELECT USING (
        redeemed_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
    );

CREATE POLICY "Platform admins can insert license codes" ON license_codes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can update license codes" ON license_codes
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Platform admins can delete license codes" ON license_codes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- HELPER FUNCTION: Generate a random license code
-- Format: XXXX-XXXX-XXXX (12 alphanumeric chars)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_license_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..12 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        IF i = 4 OR i = 8 THEN
            result := result || '-';
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- =====================================================
-- HELPER FUNCTION: Redeem a license code
-- Returns the license code record if valid, NULL otherwise
-- =====================================================
CREATE OR REPLACE FUNCTION redeem_license_code(p_code TEXT, p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_license_id UUID;
    v_reseller_id UUID;
BEGIN
    -- Find valid unredeemed code
    SELECT id, reseller_id INTO v_license_id, v_reseller_id
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
    
    -- Link tenant to reseller
    UPDATE public.tenants
    SET reseller_id = v_reseller_id,
        license_code_id = v_license_id
    WHERE id = p_tenant_id;
    
    -- Increment reseller's seats_used
    UPDATE public.resellers
    SET seats_used = seats_used + 1
    WHERE id = v_reseller_id;
    
    RETURN v_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Wholesale reseller system is now set up:
--
-- Tables:
-- - resellers: Wholesale partners with seat tracking
-- - license_codes: Redeemable codes for distribution
--
-- Tenants now have:
-- - reseller_id: Links to their reseller (NULL = direct customer)
-- - license_code_id: The code they redeemed
--
-- Functions:
-- - generate_license_code(): Creates XXXX-XXXX-XXXX format codes
-- - redeem_license_code(code, tenant_id): Validates and redeems a code
--
-- Security:
-- - Only platform admins can manage resellers and codes
-- - Tenants can only view unredeemed codes for validation
