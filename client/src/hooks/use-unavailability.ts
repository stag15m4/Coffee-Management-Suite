import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface Unavailability {
  id: string;
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  created_at: string;
  updated_at: string;
  // joined
  employee_name?: string;
}

export type InsertUnavailability = {
  start_date: string;
  end_date: string;
  all_day?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
  is_recurring?: boolean;
  recurrence_day?: number | null;
};

const SELECT_WITH_EMP = '*, employee:user_profiles!employee_id(full_name)';

function mapRow(r: any): Unavailability {
  return {
    ...r,
    employee_name: r.employee?.full_name ?? null,
  };
}

/** Current user's own unavailability entries. */
export function useMyUnavailability() {
  const { tenant, user } = useAuth();
  return useQuery({
    queryKey: ['unavailability-mine', tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from('employee_unavailability')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('employee_id', user.id)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data || []) as Unavailability[];
    },
    enabled: !!tenant?.id && !!user?.id,
    staleTime: 60_000,
  });
}

/** All unavailability for the tenant (manager schedule view). */
export function useTeamUnavailability(startDate?: string, endDate?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['unavailability-team', tenant?.id, startDate, endDate],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from('employee_unavailability')
        .select(SELECT_WITH_EMP)
        .eq('tenant_id', tenant.id)
        .order('start_date', { ascending: true });
      // Filter to date range if provided (include recurring entries too)
      if (startDate && endDate) {
        query = query.or(`and(start_date.lte.${endDate},end_date.gte.${startDate}),is_recurring.eq.true`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

export function useCreateUnavailability() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: InsertUnavailability) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('employee_unavailability')
        .insert({
          ...entry,
          tenant_id: tenant.id,
          employee_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Unavailability;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability-mine'] });
      queryClient.invalidateQueries({ queryKey: ['unavailability-team'] });
    },
  });
}

export function useDeleteUnavailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employee_unavailability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability-mine'] });
      queryClient.invalidateQueries({ queryKey: ['unavailability-team'] });
    },
  });
}
