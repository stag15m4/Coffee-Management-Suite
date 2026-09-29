import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

export interface SessionBreakInput {
  id?: string;
  break_start: string;
  break_end: string;
  break_type: string;
}
export interface SessionInput {
  employeeId: string;
  entryId?: string;
  expectedUpdatedAt?: string;
  clockIn: string;
  clockOut: string;
  breaks: SessionBreakInput[];
  reason: string;
}
export interface MissingSessionRequest {
  id: string;
  employee_id: string;
  employee?: { full_name: string } | null;
  clock_in: string;
  clock_out: string;
  breaks: SessionBreakInput[];
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}
export interface SessionAuditEvent {
  id: string;
  entry_id: string;
  actor_name: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  reason: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export function useWorkSessionActions() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of [
      'time-clock',
      'time-clock-active',
      'time-clock-active-all',
      'time-clock-edits',
      'missing-time-sessions',
      'time-clock-audit',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const save = useMutation({
    mutationFn: async ({ input, requestOnly }: { input: SessionInput; requestOnly: boolean }) => {
      if (!tenant?.id || !user?.id) throw new Error('Please sign in again');
      if (requestOnly && input.employeeId !== user.id) throw new Error('You can request only your own session');
      const common = {
        p_tenant: tenant.id,
        p_clock_in: input.clockIn,
        p_clock_out: input.clockOut,
        p_breaks: input.breaks,
        p_reason: input.reason,
      };
      const { data, error } = requestOnly
        ? await supabase.rpc('request_missing_time_session', common)
        : await supabase.rpc('save_time_clock_session', {
            ...common,
            p_employee: input.employeeId,
            p_entry: input.entryId ?? null,
            p_expected_updated_at: input.expectedUpdatedAt ?? null,
          });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
    onError: refresh,
  });
  const remove = useMutation({
    mutationFn: async ({
      entryId,
      expectedUpdatedAt,
      reason,
    }: {
      entryId: string;
      expectedUpdatedAt: string;
      reason: string;
    }) => {
      const { error } = await supabase.rpc('delete_time_clock_session', {
        p_entry: entryId,
        p_expected_updated_at: expectedUpdatedAt,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: refresh,
  });
  const review = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: 'approved' | 'denied' | 'cancelled';
      notes?: string;
    }) => {
      const { error } = await supabase.rpc('review_missing_time_session', {
        p_id: id,
        p_status: status,
        p_notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: refresh,
  });
  return { save, remove, review };
}

export function useMissingSessions(employeeId?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['missing-time-sessions', tenant?.id, employeeId],
    enabled: !!tenant?.id,
    queryFn: async () => {
      let query = supabase
        .from('time_clock_missing_requests')
        .select('*, employee:user_profiles!employee_id(full_name)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (employeeId) query = query.eq('employee_id', employeeId);
      const { data, error } = await query;
      if (error) throw error;
      return data as MissingSessionRequest[];
    },
  });
}

export function useSessionAudit(employeeId: string, enabled: boolean) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['time-clock-audit', tenant?.id, employeeId],
    enabled: enabled && !!tenant?.id && !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_clock_audit_events')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as SessionAuditEvent[];
    },
  });
}
