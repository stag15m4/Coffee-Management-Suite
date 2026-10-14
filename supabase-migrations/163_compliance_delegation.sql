-- Migration 163: Accountable-owner compliance delegation and verified completion.
-- Prerequisites: 036 (Administrative Tasks), 091 (Calendar Events).
-- Source clients can submit evidence through their app, but only the Legal
-- workflow service can close a delegated obligation and generate its renewal.
BEGIN;
CREATE TABLE IF NOT EXISTS public.compliance_workflow_links (
  task_id UUID PRIMARY KEY REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  obligation_id UUID NOT NULL,
  parent_obligation_id UUID,
  is_placeholder BOOLEAN NOT NULL DEFAULT false,
  revision INTEGER NOT NULL,
  owner_name TEXT NOT NULL,
  assignee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  evidence_requirements TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.compliance_workflow_receipts (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compliance_workflow_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_workflow_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compliance_links_read ON public.compliance_workflow_links;
CREATE POLICY compliance_links_read ON public.compliance_workflow_links FOR SELECT
  USING (can_read_tenant_data(tenant_id));
-- No client write policies, including for owners. Only the server workflow
-- credential can apply verification commands through the backend connection.
CREATE OR REPLACE FUNCTION public.guard_verified_compliance_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF COALESCE(current_setting('cms.compliance_verified',true),'')='on' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM compliance_workflow_links WHERE task_id=OLD.id) THEN
      RAISE EXCEPTION 'Delegated compliance duties must retain their verification history';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' AND NEW.parent_task_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM compliance_workflow_links WHERE task_id=NEW.parent_task_id) THEN
    RAISE EXCEPTION 'Only verified completion can create this compliance renewal';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR
     (OLD.status='completed' AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.recurrence IS DISTINCT FROM OLD.recurrence)))
     AND EXISTS(SELECT 1 FROM compliance_workflow_links WHERE task_id=OLD.id) THEN
    RAISE EXCEPTION 'Submit this compliance duty for owner verification';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_verified_compliance_task ON public.admin_tasks;
CREATE TRIGGER guard_verified_compliance_task BEFORE INSERT OR UPDATE OR DELETE
  ON public.admin_tasks FOR EACH ROW EXECUTE FUNCTION public.guard_verified_compliance_task();
COMMIT;
