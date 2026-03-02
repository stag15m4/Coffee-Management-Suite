-- Migration 113: Dynamic business list for Business Accounts Tracker
-- Allows platform admins to add/remove businesses instead of a hardcoded list.

CREATE TABLE IF NOT EXISTS account_businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_businesses ENABLE ROW LEVEL SECURITY;

-- Only platform admins can access
CREATE POLICY "platform_admin_account_businesses" ON account_businesses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- Seed default businesses
INSERT INTO account_businesses (name, color, display_order) VALUES
    ('Erwin Mills', '#6366f1', 0),
    ('Personal', '#8b5cf6', 1),
    ('Shared', '#f97316', 2)
ON CONFLICT (name) DO NOTHING;
