import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export interface CalendarEvent {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  location: string | null;
  color: string;
  source: 'manual' | 'ical';
  ical_uid: string | null;
  ical_subscription_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ICalSubscription {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  color: string;
  last_synced_at: string | null;
  sync_error: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export type InsertCalendarEvent = {
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  location?: string | null;
  color?: string;
};

// ── Calendar Events ──────────────────────────────────────────

export function useCalendarEvents(startDate: string, endDate: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['calendar-events', tenant?.id, startDate, endDate],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('tenant_id', tenant.id)
        .lte('start_date', endDate)
        .gte('end_date', startDate)
        .order('start_date');
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!tenant?.id && !!startDate && !!endDate,
    staleTime: 30_000,
  });
}

export function useCreateCalendarEvent() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: InsertCalendarEvent) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          ...event,
          tenant_id: tenant.id,
          source: 'manual',
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

// ── iCal Subscriptions ───────────────────────────────────────

export function useICalSubscriptions() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['ical-subscriptions', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('ical_subscriptions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('created_at');
      if (error) throw error;
      return (data || []) as ICalSubscription[];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });
}

export function useCreateICalSubscription() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sub: { name: string; url: string; color?: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('ical_subscriptions')
        .insert({
          ...sub,
          tenant_id: tenant.id,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ICalSubscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ical-subscriptions'] });
    },
  });
}

export function useDeleteICalSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ical_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ical-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

// ── iCal Sync (server-side) ─────────────────────────────────

export function useSyncICal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { getAuthHeaders } = await import('@/lib/api-helpers');
      const res = await fetch('/api/calendar/sync-ical', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ subscriptionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      return res.json() as Promise<{ success: boolean; count: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['ical-subscriptions'] });
    },
  });
}
