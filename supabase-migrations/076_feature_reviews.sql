-- Feature Reviews Table
-- Stores thumbs-up/down feedback on changelog features

CREATE TABLE IF NOT EXISTS feature_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    feature_id TEXT NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, feature_id)
);

-- Enable RLS
ALTER TABLE feature_reviews ENABLE ROW LEVEL SECURITY;

-- Users can submit and update their own reviews
CREATE POLICY "Users can insert reviews" ON feature_reviews
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can update own reviews" ON feature_reviews
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view own reviews" ON feature_reviews
    FOR SELECT USING (user_id = auth.uid());

-- Managers/owners can view all reviews for their tenant
CREATE POLICY "Managers can view tenant reviews" ON feature_reviews
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('owner', 'manager')
    );

-- Indexes
CREATE INDEX idx_feature_reviews_tenant ON feature_reviews(tenant_id);
CREATE INDEX idx_feature_reviews_feature ON feature_reviews(feature_id);
CREATE INDEX idx_feature_reviews_rating ON feature_reviews(rating);

-- Track which changelog version each user has seen (per-user)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS changelog_last_seen TEXT;

-- Allow users to update their own changelog_last_seen
CREATE POLICY "Users can update own changelog_seen" ON user_profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
