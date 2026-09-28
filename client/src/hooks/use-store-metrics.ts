import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import { getAllModuleIds } from '@/lib/module-registry';

export interface ActionItem {
  id: string;
  title: string;
  type: 'admin-task' | 'maintenance';
  assigneeName: string | null;
  dueDate: string;
  urgency: 'overdue' | 'today' | 'this-week';
  moduleHref: string;
  priority?: string;
}

export interface StoreMetrics {
  enabledModules: ModuleId[];
  employeeCount: number;
  revenue: {
    currentMonth: number;
    lastMonth: number;
    percentChange: number;
    trend: 'up' | 'down';
  } | null;
  actionItems: ActionItem[];
  redFlags: {
    overdueMaintenanceCount: number;
    overdueTaskCount: number;
    unassignedTaskCount: number;
  };
}

const ALL_MODULES: ModuleId[] = getAllModuleIds();

/**
 * Fetches metrics for all accessible locations in parallel using useQueries.
 * Each location gets its own query key for independent caching and loading.
 */
export function useAllStoreMetrics() {
  const { accessibleLocations, profile, session } = useAuth();

  // One CMS request replaces the previous per-location Supabase fan-out.
  // The server returns the exact dashboard projection for every accessible
  // location, preserving the same StoreMetrics contract used by StoreCard.
  const queries = useQueries({
    queries: accessibleLocations.map((location) => ({
      queryKey: ['store-metrics', location.id, 'read-model'],
      queryFn: async (): Promise<StoreMetrics> => {
        const token = session?.access_token;
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`/api/dashboard/metrics/${location.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Dashboard metrics failed (${response.status})`);
        return response.json();
      },
      staleTime: 60_000,
      enabled: !!location.id && !!profile && !!session?.access_token,
    })),
  });

  return { locations: accessibleLocations, queries };
}

/** Returns the list of all module IDs for computing teasers */
export { ALL_MODULES };
