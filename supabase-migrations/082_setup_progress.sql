-- =====================================================
-- SETUP PROGRESS TRACKING
-- Track onboarding wizard progress per tenant.
-- Shape: { "completedSteps": ["team", "ingredients"], "dismissed": false }
-- =====================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS setup_progress JSONB DEFAULT '{}';

-- Help content for contextual tooltips (Phase 3B)
CREATE TABLE IF NOT EXISTS help_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_key TEXT NOT NULL,
    vertical_id UUID REFERENCES verticals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    learn_more_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(term_key, vertical_id)
);

CREATE INDEX IF NOT EXISTS idx_help_content_term ON help_content(term_key);
CREATE INDEX IF NOT EXISTS idx_help_content_vertical ON help_content(vertical_id);

ALTER TABLE help_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Help content is readable by everyone" ON help_content;
CREATE POLICY "Help content is readable by everyone" ON help_content
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform admins can manage help content" ON help_content;
CREATE POLICY "Platform admins can manage help content" ON help_content
    FOR ALL USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
    );

-- Seed initial help content (universal, not vertical-specific)
INSERT INTO help_content (term_key, vertical_id, title, body) VALUES
    ('food-cost-percent', NULL, 'Food Cost %', 'This is how much of your selling price goes to ingredients. Most shops aim for 15-25%. If yours is over 30%, you might be losing money on that item.'),
    ('overhead', NULL, 'Overhead', 'Monthly costs that aren''t ingredients — rent, electric, water, insurance, loan payments. We divide this across your items so you see your real profit.'),
    ('margin', NULL, 'Margin', 'What''s left after ingredients and overhead. This is your actual profit per item. Higher is better!'),
    ('cost-per-unit', NULL, 'Cost Per Unit', 'How much it costs YOU to make one of these. Compare this to what you charge to see if you''re making money.'),
    ('discrepancy', NULL, 'Discrepancy', 'The difference between what the register says you should have and what you actually counted. Small differences ($1-5) are normal. Large ones need investigation.'),
    ('starting-drawer', NULL, 'Starting Drawer', 'The amount of cash you put in the register at the start of the day. This stays the same most days.'),
    ('tip-pool', NULL, 'Tip Pool', 'All tips combined before splitting. We divide this by total hours worked so everyone gets a fair share based on time worked.'),
    ('preventive-maintenance', NULL, 'Preventive Maintenance', 'Cleaning and servicing equipment BEFORE it breaks. Costs less than emergency repairs and keeps your shop open.'),
    ('a-la-carte', NULL, 'A La Carte Pricing', 'Pick only the tools you need. You''re not locked into a big bundle — add or remove modules anytime.')
ON CONFLICT (term_key, vertical_id) DO NOTHING;
