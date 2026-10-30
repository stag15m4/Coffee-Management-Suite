-- Migration 164: Restrict audit-log writes to trusted server connections.
-- Prerequisites: migration 143 (audit_logs) and its tenant/role helper functions.
-- This does not make records immutable against the database owner or superusers.
BEGIN;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Browser sessions must never supply an audit actor, event or timestamp.
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_admin ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_platform_admin_select ON public.audit_logs;

-- Preserve platform-admin visibility without the previous FOR ALL write override.
CREATE POLICY audit_logs_platform_admin_select ON public.audit_logs
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND is_active = true
  )
);

-- Table privileges also deny TRUNCATE (which RLS does not govern).
-- Keep audit_logs_select from 143 for authorized tenant manager/owner reads.
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

-- Existing Node writers use DATABASE_URL and remain responsible for authorization
-- and actor attribution. A custom least-privilege DB login needs SELECT/INSERT.
-- Owner-driven tenant deletion still follows the existing ON DELETE CASCADE.
COMMIT;
