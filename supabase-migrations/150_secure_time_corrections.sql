-- Staff corrections are proposals. Only a manager's review may change a recorded punch.
DROP POLICY IF EXISTS "Employees and managers can update clock entries" ON time_clock_entries;
CREATE POLICY "Managers can update clock entries" ON time_clock_entries
  FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role))
  WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));

-- A normal clock-in is current. Backdated entries go through a manager.
CREATE OR REPLACE FUNCTION guard_staff_time_clock_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role_or_higher('manager'::user_role)
     AND (abs(extract(epoch FROM (NEW.clock_in - now()))) > 120 OR NEW.clock_out IS NOT NULL
          OR NEW.is_edited IS TRUE OR NEW.edited_by IS NOT NULL OR NEW.edited_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Time corrections require manager approval';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_staff_time_clock_insert ON time_clock_entries;
CREATE TRIGGER guard_staff_time_clock_insert BEFORE INSERT ON time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION guard_staff_time_clock_insert();

-- Staff can start and end their own live break; changing a recorded break needs a manager.
DROP POLICY IF EXISTS "Employees can manage breaks" ON time_clock_breaks;
CREATE POLICY "Employees can start own breaks" ON time_clock_breaks
  FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND (has_role_or_higher('manager'::user_role) OR EXISTS (
    SELECT 1 FROM time_clock_entries e WHERE e.id = time_clock_entry_id
      AND e.tenant_id = time_clock_breaks.tenant_id AND e.employee_id = auth.uid() AND e.clock_out IS NULL)));
DROP POLICY IF EXISTS "Employees can update breaks" ON time_clock_breaks;
CREATE POLICY "Employees can end own breaks" ON time_clock_breaks
  FOR UPDATE USING (can_access_tenant(tenant_id) AND (
    has_role_or_higher('manager'::user_role) OR EXISTS (
      SELECT 1 FROM time_clock_entries e WHERE e.id = time_clock_entry_id
        AND e.tenant_id = time_clock_breaks.tenant_id AND e.employee_id = auth.uid() AND e.clock_out IS NULL)))
  WITH CHECK (can_access_tenant(tenant_id));

CREATE OR REPLACE FUNCTION guard_staff_break_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role_or_higher('manager'::user_role) THEN
    IF TG_OP = 'INSERT' THEN
      IF abs(extract(epoch FROM (NEW.break_start - now()))) > 120 OR NEW.break_end IS NOT NULL THEN
        RAISE EXCEPTION 'Break corrections require manager approval';
      END IF;
    ELSIF OLD.break_end IS NOT NULL OR NEW.break_end IS NULL
       OR NEW.break_end < OLD.break_start
       OR abs(extract(epoch FROM (NEW.break_end - now()))) > 120
       OR (to_jsonb(NEW) - 'break_end') IS DISTINCT FROM (to_jsonb(OLD) - 'break_end') THEN
      RAISE EXCEPTION 'Break corrections require manager approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_staff_break_change ON time_clock_breaks;
CREATE TRIGGER guard_staff_break_change BEFORE INSERT OR UPDATE ON time_clock_breaks
  FOR EACH ROW EXECUTE FUNCTION guard_staff_break_change();

-- No client may mark a request approved without applying the punch atomically.
DROP POLICY IF EXISTS "Users can view time clock edit requests" ON time_clock_edit_requests;
CREATE POLICY "Employees see own corrections and managers see tenant corrections" ON time_clock_edit_requests
  FOR SELECT USING (can_access_tenant(tenant_id) AND
    (employee_id = auth.uid() OR has_role_or_higher('manager'::user_role)));
DROP POLICY IF EXISTS "Employees and leads can update edit requests" ON time_clock_edit_requests;
DROP POLICY IF EXISTS "Employees can delete own pending, managers can delete any" ON time_clock_edit_requests;
-- Keep request history even if a manager later tries to delete the entry.
ALTER TABLE time_clock_edit_requests
  DROP CONSTRAINT IF EXISTS time_clock_edit_requests_time_clock_entry_id_fkey;
ALTER TABLE time_clock_edit_requests
  ADD CONSTRAINT time_clock_edit_requests_time_clock_entry_id_fkey
  FOREIGN KEY (time_clock_entry_id) REFERENCES time_clock_entries(id) ON DELETE RESTRICT;
DROP POLICY IF EXISTS "Employees can request edits for own entries" ON time_clock_edit_requests;
CREATE POLICY "Employees can propose own punch corrections" ON time_clock_edit_requests
  FOR INSERT WITH CHECK (
    can_access_tenant(tenant_id) AND employee_id = auth.uid() AND status = 'pending'
    AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_notes IS NULL
    AND length(btrim(reason)) > 0
    AND abs(extract(epoch FROM (created_at - now()))) < 120
    AND abs(extract(epoch FROM (updated_at - now()))) < 120
    AND (requested_clock_in IS NOT NULL OR requested_clock_out IS NOT NULL)
    AND EXISTS (SELECT 1 FROM time_clock_entries e WHERE e.id = time_clock_entry_id
      AND e.tenant_id = time_clock_edit_requests.tenant_id AND e.employee_id = auth.uid()
      AND e.clock_in = original_clock_in
      AND e.clock_out IS NOT DISTINCT FROM original_clock_out));

CREATE OR REPLACE FUNCTION review_time_clock_edit(p_id uuid, p_approve boolean, p_notes text DEFAULT NULL)
RETURNS time_clock_edit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r time_clock_edit_requests%ROWTYPE;
  e time_clock_entries%ROWTYPE;
  reviewer uuid := auth.uid();
BEGIN
  IF reviewer IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO r FROM time_clock_edit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = reviewer AND tenant_id = r.tenant_id
    AND is_active = true AND role IN ('manager', 'owner')) THEN
    RAISE EXCEPTION 'Manager approval required';
  END IF;
  SELECT * INTO e FROM time_clock_entries WHERE id = r.time_clock_entry_id AND tenant_id = r.tenant_id
    AND employee_id = r.employee_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Time entry missing'; END IF;
  IF p_approve THEN
    IF e.clock_in IS DISTINCT FROM r.original_clock_in
       OR e.clock_out IS DISTINCT FROM r.original_clock_out THEN
      RAISE EXCEPTION 'Time entry changed since the request; submit a new correction';
    END IF;
    IF coalesce(r.requested_clock_in, e.clock_in) >= coalesce(r.requested_clock_out, e.clock_out, 'infinity'::timestamptz) THEN
      RAISE EXCEPTION 'Clock out must follow clock in';
    END IF;
    IF r.requested_clock_out IS NOT NULL AND EXISTS (
      SELECT 1 FROM time_clock_breaks WHERE time_clock_entry_id = e.id AND break_end IS NULL
    ) THEN
      RAISE EXCEPTION 'End or correct the open break before approving clock out';
    END IF;
    UPDATE time_clock_entries SET clock_in = coalesce(r.requested_clock_in, clock_in),
      clock_out = coalesce(r.requested_clock_out, clock_out), is_edited = true,
      edited_by = reviewer, edited_at = now(), updated_at = now() WHERE id = e.id;
  END IF;
  UPDATE time_clock_edit_requests SET status = CASE WHEN p_approve THEN 'approved'::time_off_status
      ELSE 'denied'::time_off_status END, reviewed_by = reviewer, reviewed_at = now(),
      review_notes = p_notes, updated_at = now() WHERE id = p_id RETURNING * INTO r;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION review_time_clock_edit(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION review_time_clock_edit(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION cancel_time_clock_edit(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE time_clock_edit_requests SET status = 'cancelled', updated_at = now()
    WHERE id = p_id AND employee_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending request not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION cancel_time_clock_edit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_time_clock_edit(uuid) TO authenticated;
