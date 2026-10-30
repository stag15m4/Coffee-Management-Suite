-- Migration 164: Restrict audit-log writes to trusted server connections.
-- Creates the audit table if migration 143 was never applied; otherwise hardens it.
-- Prerequisites: tenants, platform_admins, auth.uid(), can_access_tenant(uuid),
-- and has_role_or_higher() from the existing tenant/auth schema.
-- This does not make records immutable against the database owner or superusers.
BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Browser sessions must never supply an audit actor, event or timestamp.
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_admin ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_platform_admin_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;

CREATE POLICY audit_logs_select ON public.audit_logs
FOR SELECT TO authenticated USING (
  public.can_access_tenant(tenant_id) AND public.has_role_or_higher('manager')
);

-- Preserve platform-admin visibility without the previous FOR ALL write override.
CREATE POLICY audit_logs_platform_admin_select ON public.audit_logs
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND is_active = true
  )
);

-- Table privileges also deny TRUNCATE (which RLS does not govern).
-- The SELECT policies retain authorized tenant and platform-admin visibility.
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

-- Existing Node writers use DATABASE_URL and remain responsible for authorization
-- and actor attribution. A custom least-privilege DB login needs SELECT/INSERT.
-- Owner-driven tenant deletion still follows the existing ON DELETE CASCADE.
COMMIT;
