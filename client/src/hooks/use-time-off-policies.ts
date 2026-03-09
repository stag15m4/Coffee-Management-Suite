import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────

export type PolicyType = 'none' | 'accrual' | 'fixed_annual' | 'milestone';
export type GrantMethod = 'upfront' | 'per_pay_period';
export type CarryoverType = 'none' | 'unlimited' | 'capped';
export type TimeOffCategory = 'vacation' | 'sick' | 'personal' | 'bereavement' | 'other';

export interface MilestoneTier {
  after_months: number;
  accrual_hours: number;
  accrual_per_hours_worked: number;
}

export interface TimeOffPolicy {
  id: string;
  tenant_id: string;
  name: string;
  policy_type: PolicyType;
  categories: TimeOffCategory[];
  accrual_hours: number;
  accrual_per_hours_worked: number;
  annual_hours: number;
  grant_method: GrantMethod;
  milestone_tiers: MilestoneTier[];
  max_balance_hours: number | null;
  carryover_type: CarryoverType;
  carryover_max_hours: number;
  waiting_period_days: number;
  eligible_roles: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InsertTimeOffPolicy = {
  name: string;
  policy_type: PolicyType;
  categories?: TimeOffCategory[];
  accrual_hours?: number;
  accrual_per_hours_worked?: number;
  annual_hours?: number;
  grant_method?: GrantMethod;
  milestone_tiers?: MilestoneTier[];
  max_balance_hours?: number | null;
  carryover_type?: CarryoverType;
  carryover_max_hours?: number;
  waiting_period_days?: number;
  eligible_roles?: string[];
};

export type UpdateTimeOffPolicy = Partial<InsertTimeOffPolicy> & { is_active?: boolean };

export interface TimeOffBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  policy_id: string;
  balance_hours: number;
  used_hours: number;
  pending_hours: number;
  year: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  policy_name?: string;
  policy_type?: PolicyType;
  policy_categories?: TimeOffCategory[];
  employee_name?: string;
}

export type AccrualEntryType = 'accrual' | 'usage' | 'adjustment' | 'carryover' | 'grant' | 'pending' | 'pending_release';

export interface AccrualLogEntry {
  id: string;
  tenant_id: string;
  employee_id: string;
  policy_id: string;
  balance_id: string;
  entry_type: AccrualEntryType;
  hours: number;
  description: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Policy Hooks ─────────────────────────────────────────

export function useTimeOffPolicies() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['time-off-policies', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('time_off_policies')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as TimeOffPolicy[];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });
}

export function useCreateTimeOffPolicy() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policy: InsertTimeOffPolicy) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const { data, error } = await supabase
        .from('time_off_policies')
        .insert({
          ...policy,
          tenant_id: tenant.id,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TimeOffPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-policies'] });
    },
  });
}

export function useUpdateTimeOffPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateTimeOffPolicy }) => {
      const { data, error } = await supabase
        .from('time_off_policies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TimeOffPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-policies'] });
    },
  });
}

export function useDeleteTimeOffPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_off_policies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-policies'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
    },
  });
}

// ─── Balance Hooks ────────────────────────────────────────

const BALANCE_SELECT = `*, policy:time_off_policies!policy_id(name, policy_type, categories)`;

function mapBalance(b: any): TimeOffBalance {
  return {
    ...b,
    balance_hours: Number(b.balance_hours),
    used_hours: Number(b.used_hours),
    pending_hours: Number(b.pending_hours),
    policy_name: b.policy?.name ?? null,
    policy_type: b.policy?.policy_type ?? null,
    policy_categories: b.policy?.categories ?? [],
  };
}

/** All balances for the current year across all employees in the tenant. */
export function useTimeOffBalances(year?: number) {
  const { tenant } = useAuth();
  const currentYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ['time-off-balances', tenant?.id, currentYear],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('time_off_balances')
        .select(BALANCE_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('year', currentYear);
      if (error) throw error;
      return (data || []).map(mapBalance);
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

/** Current user's own balances for the current year. */
export function useMyTimeOffBalances(year?: number) {
  const { tenant, user } = useAuth();
  const currentYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ['time-off-balances-mine', tenant?.id, user?.id, currentYear],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from('time_off_balances')
        .select(BALANCE_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('employee_id', user.id)
        .eq('year', currentYear);
      if (error) throw error;
      return (data || []).map(mapBalance);
    },
    enabled: !!tenant?.id && !!user?.id,
    staleTime: 30_000,
  });
}

/** Balances for a specific employee. */
export function useEmployeeTimeOffBalances(employeeId: string, year?: number) {
  const { tenant } = useAuth();
  const currentYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ['time-off-balances', tenant?.id, employeeId, currentYear],
    queryFn: async () => {
      if (!tenant?.id || !employeeId) return [];
      const { data, error } = await supabase
        .from('time_off_balances')
        .select(BALANCE_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('employee_id', employeeId)
        .eq('year', currentYear);
      if (error) throw error;
      return (data || []).map(mapBalance);
    },
    enabled: !!tenant?.id && !!employeeId,
    staleTime: 30_000,
  });
}

/** Manual balance adjustment (manager adds/removes hours). */
export function useAdjustBalance() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      policyId,
      hours,
      description,
    }: {
      employeeId: string;
      policyId: string;
      hours: number;
      description: string;
    }) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const year = new Date().getFullYear();

      // Upsert balance record
      const { data: balance, error: balErr } = await supabase
        .from('time_off_balances')
        .upsert(
          {
            tenant_id: tenant.id,
            employee_id: employeeId,
            policy_id: policyId,
            year,
            balance_hours: hours,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,employee_id,policy_id,year' }
        )
        .select()
        .single();
      if (balErr) throw balErr;

      // If balance already existed, we need to add the hours (not set them)
      // So re-fetch and update with the delta
      const { data: existing } = await supabase
        .from('time_off_balances')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('employee_id', employeeId)
        .eq('policy_id', policyId)
        .eq('year', year)
        .single();

      if (existing && existing.id !== balance?.id) {
        // Already existed — update it by adding hours
        const { error: updErr } = await supabase
          .from('time_off_balances')
          .update({
            balance_hours: Number(existing.balance_hours) + hours,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      }

      // Log the adjustment
      const balanceId = existing?.id ?? balance?.id;
      const { error: logErr } = await supabase
        .from('time_off_accrual_log')
        .insert({
          tenant_id: tenant.id,
          employee_id: employeeId,
          policy_id: policyId,
          balance_id: balanceId,
          entry_type: 'adjustment',
          hours,
          description,
          created_by: user.id,
        });
      if (logErr) throw logErr;

      return balance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-balances-mine'] });
    },
  });
}

// ─── Accrual Log Hooks ────────────────────────────────────

export function useAccrualLog(employeeId?: string) {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['accrual-log', tenant?.id, employeeId ?? 'all'],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from('time_off_accrual_log')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AccrualLogEntry[];
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

// ─── Accrual Calculation ──────────────────────────────────

/**
 * Run accrual for an employee given their worked hours in a pay period.
 * Called by managers when approving timesheets.
 */
export function useRunAccrual() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      hoursWorked,
      periodDescription,
      referenceId,
      employeeStartDate,
    }: {
      employeeId: string;
      hoursWorked: number;
      periodDescription: string;
      referenceId?: string;
      employeeStartDate?: string;
    }) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const year = new Date().getFullYear();

      // Fetch active policies for this tenant
      const { data: policies, error: polErr } = await supabase
        .from('time_off_policies')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);
      if (polErr) throw polErr;
      if (!policies || policies.length === 0) return [];

      const results: { policyId: string; accrued: number }[] = [];

      for (const policy of policies as TimeOffPolicy[]) {
        if (policy.policy_type === 'none') continue;

        // Check waiting period
        if (policy.waiting_period_days > 0 && employeeStartDate) {
          const start = new Date(employeeStartDate);
          const now = new Date();
          const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceStart < policy.waiting_period_days) continue;
        }

        let accrualHours = 0;

        if (policy.policy_type === 'accrual') {
          if (policy.accrual_per_hours_worked > 0) {
            accrualHours = (hoursWorked / policy.accrual_per_hours_worked) * policy.accrual_hours;
          }
        } else if (policy.policy_type === 'milestone' && employeeStartDate) {
          const start = new Date(employeeStartDate);
          const now = new Date();
          const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
          // Find the highest applicable tier
          const tiers = (policy.milestone_tiers || []).sort((a: MilestoneTier, b: MilestoneTier) => b.after_months - a.after_months);
          const tier = tiers.find((t: MilestoneTier) => monthsSinceStart >= t.after_months);
          if (tier && tier.accrual_per_hours_worked > 0) {
            accrualHours = (hoursWorked / tier.accrual_per_hours_worked) * tier.accrual_hours;
          }
        }
        // fixed_annual is handled separately via grant, not per-timesheet accrual

        if (accrualHours <= 0) continue;

        // Round to 2 decimal places
        accrualHours = Math.round(accrualHours * 100) / 100;

        // Upsert balance
        const { data: existingBal } = await supabase
          .from('time_off_balances')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('employee_id', employeeId)
          .eq('policy_id', policy.id)
          .eq('year', year)
          .maybeSingle();

        let balanceId: string;
        let newBalance: number;

        if (existingBal) {
          newBalance = Number(existingBal.balance_hours) + accrualHours;
          // Apply cap
          if (policy.max_balance_hours !== null) {
            newBalance = Math.min(newBalance, policy.max_balance_hours);
          }
          const { error: updErr } = await supabase
            .from('time_off_balances')
            .update({ balance_hours: newBalance, updated_at: new Date().toISOString() })
            .eq('id', existingBal.id);
          if (updErr) throw updErr;
          balanceId = existingBal.id;
        } else {
          newBalance = policy.max_balance_hours !== null
            ? Math.min(accrualHours, policy.max_balance_hours)
            : accrualHours;
          const { data: newBal, error: insErr } = await supabase
            .from('time_off_balances')
            .insert({
              tenant_id: tenant.id,
              employee_id: employeeId,
              policy_id: policy.id,
              year,
              balance_hours: newBalance,
            })
            .select()
            .single();
          if (insErr) throw insErr;
          balanceId = newBal.id;
        }

        // Log the accrual
        const { error: logErr } = await supabase
          .from('time_off_accrual_log')
          .insert({
            tenant_id: tenant.id,
            employee_id: employeeId,
            policy_id: policy.id,
            balance_id: balanceId,
            entry_type: 'accrual',
            hours: accrualHours,
            description: `Accrual for ${periodDescription} (${hoursWorked}h worked)`,
            reference_id: referenceId ?? null,
            created_by: user.id,
          });
        if (logErr) throw logErr;

        results.push({ policyId: policy.id, accrued: accrualHours });
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-balances-mine'] });
      queryClient.invalidateQueries({ queryKey: ['accrual-log'] });
    },
  });
}

/**
 * Grant fixed annual hours (for fixed_annual policies).
 * Called once per year or per pay period depending on grant_method.
 */
export function useGrantAnnualHours() {
  const { tenant, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      policyId,
      hours,
      description,
    }: {
      employeeId: string;
      policyId: string;
      hours: number;
      description: string;
    }) => {
      if (!tenant?.id || !user?.id) throw new Error('No tenant or user');
      const year = new Date().getFullYear();

      // Upsert balance
      const { data: existing } = await supabase
        .from('time_off_balances')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('employee_id', employeeId)
        .eq('policy_id', policyId)
        .eq('year', year)
        .maybeSingle();

      let balanceId: string;

      if (existing) {
        const newBalance = Number(existing.balance_hours) + hours;
        const { error } = await supabase
          .from('time_off_balances')
          .update({ balance_hours: newBalance, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        balanceId = existing.id;
      } else {
        const { data: newBal, error } = await supabase
          .from('time_off_balances')
          .insert({
            tenant_id: tenant.id,
            employee_id: employeeId,
            policy_id: policyId,
            year,
            balance_hours: hours,
          })
          .select()
          .single();
        if (error) throw error;
        balanceId = newBal.id;
      }

      // Log the grant
      const { error: logErr } = await supabase
        .from('time_off_accrual_log')
        .insert({
          tenant_id: tenant.id,
          employee_id: employeeId,
          policy_id: policyId,
          balance_id: balanceId,
          entry_type: 'grant',
          hours,
          description,
          created_by: user.id,
        });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-balances'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-balances-mine'] });
      queryClient.invalidateQueries({ queryKey: ['accrual-log'] });
    },
  });
}
