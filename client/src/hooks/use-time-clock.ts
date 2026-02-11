import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface TimeClockBreak {
  id: string;
  tenant_id: string;
  time_clock_entry_id: string;
  break_start: string;
  break_end: string | null;
  break_type: string;
  created_at: string;
}

export interface TimeClockEntry {
  id: string;
  tenant_id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  is_edited: boolean;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_avatar?: string | null;
  breaks?: TimeClockBreak[];
}

function mapEntry(e: any): TimeClockEntry {
  return {
    ...e,
    employee_name: e.employee?.full_name ?? null,
    employee_avatar: e.employee?.avatar_url ?? null,
    breaks: e.time_clock_breaks ?? [],
  };
}

const ENTRY_SELECT = '*, employee:user_profiles!employee_id(full_name, avatar_url), time_clock_breaks(*)';

export function useActiveClockEntry() {
  const { tenant, user } = useAuth();
  return useQuery({
    queryKey: ['time-clock-active', tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return null;
      const { data, error } = await supabase
        .from('time_clock_entries')
        .select(ENTRY_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('employee_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapEntry(data) : null;
    },
    enabled: !!tenant?.id && !!user?.id,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useClockIn() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notes?: string) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('time_clock_entries')
        .insert({
          tenant_id: tenant.id,
          employee_id: user.id,
          clock_in: new Date().toISOString(),
          notes: notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const updates: any = {
        clock_out: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (notes !== undefined) updates.notes = notes;
      const { data, error } = await supabase
        .from('time_clock_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
    },
  });
}

export function useStartBreak() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, breakType }: { entryId: string; breakType?: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('time_clock_breaks')
        .insert({
          tenant_id: tenant.id,
          time_clock_entry_id: entryId,
          break_start: new Date().toISOString(),
          break_type: breakType ?? 'break',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock'] });
    },
  });
}

export function useEndBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (breakId: string) => {
      const { data, error } = await supabase
        .from('time_clock_breaks')
        .update({ break_end: new Date().toISOString() })
        .eq('id', breakId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock'] });
    },
  });
}

export function useTimeClockEntries(startDate: string, endDate: string, employeeId?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['time-clock', tenant?.id, startDate, endDate, employeeId ?? 'all'],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from('time_clock_entries')
        .select(ENTRY_SELECT)
        .eq('tenant_id', tenant.id)
        .gte('clock_in', `${startDate}T00:00:00`)
        .lte('clock_in', `${endDate}T23:59:59`)
        .order('clock_in', { ascending: false });
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapEntry);
    },
    enabled: !!tenant?.id && !!startDate && !!endDate,
    staleTime: 30_000,
  });
}

export function useEditTimeClockEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clock_in, clock_out, notes }: { id: string; clock_in?: string; clock_out?: string; notes?: string }) => {
      if (!user?.id) throw new Error('No user');
      const updates: any = {
        is_edited: true,
        edited_by: user.id,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (clock_in !== undefined) updates.clock_in = clock_in;
      if (clock_out !== undefined) updates.clock_out = clock_out;
      if (notes !== undefined) updates.notes = notes;
      const { data, error } = await supabase
        .from('time_clock_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-clock'] });
      queryClient.invalidateQueries({ queryKey: ['time-clock-active'] });
    },
  });
}
