-- =====================================================
-- 099: Document Library
-- Policies, procedures, forms, and other documents
-- with role-based visibility and optional acknowledgment
-- =====================================================

-- =====================================================
-- 1. DOCUMENT CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_categories_tenant ON document_categories(tenant_id);

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

-- Anyone in the tenant can view categories
CREATE POLICY "Users can view document categories"
    ON document_categories FOR SELECT
    USING (can_read_tenant_data(tenant_id));

-- Only owners can manage categories
CREATE POLICY "Owners can create document categories"
    ON document_categories FOR INSERT
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role));

CREATE POLICY "Owners can update document categories"
    ON document_categories FOR UPDATE
    USING (can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role));

CREATE POLICY "Owners can delete document categories"
    ON document_categories FOR DELETE
    USING (can_access_tenant(tenant_id) AND has_role_or_higher('owner'::user_role));

-- Platform admin override
CREATE POLICY "Platform admins manage document categories"
    ON document_categories FOR ALL
    USING (EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true));

-- =====================================================
-- 2. DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    min_role_required user_role NOT NULL DEFAULT 'employee'::user_role,
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    review_interval_days INT DEFAULT NULL,
    review_assigned_to UUID REFERENCES user_profiles(id) DEFAULT NULL,
    last_reviewed_at TIMESTAMPTZ DEFAULT NULL,
    last_reviewed_by UUID REFERENCES user_profiles(id) DEFAULT NULL,
    uploaded_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_category ON documents(tenant_id, category_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can view documents if they have the required role
CREATE POLICY "Users can view documents with sufficient role"
    ON documents FOR SELECT
    USING (
        can_read_tenant_data(tenant_id)
        AND has_role_or_higher(min_role_required)
    );

-- Leads and above can manage documents
CREATE POLICY "Leads can create documents"
    ON documents FOR INSERT
    WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can update documents"
    ON documents FOR UPDATE
    USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

CREATE POLICY "Leads can delete documents"
    ON documents FOR DELETE
    USING (can_access_tenant(tenant_id) AND has_role_or_higher('lead'::user_role));

-- Platform admin override
CREATE POLICY "Platform admins manage documents"
    ON documents FOR ALL
    USING (EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true));

-- =====================================================
-- 3. DOCUMENT ACKNOWLEDGMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS document_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_acks_tenant ON document_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_acks_document ON document_acknowledgments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_acks_user ON document_acknowledgments(user_id);

ALTER TABLE document_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Anyone in the tenant can view acknowledgments
CREATE POLICY "Users can view document acknowledgments"
    ON document_acknowledgments FOR SELECT
    USING (can_read_tenant_data(tenant_id));

-- Any authenticated user can acknowledge a document
CREATE POLICY "Users can acknowledge documents"
    ON document_acknowledgments FOR INSERT
    WITH CHECK (can_access_tenant(tenant_id) AND user_id = auth.uid());

-- Platform admin override
CREATE POLICY "Platform admins manage document acknowledgments"
    ON document_acknowledgments FOR ALL
    USING (EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true));

-- =====================================================
-- 4. MODULE REGISTRATION
-- =====================================================

INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('document-library', 'Document Library', 'Manage policies, procedures, forms, and other documents with role-based access', 19.99, false, 9)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    display_order = EXCLUDED.display_order;

-- Add to all subscription plans so tenants can access it
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'document-library'),
    ('test_eval', 'document-library'),
    ('premium', 'document-library')
ON CONFLICT DO NOTHING;
