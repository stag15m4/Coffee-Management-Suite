import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface ManagerAssignment {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  manager_id: string | null;
  manager_name: string | null;
  is_exempt: boolean;
  hourly_rate: number | null;
  annual_salary: number | null;
  pay_frequency: string | null;
}

export function useManagerAssignments() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['manager-assignments', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, manager_id, is_exempt, hourly_rate, annual_salary, pay_frequency, manager:user_profiles!manager_id(full_name)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        manager_id: u.manager_id,
        manager_name: u.manager?.full_name ?? null,
        is_exempt: u.is_exempt ?? false,
        hourly_rate: u.hourly_rate,
        annual_salary: u.annual_salary,
        pay_frequency: u.pay_frequency,
      })) as ManagerAssignment[];
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

export function useSetManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, managerId }: { userId: string; managerId: string | null }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ manager_id: managerId, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-assignments'] });
    },
  });
}

export function useUpdateCompensation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, updates }: {
      userId: string;
      updates: {
        is_exempt?: boolean;
        hourly_rate?: number | null;
        annual_salary?: number | null;
        pay_frequency?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-assignments'] });
    },
  });
}
