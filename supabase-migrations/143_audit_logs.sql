CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only owners and managers can view audit logs
CREATE POLICY "audit_logs_select" ON audit_logs
FOR SELECT USING (
  can_access_tenant(tenant_id)
  AND has_role_or_higher('manager')
);

-- INSERT is allowed for any authenticated user (server writes on their behalf)
CREATE POLICY "audit_logs_insert" ON audit_logs
FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

-- No UPDATE or DELETE — audit logs are immutable
-- Platform admin override
CREATE POLICY "audit_logs_admin" ON audit_logs
FOR ALL USING (
  EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true)
);
