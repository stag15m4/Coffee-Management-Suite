import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface TimesheetApproval {
  id: string;
  tenant_id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  manager_notes: string | null;
  employee_notes: string | null;
  total_regular_hours: number | null;
  total_break_hours: number | null;
  total_pto_hours: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employee_name?: string;
  approver_name?: string;
}

const APPROVAL_SELECT = `*, employee:user_profiles!employee_id(full_name), approver:user_profiles!approved_by(full_name)`;

function mapApproval(row: any): TimesheetApproval {
  return {
    ...row,
    employee_name: row.employee?.full_name ?? null,
    approver_name: row.approver?.full_name ?? null,
  };
}

/** All approvals for a given pay period. */
export function useTimesheetApprovals(periodStart: string, periodEnd: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['timesheet-approvals', tenant?.id, periodStart, periodEnd],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('timesheet_approvals')
        .select(APPROVAL_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd);
      if (error) throw error;
      return (data || []).map(mapApproval);
    },
    enabled: !!tenant?.id && !!periodStart && !!periodEnd,
    staleTime: 30_000,
  });
}

/** Single employee's approval for a given period. */
export function useEmployeeTimesheetApproval(employeeId: string, periodStart: string, periodEnd: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['timesheet-approval', tenant?.id, employeeId, periodStart, periodEnd],
    queryFn: async () => {
      if (!tenant?.id || !employeeId) return null;
      const { data, error } = await supabase
        .from('timesheet_approvals')
        .select(APPROVAL_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('employee_id', employeeId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle();
      if (error) throw error;
      return data ? mapApproval(data) : null;
    },
    enabled: !!tenant?.id && !!employeeId && !!periodStart && !!periodEnd,
    staleTime: 30_000,
  });
}

/** Approve a timesheet — upserts the record with status='approved'. */
export function useApproveTimesheet() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      periodStart,
      periodEnd,
      managerNotes,
      totalRegularHours,
      totalBreakHours,
      totalPtoHours,
    }: {
      employeeId: string;
      periodStart: string;
      periodEnd: string;
      managerNotes?: string;
      totalRegularHours?: number;
      totalBreakHours?: number;
      totalPtoHours?: number;
    }) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('timesheet_approvals')
        .upsert(
          {
            tenant_id: tenant.id,
            employee_id: employeeId,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            manager_notes: managerNotes ?? null,
            total_regular_hours: totalRegularHours ?? null,
            total_break_hours: totalBreakHours ?? null,
            total_pto_hours: totalPtoHours ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,employee_id,period_start,period_end' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-approval'] });
    },
  });
}

/** Reject a timesheet — upserts with status='rejected'. */
export function useRejectTimesheet() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      periodStart,
      periodEnd,
      managerNotes,
    }: {
      employeeId: string;
      periodStart: string;
      periodEnd: string;
      managerNotes?: string;
    }) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('timesheet_approvals')
        .upsert(
          {
            tenant_id: tenant.id,
            employee_id: employeeId,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'rejected',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            manager_notes: managerNotes ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,employee_id,period_start,period_end' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-approval'] });
    },
  });
}
