BEGIN;
SET LOCAL search_path = public;

-- Some installations never received the approval-table portion of migration 094.
-- Create that baseline when absent; preserve existing tables and approval rows.
CREATE TABLE IF NOT EXISTS timesheet_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    manager_notes TEXT,
    employee_notes TEXT,
    total_regular_hours DECIMAL(8,2),
    total_break_hours DECIMAL(8,2),
    total_pto_hours DECIMAL(8,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ts_approval_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT uq_ts_approval UNIQUE (tenant_id, employee_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_ts_approval_tenant ON timesheet_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ts_approval_employee ON timesheet_approvals(employee_id);
CREATE INDEX IF NOT EXISTS idx_ts_approval_period ON timesheet_approvals(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_ts_approval_status ON timesheet_approvals(status);

ALTER TABLE timesheet_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view timesheet approvals" ON timesheet_approvals;
CREATE POLICY "Users can view timesheet approvals" ON timesheet_approvals
  FOR SELECT USING (can_access_tenant(tenant_id));


ALTER TABLE timesheet_approvals ADD COLUMN IF NOT EXISTS invalidated_at timestamptz;
ALTER TABLE timesheet_approvals ADD COLUMN IF NOT EXISTS invalidation_reason text;
ALTER TABLE timesheet_approvals ADD COLUMN IF NOT EXISTS period_timezone text;
ALTER TABLE timesheet_approvals ADD COLUMN IF NOT EXISTS approval_count integer NOT NULL DEFAULT 0;
UPDATE timesheet_approvals SET approval_count = 1 WHERE approved_at IS NOT NULL AND approval_count = 0;

CREATE TABLE IF NOT EXISTS timesheet_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, employee_id uuid NOT NULL, approval_id uuid NOT NULL,
  actor_id uuid, old_value jsonb, new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE timesheet_approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or managed approval history" ON timesheet_approval_history FOR SELECT
  USING (can_access_tenant(tenant_id) AND (employee_id = auth.uid() OR has_role_or_higher('manager'::user_role)));
CREATE FUNCTION audit_timesheet_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO timesheet_approval_history(tenant_id,employee_id,approval_id,actor_id,old_value,new_value)
  VALUES (NEW.tenant_id,NEW.employee_id,NEW.id,auth.uid(),CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER audit_timesheet_approval AFTER INSERT OR UPDATE ON timesheet_approvals
  FOR EACH ROW EXECUTE FUNCTION audit_timesheet_approval();

-- Client writes must use the guarded review RPC, including clients open before deployment.
REVOKE INSERT, UPDATE, DELETE ON timesheet_approvals FROM authenticated, anon, PUBLIC;
GRANT SELECT ON timesheet_approvals, timesheet_approval_history TO authenticated;

CREATE FUNCTION invalidate_timesheet_window(t uuid, e uuid, start_at timestamptz, end_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE timesheet_approvals a SET status = 'pending', approved_by = NULL, approved_at = NULL,
    total_regular_hours = NULL, total_break_hours = NULL, total_pto_hours = NULL,
    invalidated_at = clock_timestamp(), invalidation_reason = 'Recorded time changed after approval. Review and approve this pay period again.',
    updated_at = clock_timestamp()
  WHERE a.tenant_id = t AND a.employee_id = e AND a.status = 'approved'
    -- Legacy approvals have no timezone. Conservatively include adjacent dates.
    AND start_at < ((a.period_end + 1)::timestamp AT TIME ZONE coalesce(a.period_timezone,'UTC')) + CASE WHEN a.period_timezone IS NULL THEN interval '1 day' ELSE interval '0' END
    AND coalesce(end_at,'infinity'::timestamptz) > (a.period_start::timestamp AT TIME ZONE coalesce(a.period_timezone,'UTC')) - CASE WHEN a.period_timezone IS NULL THEN interval '1 day' ELSE interval '0' END;
END $$;
REVOKE ALL ON FUNCTION invalidate_timesheet_window(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC;

-- All writers (including integrations and old clients) share this short transaction lock
-- with approval/export checks. A later write always invalidates an earlier approval.
CREATE FUNCTION invalidate_changed_timesheet() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_row jsonb; new_row jsonb; r record; tenant_key uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'time_clock_entries' AND
      (old_row->'tenant_id',old_row->'employee_id',old_row->'clock_in',old_row->'clock_out') IS NOT DISTINCT FROM
      (new_row->'tenant_id',new_row->'employee_id',new_row->'clock_in',new_row->'clock_out') THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'time_clock_breaks' AND
      (old_row - ARRAY['updated_at','created_at']) = (new_row - ARRAY['updated_at','created_at']) THEN RETURN NEW; END IF;
  END IF;
  FOR tenant_key IN SELECT DISTINCT v FROM unnest(ARRAY[(old_row->>'tenant_id')::uuid,(new_row->>'tenant_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('timesheet:' || tenant_key::text,0));
  END LOOP;
  IF TG_TABLE_NAME = 'time_clock_entries' THEN
    IF old_row IS NOT NULL THEN PERFORM invalidate_timesheet_window(OLD.tenant_id,OLD.employee_id,OLD.clock_in,OLD.clock_out); END IF;
    IF new_row IS NOT NULL THEN
      PERFORM invalidate_timesheet_window(NEW.tenant_id,NEW.employee_id,NEW.clock_in,NEW.clock_out);
      NEW.updated_at := clock_timestamp();
    END IF;
  ELSE
    FOR r IN SELECT * FROM time_clock_entries WHERE id IN ((old_row->>'time_clock_entry_id')::uuid,(new_row->>'time_clock_entry_id')::uuid) LOOP
      PERFORM invalidate_timesheet_window(r.tenant_id,r.employee_id,r.clock_in,r.clock_out);
    END LOOP;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER aaa_invalidate_timesheet BEFORE INSERT OR UPDATE OR DELETE ON time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION invalidate_changed_timesheet();
CREATE TRIGGER aaa_invalidate_timesheet BEFORE INSERT OR UPDATE OR DELETE ON time_clock_breaks
  FOR EACH ROW EXECUTE FUNCTION invalidate_changed_timesheet();

CREATE FUNCTION timesheet_snapshot(t uuid,e uuid,start_at timestamptz,end_at timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'employee_id',employee_id,'clock_in',clock_in,'clock_out',clock_out,'updated_at',updated_at) ORDER BY id),'[]'::jsonb)
  FROM time_clock_entries WHERE tenant_id=t AND (e IS NULL OR employee_id=e)
    AND clock_in < end_at AND coalesce(clock_out,'infinity'::timestamptz) > start_at;
$$;
CREATE FUNCTION normalize_timesheet_snapshot(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb)
  FROM jsonb_to_recordset(value) r(id uuid,employee_id uuid,clock_in timestamptz,clock_out timestamptz,updated_at timestamptz);
$$;
REVOKE ALL ON FUNCTION timesheet_snapshot(uuid,uuid,timestamptz,timestamptz), normalize_timesheet_snapshot(jsonb) FROM PUBLIC;

CREATE FUNCTION review_timesheet_period(p_tenant uuid,p_employee uuid,p_start date,p_end date,p_timezone text,
  p_expected jsonb,p_approve boolean,p_notes text DEFAULT NULL)
RETURNS timesheet_approvals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE start_at timestamptz; end_at timestamptz; snapshot jsonb; result timesheet_approvals; gross numeric; breaks numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND tenant_id=p_tenant AND is_active AND role IN ('owner','manager'))
    OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id=p_employee AND tenant_id=p_tenant)
    THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start OR p_end-p_start > 62 OR p_timezone IS NULL OR p_approve IS NULL
    THEN RAISE EXCEPTION 'Invalid pay period'; END IF;
  start_at := p_start::timestamp AT TIME ZONE p_timezone;
  end_at := (p_end+1)::timestamp AT TIME ZONE p_timezone;
  PERFORM pg_advisory_xact_lock(hashtextextended('timesheet:' || p_tenant::text,0));
  snapshot := timesheet_snapshot(p_tenant,p_employee,start_at,end_at);
  IF p_approve THEN
    IF EXISTS (SELECT 1 FROM timesheet_approvals WHERE tenant_id=p_tenant AND employee_id=p_employee AND period_start=p_start AND period_end=p_end AND status='approved' AND period_timezone=p_timezone) THEN RAISE EXCEPTION 'This pay period is already approved'; END IF;
    IF p_expected IS NULL OR normalize_timesheet_snapshot(p_expected) <> snapshot THEN
      RAISE EXCEPTION 'Recorded time changed. Refresh the timesheet and review it again.'; END IF;
    IF EXISTS (SELECT 1 FROM time_clock_entries WHERE tenant_id=p_tenant AND employee_id=p_employee AND clock_in < end_at AND clock_out IS NULL)
      THEN RAISE EXCEPTION 'End open work sessions before approving this pay period'; END IF;
    IF EXISTS (SELECT 1 FROM time_clock_edit_requests WHERE tenant_id=p_tenant AND employee_id=p_employee AND status='pending' AND time_clock_entry_id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(snapshot) v))
      OR EXISTS (SELECT 1 FROM time_clock_missing_requests WHERE tenant_id=p_tenant AND employee_id=p_employee AND status='pending' AND clock_in < end_at AND clock_out > start_at)
      THEN RAISE EXCEPTION 'Review pending time corrections before approving this pay period'; END IF;
    IF EXISTS (SELECT 1 FROM time_clock_breaks WHERE time_clock_entry_id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(snapshot) v) AND break_end IS NULL) THEN RAISE EXCEPTION 'End open breaks before approving this pay period'; END IF;
    SELECT coalesce(sum(extract(epoch FROM least(clock_out,end_at)-greatest(clock_in,start_at))/3600),0) INTO gross
      FROM time_clock_entries WHERE tenant_id=p_tenant AND employee_id=p_employee AND clock_in < end_at AND clock_out > start_at;
    SELECT coalesce(sum(greatest(0,extract(epoch FROM least(b.break_end,end_at,e.clock_out)-greatest(b.break_start,start_at,e.clock_in))/3600)),0) INTO breaks
      FROM time_clock_breaks b JOIN time_clock_entries e ON e.id=b.time_clock_entry_id
      WHERE e.tenant_id=p_tenant AND e.employee_id=p_employee AND e.clock_in < end_at AND e.clock_out > start_at;
  END IF;
  INSERT INTO timesheet_approvals(tenant_id,employee_id,period_start,period_end,period_timezone,status,approved_by,approved_at,manager_notes,total_regular_hours,total_break_hours,approval_count)
  VALUES(p_tenant,p_employee,p_start,p_end,p_timezone,CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,auth.uid(),clock_timestamp(),p_notes,greatest(0,gross-breaks),breaks,CASE WHEN p_approve THEN 1 ELSE 0 END)
  ON CONFLICT (tenant_id,employee_id,period_start,period_end) DO UPDATE SET
    status=excluded.status,period_timezone=excluded.period_timezone,approved_by=excluded.approved_by,approved_at=excluded.approved_at,
    manager_notes=excluded.manager_notes,total_regular_hours=excluded.total_regular_hours,total_break_hours=excluded.total_break_hours,
    invalidated_at=NULL,invalidation_reason=NULL,updated_at=clock_timestamp(),
    approval_count=timesheet_approvals.approval_count + CASE WHEN p_approve THEN 1 ELSE 0 END
  RETURNING * INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION review_timesheet_period(uuid,uuid,date,date,text,jsonb,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_timesheet_period(uuid,uuid,date,date,text,jsonb,boolean,text) TO authenticated;

CREATE FUNCTION validate_timesheet_export(p_tenant uuid,p_start date,p_end date,p_timezone text,p_expected jsonb)
RETURNS SETOF timesheet_approvals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE start_at timestamptz; end_at timestamptz; snapshot jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id=auth.uid() AND tenant_id=p_tenant AND is_active AND role IN ('owner','manager')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start OR p_end-p_start > 62 OR p_timezone IS NULL THEN RAISE EXCEPTION 'Invalid pay period'; END IF;
  start_at := p_start::timestamp AT TIME ZONE p_timezone; end_at := (p_end+1)::timestamp AT TIME ZONE p_timezone;
  PERFORM pg_advisory_xact_lock(hashtextextended('timesheet:' || p_tenant::text,0));
  snapshot := timesheet_snapshot(p_tenant,NULL,start_at,end_at);
  IF p_expected IS NULL OR normalize_timesheet_snapshot(p_expected) <> snapshot THEN RAISE EXCEPTION 'Recorded time changed. Refresh before exporting.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot) v WHERE NOT EXISTS (
    SELECT 1 FROM timesheet_approvals a WHERE a.tenant_id=p_tenant AND a.employee_id=(v->>'employee_id')::uuid AND a.period_start=p_start AND a.period_end=p_end
      AND a.status='approved' AND a.period_timezone=p_timezone)) THEN RAISE EXCEPTION 'Every timesheet must be approved for this pay period before exporting. Review any changes and approve again.'; END IF;
  IF EXISTS (SELECT 1 FROM time_clock_missing_requests WHERE tenant_id=p_tenant AND status='pending' AND clock_in < end_at AND clock_out > start_at) OR EXISTS (SELECT 1 FROM time_clock_edit_requests WHERE tenant_id=p_tenant AND status='pending' AND time_clock_entry_id IN (SELECT (v->>'id')::uuid FROM jsonb_array_elements(snapshot) v)) THEN RAISE EXCEPTION 'Review pending time corrections before exporting'; END IF;
  RETURN QUERY SELECT * FROM timesheet_approvals WHERE tenant_id=p_tenant AND period_start=p_start AND period_end=p_end AND status='approved';
END $$;
REVOKE ALL ON FUNCTION validate_timesheet_export(uuid,date,date,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_timesheet_export(uuid,date,date,text,jsonb) TO authenticated;
-- Existing approvals were made without a checked snapshot or recorded timezone.
-- Preserve their history, then require one review under the new protections.
UPDATE timesheet_approvals SET status='pending',approved_by=NULL,approved_at=NULL,
  total_regular_hours=NULL,total_break_hours=NULL,total_pto_hours=NULL,
  invalidated_at=clock_timestamp(),invalidation_reason='Review this pay period under the updated approval checks.',updated_at=clock_timestamp()
WHERE status='approved' AND period_timezone IS NULL;
COMMIT;
