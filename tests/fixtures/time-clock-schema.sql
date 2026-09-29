CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'lead', 'employee');
CREATE TYPE time_off_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');
CREATE TABLE tenants (id uuid PRIMARY KEY);
CREATE TABLE user_profiles (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants, role user_role, full_name text, is_active boolean DEFAULT true);
CREATE FUNCTION can_access_tenant(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = t) $$;
CREATE FUNCTION has_role_or_higher(r user_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND CASE role WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'lead' THEN 2 ELSE 1 END >= CASE r WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'lead' THEN 2 ELSE 1 END) $$;
CREATE TABLE time_clock_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants, employee_id uuid REFERENCES user_profiles,
 clock_in timestamptz NOT NULL, clock_out timestamptz, source text DEFAULT 'manual', notes text,
 is_edited boolean DEFAULT false, edited_by uuid REFERENCES user_profiles, edited_at timestamptz,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE time_clock_breaks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
 time_clock_entry_id uuid NOT NULL REFERENCES time_clock_entries ON DELETE CASCADE,
 break_start timestamptz NOT NULL, break_end timestamptz, break_type text DEFAULT 'break', created_at timestamptz DEFAULT now()
);
CREATE TABLE time_clock_edit_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
 time_clock_entry_id uuid NOT NULL REFERENCES time_clock_entries ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES user_profiles,
 original_clock_in timestamptz NOT NULL, original_clock_out timestamptz,
 requested_clock_in timestamptz, requested_clock_out timestamptz, reason text NOT NULL,
 status time_off_status DEFAULT 'pending', reviewed_by uuid REFERENCES user_profiles,
 reviewed_at timestamptz, review_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE time_clock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read tenant entries" ON time_clock_entries FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "Employees can clock in" ON time_clock_entries FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND employee_id = auth.uid());
ALTER TABLE time_clock_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read tenant breaks" ON time_clock_breaks FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "Managers can delete breaks" ON time_clock_breaks FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
ALTER TABLE time_clock_edit_requests ENABLE ROW LEVEL SECURITY;
