-- =====================================================
-- ADD STRIPE FIELDS TO TENANTS TABLE
-- Links tenants to their Stripe customer and subscription
-- =====================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_subscription ON tenants(stripe_subscription_id);

COMMENT ON COLUMN tenants.stripe_customer_id IS 'Stripe Customer ID for billing';
COMMENT ON COLUMN tenants.stripe_subscription_id IS 'Active Stripe Subscription ID';
COMMENT ON COLUMN tenants.stripe_subscription_status IS 'Subscription status: active, canceled, past_due, etc.';
