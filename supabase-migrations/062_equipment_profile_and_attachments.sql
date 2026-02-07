-- =====================================================
-- EQUIPMENT PROFILE: Photo + Multiple Attachments
-- Adds photo_url column, equipment_attachments table,
-- and equipment-photos storage bucket
-- =====================================================

-- 1. Add photo_url column to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create equipment_attachments table
CREATE TABLE IF NOT EXISTS equipment_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL CHECK (attachment_type IN ('file', 'link')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_attachments_tenant ON equipment_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_attachments_equipment ON equipment_attachments(equipment_id);

-- 3. RLS policies for equipment_attachments
ALTER TABLE equipment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant attachments" ON equipment_attachments
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can insert attachments" ON equipment_attachments
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can update attachments" ON equipment_attachments
    FOR UPDATE USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers+ can delete attachments" ON equipment_attachments
    FOR DELETE USING (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('manager')
    );

-- 4. Create equipment-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for equipment-photos bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload equipment photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'equipment-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can update equipment photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'equipment-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete equipment photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'equipment-photos');

CREATE POLICY IF NOT EXISTS "Anyone can view equipment photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'equipment-photos');

-- 5. Migrate existing document data to equipment_attachments
INSERT INTO equipment_attachments (tenant_id, equipment_id, attachment_type, name, url, file_type)
SELECT tenant_id, id, 'file', document_name, document_url, NULL
FROM equipment
WHERE document_url IS NOT NULL AND document_name IS NOT NULL;
