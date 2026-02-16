import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';

/**
 * A unified employee record that can come from either user_profiles (logged-in
 * users) or tip_employees (tip-roster-only workers without accounts).
 */
export interface UnifiedEmployee {
  /** Display in dropdowns / calendar events */
  name: string;
  /** Set when the employee has a user_profiles login */
  user_profile_id: string | null;
  /** Set when the employee exists in the tip_employees roster */
  tip_employee_id: string | null;
  avatar_url: string | null;
  role: string | null;
  /** Manager-assigned calendar color (hex), or null for auto */
  schedule_color: string | null;
  /** Hourly rate for pay calculations (from user_profiles) */
  hourly_rate: number | null;
  /** 'profile' | 'tip' | 'both' */
  source: 'profile' | 'tip' | 'both';
}

/**
 * Fetches team members from user_profiles AND tip_employees for a given
 * tenant, deduplicates by name, and returns a unified list sorted by name.
 */
export function useAllEmployees(tenantId?: string) {
  return useQuery({
    queryKey: ['all-employees', tenantId],
    queryFn: async (): Promise<UnifiedEmployee[]> => {
      if (!tenantId) return [];

      // Fetch both sources in parallel
      const [profilesResult, tipResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url, role, email, schedule_color, hourly_rate')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        supabase
          .from('tip_employees')
          .select('id, name, is_active, schedule_color')
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
          const extraIds = assignments
            .map((a) => a.user_id)
            .filter((uid) => !knownIds.has(uid));

          if (extraIds.length > 0) {
            const { data: extra } = await supabase
              .from('user_profiles')
              .select('id, full_name, avatar_url, role, email, schedule_color, hourly_rate')
              .in('id', extraIds)
              .eq('is_active', true);
            if (extra) assignmentProfiles = extra;
          }
        }
      } catch {
        // Non-critical — continue without assignment data
      }

      const allProfiles = [...profiles, ...assignmentProfiles];

      // Build a map keyed by normalised name
      const byName = new Map<string, UnifiedEmployee>();

      for (const p of allProfiles) {
        const name = (p.full_name || p.email || p.id).trim();
        const key = name.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          // Merge: prefer profile data, keep tip_employee_id if already set
          existing.user_profile_id = existing.user_profile_id ?? p.id;
          existing.avatar_url = existing.avatar_url ?? p.avatar_url;
          existing.role = existing.role ?? p.role;
          existing.schedule_color = existing.schedule_color ?? p.schedule_color;
          existing.source = existing.source === 'tip' ? 'both' : existing.source;
        } else {
          byName.set(key, {
            name,
            user_profile_id: p.id,
            tip_employee_id: null,
            avatar_url: p.avatar_url,
            role: p.role,
            schedule_color: p.schedule_color ?? null,
            hourly_rate: (p as any).hourly_rate ?? null,
            source: 'profile',
          });
        }
      }

      for (const t of tipEmployees) {
        const name = t.name.trim();
        const key = name.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          existing.tip_employee_id = existing.tip_employee_id ?? t.id;
          existing.schedule_color = existing.schedule_color ?? t.schedule_color;
          existing.source = existing.source === 'profile' ? 'both' : existing.source;
        } else {
          byName.set(key, {
            name,
            user_profile_id: null,
            tip_employee_id: t.id,
            avatar_url: null,
            role: null,
            schedule_color: t.schedule_color ?? null,
            hourly_rate: null,
            source: 'tip',
          });
        }
      }

      return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
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
