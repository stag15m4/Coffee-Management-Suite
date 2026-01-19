-- =====================================================
-- ADMINISTRATIVE TASKS MODULE SCHEMA
-- Task management with delegation, categories, and tracking
-- =====================================================

-- 1. Create ENUM types for task priority and status
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Task Categories table
CREATE TABLE IF NOT EXISTS admin_task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#C9A227',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- 3. Admin Tasks table
CREATE TABLE IF NOT EXISTS admin_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES admin_task_categories(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    priority task_priority NOT NULL DEFAULT 'medium',
    status task_status NOT NULL DEFAULT 'pending',
    due_date DATE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    recurrence recurrence_type NOT NULL DEFAULT 'none',
    next_recurrence_date DATE,
    parent_task_id UUID REFERENCES admin_tasks(id) ON DELETE SET NULL,
    document_url TEXT,
    document_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Task Comments table
CREATE TABLE IF NOT EXISTS admin_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Task History/Audit Log table
CREATE TABLE IF NOT EXISTS admin_task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_tasks_tenant ON admin_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_category ON admin_tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned ON admin_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON admin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_due_date ON admin_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_admin_task_comments_task ON admin_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_admin_task_history_task ON admin_task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_admin_task_categories_tenant ON admin_task_categories(tenant_id);

-- 7. Enable RLS on all tables
ALTER TABLE admin_task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_task_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for admin_task_categories
CREATE POLICY "admin_task_categories_select" ON admin_task_categories
FOR SELECT USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
);

CREATE POLICY "admin_task_categories_insert" ON admin_task_categories
FOR INSERT WITH CHECK (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
);

CREATE POLICY "admin_task_categories_update" ON admin_task_categories
FOR UPDATE USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
);

CREATE POLICY "admin_task_categories_delete" ON admin_task_categories
FOR DELETE USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
    AND is_default = false
);

-- 9. RLS Policies for admin_tasks
CREATE POLICY "admin_tasks_select" ON admin_tasks
FOR SELECT USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
);

CREATE POLICY "admin_tasks_insert" ON admin_tasks
FOR INSERT WITH CHECK (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager', 'lead')
);

CREATE POLICY "admin_tasks_update" ON admin_tasks
FOR UPDATE USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (
        (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
        OR assigned_to = auth.uid()
        OR created_by = auth.uid()
    )
);

CREATE POLICY "admin_tasks_delete" ON admin_tasks
FOR DELETE USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager')
);

-- 10. RLS Policies for admin_task_comments
CREATE POLICY "admin_task_comments_select" ON admin_task_comments
FOR SELECT USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
);

CREATE POLICY "admin_task_comments_insert" ON admin_task_comments
FOR INSERT WITH CHECK (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND user_id = auth.uid()
);

CREATE POLICY "admin_task_comments_update" ON admin_task_comments
FOR UPDATE USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND user_id = auth.uid()
);

CREATE POLICY "admin_task_comments_delete" ON admin_task_comments
FOR DELETE USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
    AND (user_id = auth.uid() OR (SELECT user_role FROM get_my_profile_info()) IN ('owner', 'manager'))
);

-- 11. RLS Policies for admin_task_history
CREATE POLICY "admin_task_history_select" ON admin_task_history
FOR SELECT USING (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
);

CREATE POLICY "admin_task_history_insert" ON admin_task_history
FOR INSERT WITH CHECK (
    tenant_id = (SELECT user_tenant_id FROM get_my_profile_info())
);

-- 12. Insert default categories for existing tenants
INSERT INTO admin_task_categories (tenant_id, name, color, is_default)
SELECT t.id, 'Tax', '#dc2626', true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM admin_task_categories c 
    WHERE c.tenant_id = t.id AND c.name = 'Tax'
);

INSERT INTO admin_task_categories (tenant_id, name, color, is_default)
SELECT t.id, 'Compliance', '#2563eb', true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM admin_task_categories c 
    WHERE c.tenant_id = t.id AND c.name = 'Compliance'
);

INSERT INTO admin_task_categories (tenant_id, name, color, is_default)
SELECT t.id, 'Financial', '#16a34a', true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM admin_task_categories c 
    WHERE c.tenant_id = t.id AND c.name = 'Financial'
);

-- 13. Add Admin Tasks module to modules table
INSERT INTO modules (id, name, description, monthly_price, is_premium_only, display_order) VALUES
    ('admin-tasks', 'Administrative Tasks', 'Task management with delegation, categories, and tracking', 19.99, false, 6)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price;

-- Add to subscription plans
INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES
    ('free', 'admin-tasks'),
    ('test_eval', 'admin-tasks'),
    ('premium', 'admin-tasks')
ON CONFLICT DO NOTHING;

-- Verify tables created
SELECT 'admin_task_categories' as table_name, count(*) as row_count FROM admin_task_categories
UNION ALL
SELECT 'admin_tasks', count(*) FROM admin_tasks
UNION ALL
SELECT 'admin_task_comments', count(*) FROM admin_task_comments
UNION ALL
SELECT 'admin_task_history', count(*) FROM admin_task_history;
