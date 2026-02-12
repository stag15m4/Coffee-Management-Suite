import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface TimeClockEditRequest {
  id: string;
  tenant_id: string;
  time_clock_entry_id: string;
  employee_id: string;
  original_clock_in: string;
  original_clock_out: string | null;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_avatar?: string | null;
  employee_manager_id?: string | null;
  reviewer_name?: string | null;
}

export type InsertTimeClockEdit = {
  time_clock_entry_id: string;
  original_clock_in: string;
  original_clock_out: string | null;
  requested_clock_in?: string | null;
  requested_clock_out?: string | null;
  reason: string;
};

function mapRequest(r: any): TimeClockEditRequest {
  return {
    ...r,
    employee_name: r.employee?.full_name ?? null,
    employee_avatar: r.employee?.avatar_url ?? null,
    employee_manager_id: r.employee?.manager_id ?? null,
    reviewer_name: r.reviewer?.full_name ?? null,
  };
}

const REQUEST_SELECT = '*, employee:user_profiles!employee_id(full_name, avatar_url, manager_id), reviewer:user_profiles!reviewed_by(full_name)';

export function useTimeClockEdits(statusFilter?: TimeClockEditRequest['status']) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['time-clock-edits', tenant?.id, statusFilter ?? 'all'],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from('time_clock_edit_requests')
        .select(REQUEST_SELECT)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapRequest);
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

export function useMyTimeClockEdits() {
  const { tenant, user } = useAuth();
  return useQuery({
    queryKey: ['time-clock-edits-mine', tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from('time_clock_edit_requests')
        .select(REQUEST_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRequest);
    },
    enabled: !!tenant?.id && !!user?.id,
    staleTime: 30_000,
  });
}

export function useCreateTimeClockEdit() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: InsertTimeClockEdit) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('time_clock_edit_requests')
        .insert({
          ...req,
          tenant_id: tenant.id,
          employee_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock-edits'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-edits-mine'] });
    },
  });
}

export function useReviewTimeClockEdit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, review_notes }: { id: string; status: 'approved' | 'denied'; review_notes?: string }) => {
      if (!user?.id) throw new Error('No user');

      // First fetch the edit request to get the proposed changes
      const { data: editReq, error: fetchErr } = await supabase
        .from('time_clock_edit_requests')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      // Update the edit request status
      const { data, error } = await supabase
        .from('time_clock_edit_requests')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // If approved, apply the changes to the actual time clock entry
      if (status === 'approved') {
        const updates: Record<string, any> = {
          is_edited: true,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (editReq.requested_clock_in) updates.clock_in = editReq.requested_clock_in;
        if (editReq.requested_clock_out) updates.clock_out = editReq.requested_clock_out;

        const { error: updateErr } = await supabase
          .from('time_clock_entries')
          .update(updates)
          .eq('id', editReq.time_clock_entry_id);
        if (updateErr) throw updateErr;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock-edits'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-edits-mine'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
    },
  });
}

export function useCancelTimeClockEdit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_clock_edit_requests')
        .update({ status: 'cancelled' as const, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock-edits'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-edits-mine'] });
    },
  });
}
