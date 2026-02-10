-- Referral code system for tenant-to-tenant referrals
-- Referrer gets 1 month free credit; Referee gets 50% off first month

-- =====================================================
-- REFERRAL_CODES (one per tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_referral UNIQUE (tenant_id)
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own referral code
CREATE POLICY "Users can view own referral code" ON referral_codes
    FOR SELECT USING (can_read_tenant_data(tenant_id));

-- Owners can insert a referral code for their tenant
CREATE POLICY "Owners can create referral code" ON referral_codes
    FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role));

-- Anyone authenticated can look up a code by value (for redemption validation)
CREATE POLICY "Authenticated users can look up codes" ON referral_codes
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Platform admins can manage all
CREATE POLICY "Platform admins manage referral codes" ON referral_codes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- =====================================================
-- REFERRAL_REDEMPTIONS (tracks who referred whom)
-- =====================================================
CREATE TABLE IF NOT EXISTS referral_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    referrer_tenant_id UUID NOT NULL REFERENCES tenants(id),
    referred_tenant_id UUID NOT NULL REFERENCES tenants(id),
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    referrer_reward_applied BOOLEAN DEFAULT false,
    referee_reward_applied BOOLEAN DEFAULT false,
    referrer_stripe_coupon_id TEXT,
    referee_stripe_coupon_id TEXT,
    CONSTRAINT unique_referred_tenant UNIQUE (referred_tenant_id)
);

ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Referrers can see redemptions for their referral code
CREATE POLICY "Users can view referrals they made" ON referral_redemptions
    FOR SELECT USING (can_read_tenant_data(referrer_tenant_id));

-- Referred tenants can see their own redemption
CREATE POLICY "Users can view own referral redemption" ON referral_redemptions
    FOR SELECT USING (can_read_tenant_data(referred_tenant_id));

-- Platform admins can manage all
CREATE POLICY "Platform admins manage referral redemptions" ON referral_redemptions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- Insert allowed by service role / server-side only (no client INSERT policy)
