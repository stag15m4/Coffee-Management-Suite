-- =====================================================
-- TASK ATTACHMENTS: Videos, Files & Links per Task
-- Allows attaching tutorial videos, documents, and
-- links to individual maintenance tasks
-- =====================================================

-- 1. Create maintenance_task_attachments table
CREATE TABLE IF NOT EXISTS maintenance_task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL CHECK (attachment_type IN ('file', 'link', 'video')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_tenant ON maintenance_task_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON maintenance_task_attachments(task_id);

-- 2. RLS policies
ALTER TABLE maintenance_task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant task attachments" ON maintenance_task_attachments
    FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can insert task attachments" ON maintenance_task_attachments
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "All team members can update task attachments" ON maintenance_task_attachments
    FOR UPDATE USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "Managers+ can delete task attachments" ON maintenance_task_attachments
    FOR DELETE USING (
        tenant_id = get_current_tenant_id()
        AND has_role_or_higher('manager')
    );
