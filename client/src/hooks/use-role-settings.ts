import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

export type PermissionKey =
  | 'approve_time_off'
  | 'approve_time_edits'
  | 'manage_shifts'
  | 'delete_shifts'
  | 'manage_recipes'
  | 'manage_users'
  | 'view_reports'
  | 'export_payroll'
  | 'manage_equipment'
  | 'manage_tasks'
  | 'manage_orders'
  | 'manage_branding'
  | 'manage_locations'
  | 'manage_cash_deposits'
  | 'approve_timesheets';

export interface TenantRoleSetting {
  id: string;
  tenant_id: string;
  role: 'owner' | 'manager' | 'lead' | 'employee';
  display_name: string;
  approve_time_off: boolean;
  approve_time_edits: boolean;
  manage_shifts: boolean;
  delete_shifts: boolean;
  manage_recipes: boolean;
  manage_users: boolean;
  view_reports: boolean;
  export_payroll: boolean;
  manage_equipment: boolean;
  manage_tasks: boolean;
  manage_orders: boolean;
  manage_branding: boolean;
  manage_locations: boolean;
  manage_cash_deposits: boolean;
  approve_timesheets: boolean;
  created_at: string;
  updated_at: string;
}

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; category: string }[] = [
  { key: 'approve_time_off', label: 'Approve Time Off', category: 'Approvals' },
  { key: 'approve_time_edits', label: 'Approve Time Edits', category: 'Approvals' },
  { key: 'manage_shifts', label: 'Manage Shifts', category: 'Scheduling' },
  { key: 'delete_shifts', label: 'Delete Shifts', category: 'Scheduling' },
  { key: 'manage_recipes', label: 'Manage Recipes', category: 'Content' },
  { key: 'manage_equipment', label: 'Manage Equipment', category: 'Content' },
  { key: 'manage_tasks', label: 'Manage Tasks', category: 'Content' },
  { key: 'manage_orders', label: 'Manage Orders', category: 'Content' },
  { key: 'manage_users', label: 'Manage Users', category: 'Admin' },
  { key: 'manage_branding', label: 'Manage Branding', category: 'Admin' },
  { key: 'manage_locations', label: 'Manage Locations', category: 'Admin' },
  { key: 'manage_cash_deposits', label: 'Manage Cash Deposits', category: 'Admin' },
  { key: 'view_reports', label: 'View Reports', category: 'Reporting' },
  { key: 'export_payroll', label: 'Export Payroll', category: 'Reporting' },
  { key: 'approve_timesheets', label: 'Approve Timesheets', category: 'Approvals' },
];

export function useRoleSettings() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['role-settings', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let { data, error } = await supabase
        .from('tenant_role_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('role');
      if (error) throw error;

      // Auto-seed if empty
      if (!data || data.length === 0) {
        await supabase.rpc('seed_tenant_role_settings', { p_tenant_id: tenant.id });
        const result = await supabase
          .from('tenant_role_settings')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('role');
        if (result.error) throw result.error;
        data = result.data;
      }

      return (data || []) as TenantRoleSetting[];
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateRoleSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<TenantRoleSetting, 'id' | 'tenant_id' | 'role' | 'created_at' | 'updated_at'>> }) => {
      const { data, error } = await supabase
        .from('tenant_role_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No rows updated — you may not have permission to edit role settings.');
      }
      return data[0] as TenantRoleSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-settings'] });
    },
  });
}
