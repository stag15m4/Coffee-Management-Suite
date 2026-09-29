-- Migration 153: Staff IDs and explicit links between roster and login accounts
-- Requires migrations 072, 096, 131, 150, 151 and 152.
-- Run this entire file, including BEGIN and COMMIT. No names are auto-matched.
BEGIN;
SET LOCAL search_path = public;
DO $$ BEGIN
 IF to_regclass('public.tip_employees') IS NULL OR to_regclass('public.shifts') IS NULL OR to_regclass('public.shift_templates') IS NULL THEN
   RAISE EXCEPTION 'Migration 153 needs the existing tip roster and scheduling tables before it can run';
 END IF;
 IF to_regprocedure('public.invalidate_changed_timesheet()') IS NULL THEN
   RAISE EXCEPTION 'Run corrected migration 152 before migration 153';
 END IF;
END $$;
-- Establish the link column without migration 131's historical name-matching backfill.
ALTER TABLE tip_employees ADD COLUMN IF NOT EXISTS user_profile_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS staff_login_id text;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_staff_login_id ON user_profiles(lower(staff_login_id)) WHERE staff_login_id IS NOT NULL;
ALTER TABLE user_profiles ADD CONSTRAINT valid_staff_login_id CHECK (staff_login_id IS NULL OR staff_login_id ~ '^[a-z][a-z0-9._-]{2,39}$');

CREATE TABLE staff_identity_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 actor_id uuid NOT NULL, tip_employee_id uuid NOT NULL, user_profile_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE staff_identity_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read identity links" ON staff_identity_history FOR SELECT
 USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'::user_role));
GRANT SELECT ON staff_identity_history TO authenticated;

CREATE FUNCTION guard_staff_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
   IF TG_TABLE_NAME='user_profiles' AND ((TG_OP='INSERT' AND (to_jsonb(NEW)->>'staff_login_id') IS NOT NULL) OR (TG_OP='UPDATE' AND (to_jsonb(NEW)->>'staff_login_id') IS DISTINCT FROM (to_jsonb(OLD)->>'staff_login_id'))) THEN
     RAISE EXCEPTION 'Staff IDs are managed through Staff access';
   ELSIF TG_TABLE_NAME='tip_employees' AND ((TG_OP='INSERT' AND (to_jsonb(NEW)->>'user_profile_id') IS NOT NULL) OR (TG_OP='UPDATE' AND (to_jsonb(NEW)->>'user_profile_id') IS DISTINCT FROM (to_jsonb(OLD)->>'user_profile_id'))) THEN
     RAISE EXCEPTION 'Roster links are managed through Staff access';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_staff_identity BEFORE INSERT OR UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION guard_staff_identity();
CREATE TRIGGER guard_staff_identity BEFORE INSERT OR UPDATE ON tip_employees FOR EACH ROW EXECUTE FUNCTION guard_staff_identity();

-- This function is server-only. The actor is taken from a verified JWT by the route.
CREATE FUNCTION link_staff_identity(p_actor uuid,p_tenant uuid,p_tip uuid,p_profile uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE roster tip_employees; target user_profiles; actor_role user_role;
BEGIN
 SELECT role INTO actor_role FROM user_profiles WHERE id=p_actor AND tenant_id=p_tenant AND is_active;
 IF actor_role IS NULL OR actor_role NOT IN ('owner','manager') THEN RAISE EXCEPTION 'Manager access required'; END IF;
 SELECT * INTO target FROM user_profiles WHERE id=p_profile AND tenant_id=p_tenant AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account not found in this location'; END IF;
 IF actor_role <> 'owner' AND target.role <> 'employee' THEN RAISE EXCEPTION 'Only the owner can link a privileged account'; END IF;
 SELECT * INTO roster FROM tip_employees WHERE id=p_tip AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Roster employee not found in this location'; END IF;
 IF roster.user_profile_id IS NOT NULL AND roster.user_profile_id<>p_profile THEN RAISE EXCEPTION 'This roster employee is already linked to another account'; END IF;
 IF EXISTS (SELECT 1 FROM tip_employees WHERE tenant_id=p_tenant AND user_profile_id=p_profile AND id<>p_tip) THEN RAISE EXCEPTION 'This account already has a roster link'; END IF;
 IF EXISTS (SELECT 1 FROM time_clock_entries WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NOT NULL AND employee_id<>p_profile)
 OR EXISTS (SELECT 1 FROM shifts WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NOT NULL AND employee_id<>p_profile)
 OR EXISTS (SELECT 1 FROM shift_templates WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NOT NULL AND employee_id<>p_profile)
 THEN RAISE EXCEPTION 'Some history belongs to another account. Review the identities before linking'; END IF;
 IF EXISTS (SELECT 1 FROM time_clock_entries a JOIN time_clock_entries b ON a.id<>b.id AND a.clock_in<coalesce(b.clock_out,'infinity'::timestamptz) AND b.clock_in<coalesce(a.clock_out,'infinity'::timestamptz)
   WHERE a.tenant_id=p_tenant AND b.tenant_id=p_tenant AND a.tip_employee_id=p_tip AND b.employee_id=p_profile AND b.tip_employee_id IS DISTINCT FROM p_tip)
 THEN RAISE EXCEPTION 'Overlapping work sessions need review before linking'; END IF;
 UPDATE tip_employees SET user_profile_id=p_profile WHERE id=p_tip;
 PERFORM set_config('cms.time_change_reason','Staff identity linked by manager ' || p_actor::text,true);
 UPDATE time_clock_entries SET employee_id=p_profile WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NULL;
 UPDATE shifts SET employee_id=p_profile WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NULL;
 UPDATE shift_templates SET employee_id=p_profile WHERE tenant_id=p_tenant AND tip_employee_id=p_tip AND employee_id IS NULL;
 INSERT INTO staff_identity_history(tenant_id,actor_id,tip_employee_id,user_profile_id) VALUES(p_tenant,p_actor,p_tip,p_profile);
END $$;
REVOKE ALL ON FUNCTION link_staff_identity(uuid,uuid,uuid,uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION link_staff_identity(uuid,uuid,uuid,uuid) TO service_role;

-- Future kiosk/import/schedule writes using a linked roster ID keep the canonical account.
CREATE FUNCTION resolve_roster_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE linked uuid;
BEGIN
 IF NEW.tip_employee_id IS NOT NULL THEN
   SELECT user_profile_id INTO linked FROM tip_employees WHERE id=NEW.tip_employee_id AND tenant_id=NEW.tenant_id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Roster employee must belong to the same location'; END IF;
   IF linked IS NOT NULL THEN
     IF NEW.employee_id IS NOT NULL AND NEW.employee_id<>linked THEN RAISE EXCEPTION 'Roster and account identities do not match'; END IF;
     NEW.employee_id:=linked;
   END IF;
 END IF;
 RETURN NEW;
END $$;
-- Runs before approval invalidation so the correct employee's approval is reset.
CREATE TRIGGER aaa_0_resolve_staff BEFORE INSERT OR UPDATE ON time_clock_entries FOR EACH ROW EXECUTE FUNCTION resolve_roster_identity();
CREATE TRIGGER aaa_0_resolve_staff BEFORE INSERT OR UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION resolve_roster_identity();
CREATE TRIGGER aaa_0_resolve_staff BEFORE INSERT OR UPDATE ON shift_templates FOR EACH ROW EXECUTE FUNCTION resolve_roster_identity();
COMMIT;
