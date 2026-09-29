BEGIN;

-- Permanent snapshots: no cascading foreign keys and no client write policies.
CREATE TABLE IF NOT EXISTS time_clock_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employee_id uuid,
  entry_id uuid NOT NULL,
  actor_id uuid,
  actor_name text,
  entity_type text NOT NULL,
  action text NOT NULL,
  reason text,
  old_value jsonb,
  new_value jsonb,
  transaction_id bigint NOT NULL DEFAULT txid_current(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS time_clock_audit_employee ON time_clock_audit_events(tenant_id, employee_id, created_at DESC);
ALTER TABLE time_clock_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own or managed time history" ON time_clock_audit_events;
CREATE POLICY "Read own or managed time history" ON time_clock_audit_events FOR SELECT
  USING (can_access_tenant(tenant_id) AND (employee_id = auth.uid() OR has_role_or_higher('manager'::user_role)));

CREATE OR REPLACE FUNCTION audit_time_clock_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  before_row jsonb;
  after_row jsonb;
  row_data jsonb;
  worker uuid;
  entry uuid;
  actor_label text;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  -- Break changes touch the parent version; avoid a second timestamp-only event.
  IF TG_OP = 'UPDATE' AND (before_row - ARRAY['updated_at', 'edited_at', 'edited_by', 'is_edited']) = (after_row - ARRAY['updated_at', 'edited_at', 'edited_by', 'is_edited']) THEN RETURN NEW; END IF;
  row_data := coalesce(after_row, before_row);
  IF TG_TABLE_NAME = 'time_clock_entries' THEN
    entry := (row_data->>'id')::uuid;
    worker := (row_data->>'employee_id')::uuid;
  ELSE
    entry := (row_data->>'time_clock_entry_id')::uuid;
    SELECT employee_id INTO worker FROM time_clock_entries WHERE id = entry;
  END IF;
  SELECT full_name INTO actor_label FROM user_profiles WHERE id = auth.uid();
  INSERT INTO time_clock_audit_events(tenant_id, employee_id, entry_id, actor_id, actor_name, entity_type, action, reason, old_value, new_value)
  VALUES ((row_data->>'tenant_id')::uuid, worker, entry, auth.uid(), actor_label,
    CASE WHEN TG_TABLE_NAME = 'time_clock_entries' THEN 'session' ELSE 'break' END,
    lower(TG_OP), nullif(current_setting('cms.time_change_reason', true), ''), before_row, after_row);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_time_clock_entry ON time_clock_entries;
CREATE TRIGGER audit_time_clock_entry BEFORE INSERT OR UPDATE OR DELETE ON time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();
DROP TRIGGER IF EXISTS audit_time_clock_break ON time_clock_breaks;
CREATE TRIGGER audit_time_clock_break BEFORE INSERT OR UPDATE OR DELETE ON time_clock_breaks
  FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();

-- Any break write invalidates an editor's previously fetched session version.
CREATE OR REPLACE FUNCTION touch_time_clock_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE time_clock_entries SET updated_at = clock_timestamp() WHERE id = OLD.time_clock_entry_id;
    RETURN OLD;
  END IF;
  UPDATE time_clock_entries SET updated_at = clock_timestamp() WHERE id = NEW.time_clock_entry_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS touch_time_clock_session ON time_clock_breaks;
CREATE TRIGGER touch_time_clock_session AFTER INSERT OR UPDATE OR DELETE ON time_clock_breaks
  FOR EACH ROW EXECUTE FUNCTION touch_time_clock_session();

CREATE OR REPLACE FUNCTION validate_work_session(p_in timestamptz, p_out timestamptz, p_breaks jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE b record; previous_end timestamptz;
BEGIN
  IF p_in IS NULL OR p_out IS NULL OR NOT isfinite(p_in) OR NOT isfinite(p_out) OR p_out <= p_in THEN
    RAISE EXCEPTION 'Enter a clock-out date and time after clock in';
  END IF;
  IF p_breaks IS NULL OR jsonb_typeof(p_breaks) <> 'array' THEN RAISE EXCEPTION 'Invalid breaks'; END IF;
  IF jsonb_array_length(p_breaks) > 30 THEN RAISE EXCEPTION 'Too many breaks'; END IF;
  FOR b IN SELECT * FROM jsonb_to_recordset(p_breaks) AS x(id uuid, break_start timestamptz, break_end timestamptz, break_type text) ORDER BY break_start LOOP
    IF b.break_start IS NULL OR b.break_end IS NULL OR b.break_end <= b.break_start
       OR b.break_start < p_in OR b.break_end > p_out OR b.break_start < previous_end THEN
      RAISE EXCEPTION 'Breaks must be complete, inside the session, and must not overlap';
    END IF;
    previous_end := b.break_end;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION validate_work_session(timestamptz, timestamptz, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION save_time_clock_session(
  p_tenant uuid, p_employee uuid, p_entry uuid, p_expected_updated_at timestamptz,
  p_clock_in timestamptz, p_clock_out timestamptz, p_breaks jsonb, p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing time_clock_entries%ROWTYPE;
  saved_id uuid;
  b record;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = p_tenant AND is_active = true AND role IN ('manager', 'owner')
  ) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_employee AND tenant_id = p_tenant) THEN
    RAISE EXCEPTION 'Employee not found in this business';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(p_reason) > 2000 THEN RAISE EXCEPTION 'A reason is required (up to 2000 characters)'; END IF;
  PERFORM validate_work_session(p_clock_in, p_clock_out, p_breaks);
  -- Serialize session edits/additions for this employee.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text || p_employee::text, 0));
  IF p_entry IS NOT NULL THEN
    SELECT * INTO existing FROM time_clock_entries WHERE id = p_entry AND tenant_id = p_tenant AND employee_id = p_employee FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'This session changed while you were editing. Close the editor, refresh, and try again';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM time_clock_entries WHERE tenant_id = p_tenant AND employee_id = p_employee
    AND (p_entry IS NULL OR id <> p_entry) AND clock_in < p_clock_out AND (clock_out IS NULL OR clock_out > p_clock_in)) THEN
    RAISE EXCEPTION 'This session overlaps another recorded session';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_breaks) AS x(id uuid)
    WHERE id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM time_clock_breaks owned_break WHERE owned_break.id = x.id AND owned_break.time_clock_entry_id = p_entry)) THEN
    RAISE EXCEPTION 'A break no longer belongs to this session';
  END IF;
  PERFORM set_config('cms.time_change_reason', btrim(p_reason), true);
  IF p_entry IS NULL THEN
    INSERT INTO time_clock_entries(tenant_id, employee_id, clock_in, clock_out, source, is_edited, edited_by, edited_at, updated_at)
    VALUES (p_tenant, p_employee, p_clock_in, p_clock_out, 'manual', true, auth.uid(), clock_timestamp(), clock_timestamp()) RETURNING id INTO saved_id;
  ELSE
    UPDATE time_clock_entries SET clock_in = p_clock_in, clock_out = p_clock_out, is_edited = true,
      edited_by = auth.uid(), edited_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = p_entry RETURNING id INTO saved_id;
  END IF;
  DELETE FROM time_clock_breaks WHERE time_clock_entry_id = saved_id
    AND id NOT IN (SELECT x.id FROM jsonb_to_recordset(p_breaks) AS x(id uuid) WHERE x.id IS NOT NULL);
  FOR b IN SELECT * FROM jsonb_to_recordset(p_breaks) AS x(id uuid, break_start timestamptz, break_end timestamptz, break_type text) LOOP
    IF b.id IS NULL THEN
      INSERT INTO time_clock_breaks(tenant_id, time_clock_entry_id, break_start, break_end, break_type)
      VALUES (p_tenant, saved_id, b.break_start, b.break_end, coalesce(nullif(b.break_type, ''), 'break'));
    ELSE
      UPDATE time_clock_breaks SET break_start = b.break_start, break_end = b.break_end,
        break_type = coalesce(nullif(b.break_type, ''), 'break') WHERE id = b.id AND time_clock_entry_id = saved_id;
    END IF;
  END LOOP;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION save_time_clock_session(uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_time_clock_session(uuid, uuid, uuid, timestamptz, timestamptz, timestamptz, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION delete_time_clock_session(p_entry uuid, p_expected_updated_at timestamptz, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e time_clock_entries%ROWTYPE;
BEGIN
  SELECT * INTO e FROM time_clock_entries WHERE id = p_entry FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
    AND tenant_id = e.tenant_id AND is_active = true AND role IN ('manager', 'owner')) THEN RAISE EXCEPTION 'Manager access required'; END IF;
  IF e.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Session changed. Refresh before deleting'; END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'A deletion reason is required'; END IF;
  IF EXISTS (SELECT 1 FROM time_clock_edit_requests WHERE time_clock_entry_id = p_entry) THEN
    RAISE EXCEPTION 'This session has correction requests and cannot be deleted';
  END IF;
  PERFORM set_config('cms.time_change_reason', btrim(p_reason), true);
  DELETE FROM time_clock_breaks WHERE time_clock_entry_id = p_entry;
  DELETE FROM time_clock_entries WHERE id = p_entry;
END;
$$;
REVOKE ALL ON FUNCTION delete_time_clock_session(uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_time_clock_session(uuid, timestamptz, text) TO authenticated;

CREATE TABLE IF NOT EXISTS time_clock_missing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  employee_id uuid NOT NULL REFERENCES user_profiles(id),
  clock_in timestamptz NOT NULL,
  clock_out timestamptz NOT NULL,
  breaks jsonb NOT NULL DEFAULT '[]',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS missing_time_requests_employee ON time_clock_missing_requests(tenant_id, employee_id, created_at DESC);
ALTER TABLE time_clock_missing_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own or managed missing sessions" ON time_clock_missing_requests;
CREATE POLICY "Read own or managed missing sessions" ON time_clock_missing_requests FOR SELECT
  USING (can_access_tenant(tenant_id) AND (employee_id = auth.uid() OR has_role_or_higher('manager'::user_role)));

CREATE OR REPLACE FUNCTION request_missing_time_session(p_tenant uuid, p_clock_in timestamptz, p_clock_out timestamptz, p_breaks jsonb, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = p_tenant AND is_active = true) THEN
    RAISE EXCEPTION 'Employee access required';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(p_reason) > 2000 THEN RAISE EXCEPTION 'A reason is required (up to 2000 characters)'; END IF;
  PERFORM validate_work_session(p_clock_in, p_clock_out, p_breaks);
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_breaks) AS x(id uuid) WHERE id IS NOT NULL) THEN RAISE EXCEPTION 'New session breaks cannot reference existing breaks'; END IF;
  INSERT INTO time_clock_missing_requests(tenant_id, employee_id, clock_in, clock_out, breaks, reason)
    VALUES (p_tenant, auth.uid(), p_clock_in, p_clock_out, p_breaks, btrim(p_reason)) RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION request_missing_time_session(uuid, timestamptz, timestamptz, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_missing_time_session(uuid, timestamptz, timestamptz, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION review_missing_time_session(p_id uuid, p_status text, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r time_clock_missing_requests%ROWTYPE; saved_id uuid;
BEGIN
  SELECT * INTO r FROM time_clock_missing_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF p_status = 'cancelled' THEN
    IF auth.uid() IS DISTINCT FROM r.employee_id THEN RAISE EXCEPTION 'You can cancel only your own request'; END IF;
  ELSIF p_status IN ('approved', 'denied') THEN
    IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = r.tenant_id
      AND is_active = true AND role IN ('manager', 'owner')) THEN RAISE EXCEPTION 'Manager approval required'; END IF;
  ELSE RAISE EXCEPTION 'Invalid review status'; END IF;
  IF p_status = 'approved' THEN
    saved_id := save_time_clock_session(r.tenant_id, r.employee_id, NULL, NULL, r.clock_in, r.clock_out, r.breaks, r.reason);
  END IF;
  UPDATE time_clock_missing_requests SET status = p_status, reviewed_by = auth.uid(), reviewed_at = clock_timestamp(),
    review_notes = p_notes, entry_id = saved_id WHERE id = p_id;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION review_missing_time_session(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_missing_time_session(uuid, text, text) TO authenticated;

-- Existing punch-correction approvals use the same validation and audited save.
CREATE OR REPLACE FUNCTION review_time_clock_edit(p_id uuid, p_approve boolean, p_notes text DEFAULT NULL)
RETURNS time_clock_edit_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r time_clock_edit_requests%ROWTYPE; e time_clock_entries%ROWTYPE; existing_breaks jsonb;
BEGIN
  SELECT * INTO r FROM time_clock_edit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = r.tenant_id
    AND is_active = true AND role IN ('manager', 'owner')) THEN RAISE EXCEPTION 'Manager approval required'; END IF;
  IF p_approve THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(r.tenant_id::text || r.employee_id::text, 0));
    SELECT * INTO e FROM time_clock_entries WHERE id = r.time_clock_entry_id AND tenant_id = r.tenant_id AND employee_id = r.employee_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    IF e.clock_in IS DISTINCT FROM r.original_clock_in OR e.clock_out IS DISTINCT FROM r.original_clock_out THEN
      RAISE EXCEPTION 'Time entry changed since the request; submit a new correction';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'break_start', break_start, 'break_end', break_end, 'break_type', break_type)), '[]'::jsonb)
      INTO existing_breaks FROM time_clock_breaks WHERE time_clock_entry_id = e.id;
    PERFORM save_time_clock_session(r.tenant_id, r.employee_id, e.id, e.updated_at,
      coalesce(r.requested_clock_in, e.clock_in), coalesce(r.requested_clock_out, e.clock_out), existing_breaks, r.reason);
  END IF;
  UPDATE time_clock_edit_requests SET status = CASE WHEN p_approve THEN 'approved'::time_off_status ELSE 'denied'::time_off_status END,
    reviewed_by = auth.uid(), reviewed_at = clock_timestamp(), review_notes = p_notes, updated_at = clock_timestamp()
    WHERE id = p_id RETURNING * INTO r;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION review_time_clock_edit(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_time_clock_edit(uuid, boolean, text) TO authenticated;

COMMIT;
