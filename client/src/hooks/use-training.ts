import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CertificationType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  default_validity_months: number | null;
  issuing_body: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingClass {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  provider: string | null;
  location: string | null;
  class_date: string;
  end_date: string | null;
  duration_hours: number | null;
  cost: number | null;
  cost_per_person: boolean;
  certification_type_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  certification_type?: { name: string } | null;
  attendance?: TrainingAttendance[];
}

export interface TrainingAttendance {
  id: string;
  tenant_id: string;
  training_class_id: string;
  employee_id: string | null;
  tip_employee_id: string | null;
  status: 'registered' | 'attended' | 'no_show' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface EmployeeCertification {
  id: string;
  tenant_id: string;
  certification_type_id: string;
  employee_id: string | null;
  tip_employee_id: string | null;
  training_class_id: string | null;
  issue_date: string;
  expiry_date: string | null;
  certificate_number: string | null;
  document_url: string | null;
  status: 'active' | 'expired' | 'revoked' | 'pending_renewal';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  certification_type?: { name: string; issuing_body: string | null } | null;
  training_class?: { name: string; class_date: string } | null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const keys = {
  certTypes: (tenantId?: string) => ['cert-types', tenantId] as const,
  trainingClasses: (tenantId?: string) => ['training-classes', tenantId] as const,
  attendance: (classId?: string) => ['training-attendance', classId] as const,
  certifications: (tenantId?: string) => ['employee-certifications', tenantId] as const,
  certsByEmployee: (tenantId?: string, empId?: string) => ['employee-certs', tenantId, empId] as const,
  trainingByEmployee: (tenantId?: string, empId?: string) => ['employee-training', tenantId, empId] as const,
};

// ---------------------------------------------------------------------------
// Certification Type hooks
// ---------------------------------------------------------------------------

export function useCertificationTypes() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: keys.certTypes(tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_types')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as CertificationType[];
    },
    enabled: !!tenant?.id,
  });
}

export function useCreateCertType() {
  const { tenant, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; default_validity_months?: number | null; issuing_body?: string }) => {
      const { data, error } = await supabase
        .from('certification_types')
        .insert({ ...input, tenant_id: tenant!.id })
        .select()
        .single();
      if (error) throw error;
      return data as CertificationType;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.certTypes(tenant?.id) }),
  });
}

export function useUpdateCertType() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string | null; default_validity_months?: number | null; issuing_body?: string | null; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('certification_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CertificationType;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.certTypes(tenant?.id) }),
  });
}

export function useDeleteCertType() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('certification_types')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.certTypes(tenant?.id) }),
  });
}

// ---------------------------------------------------------------------------
// Training Class hooks
// ---------------------------------------------------------------------------

export function useTrainingClasses() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: keys.trainingClasses(tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_classes')
        .select('*, certification_type:certification_types(name)')
        .eq('tenant_id', tenant!.id)
        .order('class_date', { ascending: false });
      if (error) throw error;
      return data as TrainingClass[];
    },
    enabled: !!tenant?.id,
  });
}

export function useCreateTrainingClass() {
  const { tenant, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      provider?: string;
      location?: string;
      class_date: string;
      end_date?: string | null;
      duration_hours?: number | null;
      cost?: number | null;
      cost_per_person?: boolean;
      certification_type_id?: string | null;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('training_classes')
        .insert({ ...input, tenant_id: tenant!.id, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as TrainingClass;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.trainingClasses(tenant?.id) }),
  });
}

export function useUpdateTrainingClass() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      description?: string | null;
      provider?: string | null;
      location?: string | null;
      class_date?: string;
      end_date?: string | null;
      duration_hours?: number | null;
      cost?: number | null;
      cost_per_person?: boolean;
      certification_type_id?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('training_classes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TrainingClass;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.trainingClasses(tenant?.id) }),
  });
}

export function useDeleteTrainingClass() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_classes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.trainingClasses(tenant?.id) });
      qc.invalidateQueries({ queryKey: ['employee-certs'] });
      qc.invalidateQueries({ queryKey: ['employee-training'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Training Attendance hooks
// ---------------------------------------------------------------------------

export function useTrainingAttendance(classId?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: keys.attendance(classId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*')
        .eq('training_class_id', classId!)
        .order('created_at');
      if (error) throw error;
      return data as TrainingAttendance[];
    },
    enabled: !!classId && !!tenant?.id,
  });
}

export function useBulkAddAttendees() {
  const { tenant, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      training_class_id: string;
      attendees: Array<{ employee_id?: string | null; tip_employee_id?: string | null }>;
      grants_certification?: boolean;
      certification_type_id?: string | null;
      class_date?: string;
      default_validity_months?: number | null;
    }) => {
      // Insert attendance records
      const attendanceRows = input.attendees.map((a) => ({
        tenant_id: tenant!.id,
        training_class_id: input.training_class_id,
        employee_id: a.employee_id || null,
        tip_employee_id: a.tip_employee_id || null,
        status: 'attended' as const,
      }));
      const { error: attError } = await supabase
        .from('training_attendance')
        .insert(attendanceRows);
      if (attError) throw attError;

      // If class grants certification, auto-create cert records
      if (input.grants_certification && input.certification_type_id && input.class_date) {
        let expiryDate: string | null = null;
        if (input.default_validity_months) {
          const d = new Date(input.class_date + 'T00:00:00');
          d.setMonth(d.getMonth() + input.default_validity_months);
          expiryDate = d.toISOString().split('T')[0];
        }
        const certRows = input.attendees.map((a) => ({
          tenant_id: tenant!.id,
          certification_type_id: input.certification_type_id!,
          employee_id: a.employee_id || null,
          tip_employee_id: a.tip_employee_id || null,
          training_class_id: input.training_class_id,
          issue_date: input.class_date!,
          expiry_date: expiryDate,
          status: 'active' as const,
          created_by: user!.id,
        }));
        const { error: certError } = await supabase
          .from('employee_certifications')
          .insert(certRows);
        if (certError) throw certError;
      }
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: keys.attendance(input.training_class_id) });
      qc.invalidateQueries({ queryKey: ['employee-certs'] });
      qc.invalidateQueries({ queryKey: ['employee-training'] });
    },
  });
}

export function useRemoveAttendee() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, classId }: { id: string; classId: string }) => {
      const { error } = await supabase
        .from('training_attendance')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return classId;
    },
    onSuccess: (classId) => {
      qc.invalidateQueries({ queryKey: keys.attendance(classId) });
      qc.invalidateQueries({ queryKey: ['employee-training'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Employee Certification hooks
// ---------------------------------------------------------------------------

export function useEmployeeCertifications(employeeId?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: keys.certsByEmployee(tenant?.id, employeeId),
    queryFn: async () => {
      let query = supabase
        .from('employee_certifications')
        .select('*, certification_type:certification_types(name, issuing_body), training_class:training_classes(name, class_date)')
        .eq('tenant_id', tenant!.id)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmployeeCertification[];
    },
    enabled: !!tenant?.id && !!employeeId,
  });
}

export function useEmployeeTrainingHistory(employeeId?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: keys.trainingByEmployee(tenant?.id, employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*, training_class:training_classes(*, certification_type:certification_types(name))')
        .eq('tenant_id', tenant!.id)
        .eq('employee_id', employeeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (TrainingAttendance & { training_class: TrainingClass })[];
    },
    enabled: !!tenant?.id && !!employeeId,
  });
}

export function useCreateCertification() {
  const { tenant, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      certification_type_id: string;
      employee_id?: string | null;
      tip_employee_id?: string | null;
      issue_date: string;
      expiry_date?: string | null;
      certificate_number?: string | null;
      document_url?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('employee_certifications')
        .insert({
          ...input,
          tenant_id: tenant!.id,
          status: 'active',
          created_by: user!.id,
        })
        .select('*, certification_type:certification_types(name, issuing_body)')
        .single();
      if (error) throw error;
      return data as EmployeeCertification;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-certs'] });
    },
  });
}

export function useUpdateCertification() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      certification_type_id?: string;
      issue_date?: string;
      expiry_date?: string | null;
      certificate_number?: string | null;
      document_url?: string | null;
      status?: 'active' | 'expired' | 'revoked' | 'pending_renewal';
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('employee_certifications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as EmployeeCertification;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-certs'] });
    },
  });
}

export function useDeleteCertification() {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_certifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-certs'] });
    },
  });
}
