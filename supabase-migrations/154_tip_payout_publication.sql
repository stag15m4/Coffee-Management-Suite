-- Migration 154: Publish approved tip payouts to linked staff and preserve revisions
-- Requires migration 153. Creates the 141/142 approval baseline if it was missed.
-- Run the entire file including BEGIN and COMMIT.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tip_payout_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_key date NOT NULL,
  cash_tips numeric(10,2) NOT NULL,
  cc_tips numeric(10,2) NOT NULL,
  cc_fee_rate numeric(5,4) NOT NULL DEFAULT 0.0350,
  total_pool numeric(10,2) NOT NULL,
  total_hours numeric(8,2) NOT NULL,
  hourly_rate numeric(10,4) NOT NULL,
  distribution_method text NOT NULL DEFAULT 'hours',
  employee_payouts jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tip_approval_status CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT chk_positive_pool CHECK (total_pool >= 0),
  CONSTRAINT chk_distribution_method CHECK (distribution_method IN ('hours','equal','points'))
);
ALTER TABLE public.tip_payout_approvals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tip_payout_approvals'::regclass
    AND contype='u' AND conkey=ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid='public.tip_payout_approvals'::regclass AND attname='tenant_id'),
      (SELECT attnum FROM pg_attribute WHERE attrelid='public.tip_payout_approvals'::regclass AND attname='week_key')
    ]::smallint[]) THEN
    ALTER TABLE public.tip_payout_approvals ADD CONSTRAINT uq_tip_payout_approvals_tenant_week UNIQUE(tenant_id,week_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tip_payout_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.tip_payout_approvals(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  week_key date NOT NULL,
  previous_record jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tip_payout_approval_history_lookup
  ON public.tip_payout_approval_history (tenant_id, week_key, changed_at DESC);
ALTER TABLE public.tip_payout_approval_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers read tip approval history" ON public.tip_payout_approval_history;
CREATE POLICY "Managers read tip approval history" ON public.tip_payout_approval_history
  FOR SELECT TO authenticated USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
GRANT SELECT ON public.tip_payout_approval_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tip_payout_approval_history FROM PUBLIC, anon, authenticated;

-- The server verifies and writes approvals. Staff use the scoped /mine endpoint.
DROP POLICY IF EXISTS "Users can view tip payout approvals" ON public.tip_payout_approvals;
DROP POLICY IF EXISTS "Leads can create tip payout approvals" ON public.tip_payout_approvals;
DROP POLICY IF EXISTS "Managers can update tip payout approvals" ON public.tip_payout_approvals;
DROP POLICY IF EXISTS "Managers can delete tip payout approvals" ON public.tip_payout_approvals;
DROP POLICY IF EXISTS "Platform admins manage tip payout approvals" ON public.tip_payout_approvals;
DROP POLICY IF EXISTS "Managers read tip payout approvals" ON public.tip_payout_approvals;
CREATE POLICY "Managers read tip payout approvals" ON public.tip_payout_approvals
  FOR SELECT TO authenticated USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
GRANT SELECT ON public.tip_payout_approvals TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tip_payout_approvals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_tip_approval_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tip_payout_approval_history (approval_id, tenant_id, week_key, previous_record)
  VALUES (OLD.id, OLD.tenant_id, OLD.week_key, to_jsonb(OLD));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS record_tip_approval_revision ON public.tip_payout_approvals;
CREATE TRIGGER record_tip_approval_revision BEFORE UPDATE ON public.tip_payout_approvals
  FOR EACH ROW EXECUTE FUNCTION public.record_tip_approval_revision();
REVOKE ALL ON FUNCTION public.record_tip_approval_revision() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.invalidate_tip_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_week date;
BEGIN
  v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
  IF TG_TABLE_NAME = 'tip_employees' THEN
    IF TG_OP = 'UPDATE' AND (NEW.is_active, NEW.tip_eligible, NEW.name, NEW.user_profile_id)
      IS NOT DISTINCT FROM (OLD.is_active, OLD.tip_eligible, OLD.name, OLD.user_profile_id) THEN
      RETURN NEW;
    END IF;
    UPDATE public.tip_payout_approvals SET status = 'rejected', updated_at = now()
      WHERE tenant_id = v_tenant AND status = 'approved';
  ELSE
    v_week := COALESCE(NEW.week_key, OLD.week_key);
    IF TG_OP = 'UPDATE' THEN
      IF TG_TABLE_NAME = 'tip_weekly_data' AND
        (to_jsonb(NEW)->'cash_tips', to_jsonb(NEW)->'cc_tips', to_jsonb(NEW)->'cash_entries', to_jsonb(NEW)->'cc_entries')
        IS NOT DISTINCT FROM (to_jsonb(OLD)->'cash_tips', to_jsonb(OLD)->'cc_tips', to_jsonb(OLD)->'cash_entries', to_jsonb(OLD)->'cc_entries') THEN
        RETURN NEW;
      END IF;
      IF TG_TABLE_NAME = 'tip_employee_hours' AND
        (to_jsonb(NEW)->'hours', to_jsonb(NEW)->'employee_id') IS NOT DISTINCT FROM
        (to_jsonb(OLD)->'hours', to_jsonb(OLD)->'employee_id') THEN
        RETURN NEW;
      END IF;
    END IF;
    UPDATE public.tip_payout_approvals SET status = 'rejected', updated_at = now()
      WHERE tenant_id = v_tenant AND week_key = v_week AND status = 'approved';
    IF TG_OP = 'UPDATE' AND OLD.week_key IS DISTINCT FROM NEW.week_key THEN
      UPDATE public.tip_payout_approvals SET status = 'rejected', updated_at = now()
        WHERE tenant_id = OLD.tenant_id AND week_key = OLD.week_key AND status = 'approved';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_tip_approval() FROM PUBLIC;
DROP TRIGGER IF EXISTS invalidate_tip_week ON public.tip_weekly_data;
CREATE TRIGGER invalidate_tip_week AFTER INSERT OR UPDATE OR DELETE ON public.tip_weekly_data
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_tip_approval();
DROP TRIGGER IF EXISTS invalidate_tip_hours ON public.tip_employee_hours;
CREATE TRIGGER invalidate_tip_hours AFTER INSERT OR UPDATE OR DELETE ON public.tip_employee_hours
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_tip_approval();
DROP TRIGGER IF EXISTS invalidate_tip_roster ON public.tip_employees;
CREATE TRIGGER invalidate_tip_roster AFTER UPDATE ON public.tip_employees
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_tip_approval();

COMMIT;
