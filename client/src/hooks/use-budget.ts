import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import type { ChartOfAccount, FiscalYear, BudgetLineItem, ImportLog } from '@/pages/financial-budget/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const keys = {
  coa: (tenantId?: string) => ['budget-coa', tenantId] as const,
  fiscalYears: (tenantId?: string) => ['budget-fiscal-years', tenantId] as const,
  lineItems: (fiscalYearId?: string, tenantId?: string) => ['budget-line-items', fiscalYearId, tenantId] as const,
  importLogs: (tenantId?: string) => ['budget-import-logs', tenantId] as const,
};

// ---------------------------------------------------------------------------
// Chart of Accounts hooks
// ---------------------------------------------------------------------------

export function useChartOfAccounts(tenantId?: string) {
  return useQuery({
    queryKey: keys.coa(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('budget_chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('account_type')
        .order('display_order')
        .order('name');
      if (error) throw error;
      return (data || []) as ChartOfAccount[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (account: {
      tenant_id: string;
      account_number?: string | null;
      name: string;
      account_type: string;
      detail_type?: string | null;
      parent_id?: string | null;
      depth?: number;
      display_order?: number;
    }) => {
      const { data, error } = await supabase
        .from('budget_chart_of_accounts')
        .insert(account)
        .select()
        .single();
      if (error) throw error;
      return data as ChartOfAccount;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.coa(vars.tenant_id) });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenant_id, ...updates }: Partial<ChartOfAccount> & { id: string; tenant_id: string }) => {
      const { data, error } = await supabase
        .from('budget_chart_of_accounts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ChartOfAccount;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.coa(vars.tenant_id) });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenant_id }: { id: string; tenant_id: string }) => {
      const { error } = await supabase
        .from('budget_chart_of_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.coa(vars.tenant_id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Fiscal Year hooks
// ---------------------------------------------------------------------------

export function useFiscalYears(tenantId?: string) {
  return useQuery({
    queryKey: keys.fiscalYears(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('budget_fiscal_years')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('year', { ascending: false });
      if (error) throw error;
      return (data || []) as FiscalYear[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fy: { tenant_id: string; year: number; start_month?: number }) => {
      const { data, error } = await supabase
        .from('budget_fiscal_years')
        .insert({ ...fy, start_month: fy.start_month || 1 })
        .select()
        .single();
      if (error) throw error;
      return data as FiscalYear;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.fiscalYears(vars.tenant_id) });
    },
  });
}

export function useUpdateFiscalYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenant_id, ...updates }: Partial<FiscalYear> & { id: string; tenant_id: string }) => {
      const { data, error } = await supabase
        .from('budget_fiscal_years')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as FiscalYear;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.fiscalYears(vars.tenant_id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Budget Line Items hooks
// ---------------------------------------------------------------------------

export function useBudgetLineItems(fiscalYearId?: string, tenantId?: string) {
  return useQuery({
    queryKey: keys.lineItems(fiscalYearId, tenantId),
    queryFn: async () => {
      if (!fiscalYearId || !tenantId) return [];
      const { data, error } = await supabase
        .from('budget_line_items')
        .select('*')
        .eq('fiscal_year_id', fiscalYearId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data || []) as BudgetLineItem[];
    },
    enabled: !!fiscalYearId && !!tenantId,
  });
}

export function useUpsertBudgetLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      tenant_id: string;
      fiscal_year_id: string;
      account_id: string;
      month: number;
      budget_amount: number;
    }) => {
      const { data, error } = await supabase
        .from('budget_line_items')
        .upsert(
          {
            ...item,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,fiscal_year_id,account_id,month' }
        )
        .select()
        .single();
      if (error) throw error;
      return data as BudgetLineItem;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.lineItems(vars.fiscal_year_id, vars.tenant_id) });
    },
  });
}

export function useBulkUpsertBudgetLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{
      tenant_id: string;
      fiscal_year_id: string;
      account_id: string;
      month: number;
      budget_amount: number;
    }>) => {
      if (items.length === 0) return [];
      const withTimestamp = items.map(i => ({ ...i, updated_at: new Date().toISOString() }));
      const { data, error } = await supabase
        .from('budget_line_items')
        .upsert(withTimestamp, { onConflict: 'tenant_id,fiscal_year_id,account_id,month' })
        .select();
      if (error) throw error;
      return (data || []) as BudgetLineItem[];
    },
    onSuccess: (_data, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: keys.lineItems(vars[0].fiscal_year_id, vars[0].tenant_id) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Import hooks
// ---------------------------------------------------------------------------

export function useImportLogs(tenantId?: string) {
  return useQuery({
    queryKey: keys.importLogs(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('budget_import_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as ImportLog[];
    },
    enabled: !!tenantId,
  });
}

export function useImportChartOfAccounts() {
  const qc = useQueryClient();
  const { tenant } = useAuth();
  return useMutation({
    mutationFn: async ({ csv, tenantId, fileName, columnMapping }: {
      csv: string;
      tenantId: string;
      fileName: string;
      columnMapping?: { name: number; type?: number; detailType?: number; number?: number };
    }) => {
      const response = await fetch('/api/budget/import-coa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ csv, tenantId, fileName, columnMapping }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Import failed');
      }
      return response.json() as Promise<{ imported: number; skipped: number; errors: Array<{ row: number; message: string }> }>;
    },
    onSuccess: () => {
      if (tenant?.id) {
        qc.invalidateQueries({ queryKey: keys.coa(tenant.id) });
        qc.invalidateQueries({ queryKey: keys.importLogs(tenant.id) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// QuickBooks Online hooks
// ---------------------------------------------------------------------------

async function apiFetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const session = (await supabase.auth.getSession()).data.session;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      ...options.headers,
    },
  });
}

export function useQboStatus(tenantId?: string) {
  return useQuery({
    queryKey: ['qbo-status', tenantId],
    queryFn: async () => {
      if (!tenantId) return { connected: false, realmId: null, connectedAt: null, lastSyncAt: null };
      const res = await apiFetchWithAuth(`/api/qbo/status/${tenantId}?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Failed to fetch QBO status');
      return res.json() as Promise<{
        connected: boolean;
        realmId: string | null;
        connectedAt: string | null;
        lastSyncAt: string | null;
      }>;
    },
    enabled: !!tenantId,
  });
}

export function useQboConnect() {
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetchWithAuth(`/api/qbo/auth-url?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Failed to get QBO auth URL');
      const { url } = await res.json();
      window.location.href = url;
    },
  });
}

export function useQboDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetchWithAuth('/api/qbo/disconnect', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) throw new Error('Failed to disconnect QBO');
    },
    onSuccess: (_data, tenantId) => {
      qc.invalidateQueries({ queryKey: ['qbo-status', tenantId] });
    },
  });
}

export function useQboSyncCoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiFetchWithAuth('/api/qbo/sync-coa', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      return res.json() as Promise<{ imported: number; updated: number; skipped: number }>;
    },
    onSuccess: (_data, tenantId) => {
      qc.invalidateQueries({ queryKey: keys.coa(tenantId) });
    },
  });
}

export function useQboSyncActuals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, fiscalYearId, year }: { tenantId: string; fiscalYearId: string; year: number }) => {
      const res = await apiFetchWithAuth('/api/qbo/sync-actuals', {
        method: 'POST',
        body: JSON.stringify({ tenantId, fiscalYearId, year }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      return res.json() as Promise<{ synced: number; errors: string[] }>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.lineItems(vars.fiscalYearId, vars.tenantId) });
    },
  });
}
