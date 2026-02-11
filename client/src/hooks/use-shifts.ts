import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface Shift {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  tip_employee_id: string | null;
  employee_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  position: string | null;
  notes: string | null;
  status: 'draft' | 'published' | 'cancelled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  employee_avatar?: string | null;
}

export interface ShiftTemplate {
  id: string;
  tenant_id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  position: string | null;
  employee_id: string | null;
  tip_employee_id: string | null;
  employee_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InsertShift = {
  employee_id?: string | null;
  tip_employee_id?: string | null;
  employee_name: string;
  date: string;
  start_time: string;
  end_time: string;
  position?: string | null;
  notes?: string | null;
  status?: 'draft' | 'published' | 'cancelled';
};

// The employee_name column on the row is the source of truth for display.
// The left-joined profile provides avatar only.
function mapShift(s: any): Shift {
  return {
    ...s,
    employee_name: s.employee_name ?? s.employee?.full_name ?? null,
    employee_avatar: s.employee?.avatar_url ?? null,
  };
}

// Use a left join (employee_id is nullable). PostgREST syntax: !left on the FK.
const SHIFT_SELECT = '*, employee:user_profiles!employee_id(full_name, avatar_url)';

export function useShifts(startDate: string, endDate: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['shifts', tenant?.id, startDate, endDate],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('shifts')
        .select(SHIFT_SELECT)
        .eq('tenant_id', tenant.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .neq('status', 'cancelled')
        .order('date')
        .order('start_time');
      if (error) throw error;
      return (data || []).map(mapShift);
    },
    enabled: !!tenant?.id && !!startDate && !!endDate,
    staleTime: 30_000,
  });
}

export function useTodayShifts(tenantId?: string) {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['shifts-today', tenantId, today],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('shifts')
        .select(SHIFT_SELECT)
        .eq('tenant_id', tenantId)
        .eq('date', today)
        .in('status', ['draft', 'published'])
        .order('start_time');
      if (error) throw error;
      return (data || []).map(mapShift);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60_000,
  });
}

export function useCreateShift() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shift: InsertShift) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          ...shift,
          tenant_id: tenant.id,
          created_by: user?.id ?? null,
        })
        .select(SHIFT_SELECT)
        .single();
      if (error) throw error;
      return mapShift(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Shift> & { id: string }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(SHIFT_SELECT)
        .single();
      if (error) throw error;
      return mapShift(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    },
  });
}

export function useBulkCreateShifts() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shifts: InsertShift[]) => {
      if (!tenant?.id) throw new Error('No tenant');
      const rows = shifts.map((s) => ({
        ...s,
        tenant_id: tenant.id,
        created_by: user?.id ?? null,
      }));
      const { data, error } = await supabase.from('shifts').insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    },
  });
}

export function useShiftTemplates() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['shift-templates', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('shift_templates')
        .select('*, employee:user_profiles!employee_id(full_name)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        employee_name: t.employee_name ?? t.employee?.full_name ?? null,
      })) as ShiftTemplate[];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60_000,
  });
}

export type InsertShiftTemplate = {
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  employee_id?: string | null;
  tip_employee_id?: string | null;
  employee_name?: string | null;
  position?: string | null;
};

export function useCreateShiftTemplate() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: InsertShiftTemplate) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('shift_templates')
        .insert({ ...template, tenant_id: tenant.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates'] });
    },
  });
}

export function useDeleteShiftTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates'] });
    },
  });
}
