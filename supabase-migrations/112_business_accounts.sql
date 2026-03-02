-- Migration 112: Business Accounts Tracker
-- Internal platform-admin-only tool for tracking online accounts,
-- subscriptions, and services across multiple businesses.
-- No tenant_id — this is a platform-level resource, not tenant-specific.

CREATE TABLE IF NOT EXISTS business_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    service_url TEXT,
    business TEXT NOT NULL DEFAULT 'Erwin Mills',
    category TEXT NOT NULL DEFAULT 'Other',
    username_or_email TEXT,
    cost DECIMAL(10, 2),
    billing_cycle TEXT NOT NULL DEFAULT 'Monthly',
    renewal_date DATE,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_accounts_business ON business_accounts(business);
CREATE INDEX IF NOT EXISTS idx_business_accounts_category ON business_accounts(category);
CREATE INDEX IF NOT EXISTS idx_business_accounts_status ON business_accounts(status);
CREATE INDEX IF NOT EXISTS idx_business_accounts_renewal ON business_accounts(renewal_date);

ALTER TABLE business_accounts ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read or write business accounts
CREATE POLICY "platform_admin_business_accounts" ON business_accounts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );
