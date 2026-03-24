-- Migration 137: Staff Training & Certification Tracking
-- Adds tables for tracking employee training classes, certifications, and recertification dates.
-- Training classes support multiple attendees; certifications can be standalone or linked to a class.

-- ─── CERTIFICATION TYPES (reusable catalog) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS certification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_validity_months INT,
  issuing_body TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE certification_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_types_select" ON certification_types
  FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "cert_types_insert" ON certification_types
  FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "cert_types_update" ON certification_types
  FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "cert_types_delete" ON certification_types
  FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE INDEX idx_cert_types_tenant ON certification_types(tenant_id);

CREATE TRIGGER cert_types_updated_at
  BEFORE UPDATE ON certification_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRAINING CLASSES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT,
  location TEXT,
  class_date DATE NOT NULL,
  end_date DATE,
  duration_hours DECIMAL(5,2),
  cost DECIMAL(10,2),
  cost_per_person BOOLEAN DEFAULT false,
  certification_type_id UUID REFERENCES certification_types(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE training_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_classes_select" ON training_classes
  FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "training_classes_insert" ON training_classes
  FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "training_classes_update" ON training_classes
  FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "training_classes_delete" ON training_classes
  FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE INDEX idx_training_classes_tenant ON training_classes(tenant_id, class_date DESC);

CREATE TRIGGER training_classes_updated_at
  BEFORE UPDATE ON training_classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRAINING ATTENDANCE (join: employees → classes) ─────────────────────────

CREATE TABLE IF NOT EXISTS training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  training_class_id UUID NOT NULL REFERENCES training_classes(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  tip_employee_id UUID REFERENCES tip_employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'attended' CHECK (status IN ('registered', 'attended', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT training_attendance_has_employee CHECK (employee_id IS NOT NULL OR tip_employee_id IS NOT NULL)
);

-- Unique constraints — prevent duplicate attendance per class
CREATE UNIQUE INDEX idx_training_attendance_class_emp
  ON training_attendance(training_class_id, employee_id) WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX idx_training_attendance_class_tip
  ON training_attendance(training_class_id, tip_employee_id) WHERE tip_employee_id IS NOT NULL;

ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_attend_select" ON training_attendance
  FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "training_attend_insert" ON training_attendance
  FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "training_attend_update" ON training_attendance
  FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "training_attend_delete" ON training_attendance
  FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE INDEX idx_training_attendance_class ON training_attendance(training_class_id);
CREATE INDEX idx_training_attendance_employee ON training_attendance(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_training_attendance_tip_employee ON training_attendance(tip_employee_id) WHERE tip_employee_id IS NOT NULL;

-- ─── EMPLOYEE CERTIFICATIONS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  certification_type_id UUID NOT NULL REFERENCES certification_types(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  tip_employee_id UUID REFERENCES tip_employees(id) ON DELETE SET NULL,
  training_class_id UUID REFERENCES training_classes(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE,
  certificate_number TEXT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending_renewal')),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT employee_cert_has_employee CHECK (employee_id IS NOT NULL OR tip_employee_id IS NOT NULL)
);

ALTER TABLE employee_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emp_certs_select" ON employee_certifications
  FOR SELECT USING (can_access_tenant(tenant_id));
CREATE POLICY "emp_certs_insert" ON employee_certifications
  FOR INSERT WITH CHECK (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "emp_certs_update" ON employee_certifications
  FOR UPDATE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
CREATE POLICY "emp_certs_delete" ON employee_certifications
  FOR DELETE USING (can_access_tenant(tenant_id) AND has_role_or_higher('manager'));

CREATE INDEX idx_emp_certs_tenant ON employee_certifications(tenant_id);
CREATE INDEX idx_emp_certs_employee ON employee_certifications(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_emp_certs_tip_employee ON employee_certifications(tip_employee_id) WHERE tip_employee_id IS NOT NULL;
CREATE INDEX idx_emp_certs_expiry ON employee_certifications(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_emp_certs_cert_type ON employee_certifications(certification_type_id);

CREATE TRIGGER emp_certs_updated_at
  BEFORE UPDATE ON employee_certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
