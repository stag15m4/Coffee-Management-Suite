import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';

export interface StoreTeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  email: string;
  start_date: string | null;
  last_login_at: string | null;
}

export interface OperatingHoursEntry {
  id: string;
  tenant_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || '';
}

export function formatTime(time: string | null): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const displayHour = hours % 12 || 12;
  return minutes > 0
    ? `${displayHour}:${minutes.toString().padStart(2, '0')}${suffix}`
    : `${displayHour}${suffix}`;
}

export function getTodayHours(hours: OperatingHoursEntry[] | undefined): string {
  if (!hours || hours.length === 0) return '';
  const today = new Date().getDay();
  const todayEntry = hours.find((h) => h.day_of_week === today);
  if (!todayEntry) return '';
  if (todayEntry.is_closed) return 'Closed today';
  if (!todayEntry.open_time || !todayEntry.close_time) return '';
  return `Open ${formatTime(todayEntry.open_time)} – ${formatTime(todayEntry.close_time)}`;
}

export function calculateTenure(startDate: string | null): string {
  if (!startDate) return 'N/A';
  const start = new Date(startDate);
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  const months = now.getMonth() - start.getMonth();
  let totalMonths = years * 12 + months;
  if (now.getDate() < start.getDate()) totalMonths--;
  if (totalMonths < 1) return 'Less than 1 month';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  const displayYears = Math.floor(totalMonths / 12);
  const displayMonths = totalMonths % 12;
  if (displayMonths === 0) return `${displayYears} year${displayYears !== 1 ? 's' : ''}`;
  return `${displayYears} year${displayYears !== 1 ? 's' : ''}, ${displayMonths} month${displayMonths !== 1 ? 's' : ''}`;
}

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export function getActivityColor(dateStr: string | null): string {
  if (!dateStr) return '#ef4444'; // red — never logged in
  const diffDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (diffDays < 3) return '#22c55e';   // green
  if (diffDays < 14) return '#f59e0b';  // yellow/amber
  return '#ef4444';                      // red
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner': return '#334155';
    case 'manager': return '#475569';
    case 'lead': return '#64748B';
    case 'employee': return '#94A3B8';
    default: return '#334155';
  }
}

// --- Query hooks ---

export function useStoreTeamMembers(tenantId?: string) {
  return useQuery({
    queryKey: ['store-team', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // 1. Users whose primary tenant is this location
      const { data: primaryMembers, error: primaryError } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url, role, email, start_date, last_login_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (primaryError) throw primaryError;

      // 2. Users assigned to this location via user_tenant_assignments
      // Dedup by email (same person may have multiple profiles/assignments)
      const memberByEmail = new Map<string, StoreTeamMember>();
      for (const m of primaryMembers || []) {
        const existing = memberByEmail.get(m.email);
        // Prefer the record that has an avatar
        if (!existing || (!existing.avatar_url && m.avatar_url)) {
          memberByEmail.set(m.email, m);
        }
      }

      try {
        const { data: assignments } = await supabase
          .from('user_tenant_assignments')
          .select('user_id, role')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          const knownUserIds = new Set(Array.from(memberByEmail.values()).map((m) => m.id));
          const extraIds = assignments
            .map((a) => a.user_id)
            .filter((uid) => !knownUserIds.has(uid));

          if (extraIds.length > 0) {
            const { data: extraProfiles } = await supabase
              .from('user_profiles')
              .select('id, full_name, avatar_url, role, email, start_date, last_login_at')
              .in('id', extraIds)
              .eq('is_active', true);

            const roleByUserId = new Map(assignments.map((a) => [a.user_id, a.role]));
            for (const p of extraProfiles || []) {
              const existing = memberByEmail.get(p.email);
              const entry = { ...p, role: roleByUserId.get(p.id) || p.role };
              // Prefer the record that has an avatar
              if (!existing || (!existing.avatar_url && entry.avatar_url)) {
                memberByEmail.set(p.email, entry);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load tenant assignments:', err);
      }

      const memberMap = memberByEmail;

      const members = Array.from(memberMap.values());
      // Sort: owner > manager > lead > employee, then by name
      const roleOrder: Record<string, number> = { owner: 0, manager: 1, lead: 2, employee: 3 };
      members.sort((a, b) => {
        const rd = (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4);
        if (rd !== 0) return rd;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      return members;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStoreOperatingHours(tenantId?: string) {
  return useQuery({
    queryKey: ['store-hours', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('store_operating_hours')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('day_of_week');
      if (error) throw error;
      return (data || []) as OperatingHoursEntry[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// --- Mutation hooks ---

export function useUpsertOperatingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: {
      tenant_id: string;
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean;
    }[]) => {
      const { data, error } = await supabase
        .from('store_operating_hours')
        .upsert(entries, { onConflict: 'tenant_id,day_of_week' })
        .select();
      if (error) throw error;
      return data as OperatingHoursEntry[];
    },
    onSuccess: (_data, variables) => {
      const tenantId = variables[0]?.tenant_id;
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: ['store-hours', tenantId] });
      }
    },
  });
}

export function useUpdateDrawerDefault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, amount }: { tenantId: string; amount: number }) => {
      const { data, error } = await supabase
        .from('tenants')
        .update({ starting_drawer_default: amount, updated_at: new Date().toISOString() })
        .eq('id', tenantId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-metrics'] });
    },
  });
}
