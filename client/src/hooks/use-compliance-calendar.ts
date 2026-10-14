import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

interface ComplianceTask {
  id: string;
  title: string;
  due_date: string;
  status: string;
}
export function useComplianceCalendar(start: string, end: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['compliance-calendar', tenant?.id, start, end],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_tasks')
        .select('id,title,due_date,status,admin_task_categories!inner(name)')
        .eq('tenant_id', tenant!.id)
        .ilike('admin_task_categories.name', 'compliance')
        .gte('due_date', start)
        .lte('due_date', end)
        .neq('status', 'cancelled');
      if (error) throw error;
      return (data || []) as unknown as ComplianceTask[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
export function useCreateComplianceDeadline() {
  const { tenant, user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (event: { title: string; due_date: string; description?: string | null }) => {
      if (!tenant?.id || !user?.id) throw new Error('No business selected');
      const { data: category, error: categoryError } = await supabase
        .from('admin_task_categories')
        .select('id')
        .eq('tenant_id', tenant.id)
        .ilike('name', 'compliance')
        .limit(1)
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) throw new Error('A manager must add a Compliance category in Administrative Tasks first.');
      const { error } = await supabase.from('admin_tasks').insert({
        ...event,
        tenant_id: tenant.id,
        category_id: category.id,
        created_by: user.id,
        status: 'pending',
        priority: 'medium',
        recurrence: 'none',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['compliance-calendar'] });
      client.invalidateQueries({ queryKey: ['admin-tasks'] });
    },
  });
}
