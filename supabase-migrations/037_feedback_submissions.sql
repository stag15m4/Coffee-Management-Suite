-- Feedback Submissions Table
-- Stores user-submitted feedback, bug reports, and suggestions

CREATE TABLE IF NOT EXISTS feedback_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_name TEXT,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'suggestion', 'general')),
    subject TEXT,
    description TEXT NOT NULL,
    page_url TEXT,
    browser_info TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can submit feedback" ON feedback_submissions
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- Users can view their own submissions
CREATE POLICY "Users can view own feedback" ON feedback_submissions
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- Owners and managers can view all feedback for their tenant
CREATE POLICY "Managers can view tenant feedback" ON feedback_submissions
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        AND (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('owner', 'manager')
    );

-- Platform admins can view all feedback
CREATE POLICY "Platform admins can view all feedback" ON feedback_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
    );

-- Create index for faster lookups
CREATE INDEX idx_feedback_submissions_tenant ON feedback_submissions(tenant_id);
CREATE INDEX idx_feedback_submissions_user ON feedback_submissions(user_id);
CREATE INDEX idx_feedback_submissions_status ON feedback_submissions(status);
CREATE INDEX idx_feedback_submissions_created ON feedback_submissions(created_at DESC);
