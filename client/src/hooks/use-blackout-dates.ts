import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface BlackoutDate {
  id: string;
  tenant_id: string;
  label: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InsertBlackoutDate = {
  label: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
};

export function useBlackoutDates() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['blackout-dates', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('blackout_dates')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data || []) as BlackoutDate[];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });
}

export function useCreateBlackoutDate() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bd: InsertBlackoutDate) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('blackout_dates')
        .insert({ ...bd, tenant_id: tenant.id, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackout-dates'] });
    },
  });
}

export function useDeleteBlackoutDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blackout_dates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackout-dates'] });
    },
  });
}
