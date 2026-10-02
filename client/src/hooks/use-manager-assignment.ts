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
      // hourly_rate/annual_salary/pay_frequency are column-revoked for
      // everyone but the employee themself and managers+ (migration 157),
      // so they're not on this select — fetched separately from the scoped
      // `user_pay_rates` view and merged in below.
      const [{ data, error }, { data: payRates }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, email, role, manager_id, is_exempt, manager:user_profiles!manager_id(full_name)')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('user_pay_rates')
          .select('id, hourly_rate, annual_salary, pay_frequency')
          .eq('tenant_id', tenant.id),
      ]);
      if (error) throw error;
      interface UserProfileRow {
        id: string;
        full_name: string | null;
        email: string;
        role: string;
        manager_id: string | null;
        is_exempt: boolean;
        manager: { full_name: string | null } | null;
      }

      const payById = new Map((payRates || []).map((r) => [r.id, r]));

      return ((data || []) as unknown as UserProfileRow[]).map((u) => {
        const pay = payById.get(u.id);
        return {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          manager_id: u.manager_id,
          manager_name: u.manager?.full_name ?? null,
          is_exempt: u.is_exempt ?? false,
          hourly_rate: pay?.hourly_rate ?? null,
          annual_salary: pay?.annual_salary ?? null,
          pay_frequency: pay?.pay_frequency ?? null,
        };
      }) as ManagerAssignment[];
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
    mutationFn: async ({
      userId,
      updates,
    }: {
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
