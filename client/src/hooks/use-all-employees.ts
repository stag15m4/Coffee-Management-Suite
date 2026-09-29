import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';

import { mergeEmployeeIdentities, type UnifiedEmployee } from '@/lib/employee-identities';
export type { UnifiedEmployee } from '@/lib/employee-identities';

/** Combine employees using explicit profile links. Names never establish identity. */
export function useAllEmployees(tenantId?: string) {
  return useQuery({
    queryKey: ['all-employees', tenantId],
    queryFn: async (): Promise<UnifiedEmployee[]> => {
      if (!tenantId) return [];

      // Fetch both sources in parallel
      const [profilesResult, tipResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url, role, email, schedule_color, hourly_rate, start_date')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        supabase
          .from('tip_employees')
          .select('id, name, is_active, schedule_color, user_profile_id')
          .eq('tenant_id', tenantId)
          .or('is_active.eq.true,is_active.is.null')
          .order('name'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (tipResult.error) throw tipResult.error;

      const profiles = profilesResult.data || [];
      const tipEmployees = tipResult.data || [];

      // Also check user_tenant_assignments for cross-location users
      let assignmentProfiles: typeof profiles = [];
      try {
        const { data: assignments } = await supabase
          .from('user_tenant_assignments')
          .select('user_id, role')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          const knownIds = new Set(profiles.map((p) => p.id));
          const extraIds = assignments.map((a) => a.user_id).filter((uid) => !knownIds.has(uid));

          if (extraIds.length > 0) {
            const { data: extra } = await supabase
              .from('user_profiles')
              .select('id, full_name, avatar_url, role, email, schedule_color, hourly_rate, start_date')
              .in('id', extraIds)
              .eq('is_active', true);
            if (extra) assignmentProfiles = extra;
          }
        }
      } catch {
        // Non-critical — continue without assignment data
      }

      return mergeEmployeeIdentities([...profiles, ...assignmentProfiles], tipEmployees);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateEmployeeColor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (emp: { user_profile_id: string | null; tip_employee_id: string | null; color: string }) => {
      if (emp.user_profile_id) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ schedule_color: emp.color })
          .eq('id', emp.user_profile_id);
        if (error) throw error;
      } else if (emp.tip_employee_id) {
        const { error } = await supabase
          .from('tip_employees')
          .update({ schedule_color: emp.color })
          .eq('id', emp.tip_employee_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-employees'] });
    },
  });
}
