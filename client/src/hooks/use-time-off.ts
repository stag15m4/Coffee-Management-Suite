import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface TimeOffRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  category: 'vacation' | 'sick' | 'personal' | 'bereavement' | 'other';
  reason: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_avatar?: string | null;
  reviewer_name?: string | null;
}

export type InsertTimeOffRequest = {
  start_date: string;
  end_date: string;
  category: TimeOffRequest['category'];
  reason?: string | null;
};

function mapRequest(r: any): TimeOffRequest {
  return {
    ...r,
    employee_name: r.employee?.full_name ?? null,
    employee_avatar: r.employee?.avatar_url ?? null,
    reviewer_name: r.reviewer?.full_name ?? null,
  };
}

const REQUEST_SELECT = '*, employee:user_profiles!employee_id(full_name, avatar_url), reviewer:user_profiles!reviewed_by(full_name)';

export function useTimeOffRequests(statusFilter?: TimeOffRequest['status']) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['time-off', tenant?.id, statusFilter ?? 'all'],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from('time_off_requests')
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

export function useMyTimeOffRequests() {
  const { tenant, user } = useAuth();
  return useQuery({
    queryKey: ['time-off-mine', tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from('time_off_requests')
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

export function useCreateTimeOffRequest() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: InsertTimeOffRequest) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('time_off_requests')
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
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-mine'] });
    },
  });
}

export function useReviewTimeOffRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, review_notes }: { id: string; status: 'approved' | 'denied'; review_notes?: string }) => {
      if (!user?.id) throw new Error('No user');
      const { data, error } = await supabase
        .from('time_off_requests')
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-mine'] });
    },
  });
}

export function useCancelTimeOffRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_off_requests')
        .update({ status: 'cancelled' as const, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-mine'] });
    },
  });
}
