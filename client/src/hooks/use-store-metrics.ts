import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth, type ModuleId } from '@/contexts/AuthContext';

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

const ALL_MODULES: ModuleId[] = [
  'recipe-costing',
  'tip-payout',
  'cash-deposit',
  'bulk-ordering',
  'equipment-maintenance',
  'admin-tasks',
];

async function fetchEnabledModules(tenantId: string): Promise<ModuleId[]> {
  const { data, error } = await supabase.rpc('get_tenant_enabled_modules', {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return (data || []) as ModuleId[];
}

async function fetchEmployeeCount(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (error) throw error;
  return count || 0;
}

async function fetchRevenue(tenantId: string) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const { data: currentMonth, error: currentError } = await supabase
    .from('cash_activity')
    .select('gross_revenue')
    .eq('tenant_id', tenantId)
    .gte('drawer_date', firstDayOfMonth)
    .lte('drawer_date', lastDayOfMonth)
    .or('archived.is.null,archived.eq.false');

  if (currentError) throw currentError;

  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .split('T')[0];
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .split('T')[0];

  const { data: lastMonth, error: lastError } = await supabase
    .from('cash_activity')
    .select('gross_revenue')
    .eq('tenant_id', tenantId)
    .gte('drawer_date', firstDayLastMonth)
    .lte('drawer_date', lastDayLastMonth)
    .or('archived.is.null,archived.eq.false');

  if (lastError) throw lastError;

  const currentTotal =
    currentMonth?.reduce(
      (sum, entry) => sum + (Number(entry.gross_revenue) || 0),
      0
    ) || 0;
  const lastTotal =
    lastMonth?.reduce(
      (sum, entry) => sum + (Number(entry.gross_revenue) || 0),
      0
    ) || 0;

  // Don't return revenue data if there's nothing to show
  if (currentTotal === 0 && lastTotal === 0) {
    return null;
  }

  const percentChange =
    lastTotal > 0 ? ((currentTotal - lastTotal) / lastTotal) * 100 : 0;

  return {
    currentMonth: currentTotal,
    lastMonth: lastTotal,
    percentChange,
    trend: (currentTotal >= lastTotal ? 'up' : 'down') as 'up' | 'down',
  };
}

async function fetchAdminTasks(tenantId: string): Promise<ActionItem[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data: tasks, error } = await supabase
    .from('admin_tasks')
    .select(
      `
      id,
      title,
      priority,
      due_date,
      assigned_to,
      assignee:user_profiles!admin_tasks_assigned_to_fkey(full_name)
    `
    )
    .eq('tenant_id', tenantId)
    .neq('status', 'completed')
    .lte('due_date', sevenDaysFromNow)
    .order('due_date', { ascending: true })
    .limit(15);

  if (error) throw error;

  return (tasks || []).map((task: any) => {
    const dueDate = task.due_date || '';
    let urgency: ActionItem['urgency'] = 'this-week';
    if (dueDate < today) urgency = 'overdue';
    else if (dueDate === today) urgency = 'today';

    return {
      id: task.id,
      title: task.title,
      type: 'admin-task' as const,
      assigneeName: task.assignee?.full_name || null,
      dueDate,
      urgency,
      moduleHref: '/admin-tasks',
      priority: task.priority,
    };
  });
}

async function fetchMaintenanceTasks(tenantId: string): Promise<ActionItem[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data: tasks, error } = await supabase
    .from('maintenance_tasks')
    .select(
      `
      id,
      name,
      next_due_at,
      equipment:equipment!inner(id, name, tenant_id)
    `
    )
    .eq('equipment.tenant_id', tenantId)
    .eq('is_active', true)
    .lte('next_due_at', sevenDaysFromNow)
    .order('next_due_at', { ascending: true })
    .limit(15);

  if (error) throw error;

  return (tasks || []).map((task: any) => {
    const dueDate = task.next_due_at ? task.next_due_at.split('T')[0] : '';
    let urgency: ActionItem['urgency'] = 'this-week';
    if (dueDate < today) urgency = 'overdue';
    else if (dueDate === today) urgency = 'today';

    return {
      id: task.id,
      title: `${task.equipment?.name || 'Equipment'} — ${task.name}`,
      type: 'maintenance' as const,
      assigneeName: null,
      dueDate,
      urgency,
      moduleHref: '/equipment-maintenance',
    };
  });
}

/** Helper to check section visibility by role (will be swapped to DB-backed permissions later) */
export function canViewSection(
  section: 'health' | 'tasks' | 'maintenance' | 'teasers',
  role: string | undefined
): boolean {
  const roleLevel: Record<string, number> = {
    owner: 4,
    manager: 3,
    lead: 2,
    employee: 1,
  };
  const level = roleLevel[role || ''] || 0;

  switch (section) {
    case 'health':
      return level >= 3; // manager+
    case 'tasks':
      return level >= 1; // all roles
    case 'maintenance':
      return level >= 1; // all roles
    case 'teasers':
      return level >= 1; // all roles
    default:
      return false;
  }
}

async function fetchStoreMetrics(
  tenantId: string,
  userRole: string | undefined
): Promise<StoreMetrics> {
  // First fetch enabled modules for this location
  const enabledModules = await fetchEnabledModules(tenantId);

  const isManager = canViewSection('health', userRole);

  // Build the parallel fetch list based on enabled modules and role
  const fetches: Record<string, Promise<any>> = {
    employees: fetchEmployeeCount(tenantId),
  };

  if (isManager && enabledModules.includes('cash-deposit')) {
    fetches.revenue = fetchRevenue(tenantId);
  }
  if (enabledModules.includes('admin-tasks')) {
    fetches.adminTasks = fetchAdminTasks(tenantId);
  }
  if (enabledModules.includes('equipment-maintenance')) {
    fetches.maintenanceTasks = fetchMaintenanceTasks(tenantId);
  }

  const keys = Object.keys(fetches);
  const results = await Promise.allSettled(Object.values(fetches));

  const resolved: Record<string, any> = {};
  keys.forEach((key, i) => {
    const result = results[i];
    resolved[key] = result.status === 'fulfilled' ? result.value : null;
  });

  // Merge admin tasks + maintenance into unified action items, sorted by date
  const adminItems: ActionItem[] = resolved.adminTasks || [];
  const maintenanceItems: ActionItem[] = resolved.maintenanceTasks || [];
  const actionItems = [...adminItems, ...maintenanceItems].sort((a, b) => {
    // Overdue first, then today, then this-week
    const urgencyOrder = { overdue: 0, today: 1, 'this-week': 2 };
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return a.dueDate.localeCompare(b.dueDate);
  });

  // Compute red flags
  const overdueMaintenanceCount = maintenanceItems.filter(
    (i) => i.urgency === 'overdue'
  ).length;
  const overdueTaskCount = adminItems.filter(
    (i) => i.urgency === 'overdue'
  ).length;
  const unassignedTaskCount = adminItems.filter(
    (i) => !i.assigneeName
  ).length;

  return {
    enabledModules,
    employeeCount: resolved.employees || 0,
    revenue: resolved.revenue || null,
    actionItems,
    redFlags: {
      overdueMaintenanceCount,
      overdueTaskCount,
      unassignedTaskCount,
    },
  };
}

/**
 * Fetches metrics for all accessible locations in parallel using useQueries.
 * Each location gets its own query key for independent caching and loading.
 */
export function useAllStoreMetrics() {
  const { accessibleLocations, profile } = useAuth();

  const queries = useQueries({
    queries: accessibleLocations.map((location) => ({
      queryKey: ['store-metrics', location.id],
      queryFn: () => fetchStoreMetrics(location.id, profile?.role),
      staleTime: 60_000,
      enabled: !!location.id && !!profile,
    })),
  });

  return {
    locations: accessibleLocations,
    queries,
  };
}

/** Returns the list of all module IDs for computing teasers */
export { ALL_MODULES };
