import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import type {
  ForecastScenario,
  ForecastLineItem,
  ForecastDriver,
  SeasonalPattern,
} from '@/pages/financial-budget/types';

const keys = {
  scenarios: (fyId?: string, tenantId?: string) => ['forecast-scenarios', fyId, tenantId] as const,
  lineItems: (scenarioId?: string, tenantId?: string) => ['forecast-line-items', scenarioId, tenantId] as const,
  drivers: (scenarioId?: string) => ['forecast-drivers', scenarioId] as const,
  seasonalPatterns: (tenantId?: string) => ['seasonal-patterns', tenantId] as const,
};

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export function useForecastScenarios(fiscalYearId?: string, tenantId?: string) {
  return useQuery({
    queryKey: keys.scenarios(fiscalYearId, tenantId),
    queryFn: async () => {
      if (!fiscalYearId || !tenantId) return [];
      const { data, error } = await supabase
        .from('budget_forecast_scenarios')
        .select('*')
        .eq('fiscal_year_id', fiscalYearId)
        .eq('tenant_id', tenantId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data || []) as ForecastScenario[];
    },
    enabled: !!fiscalYearId && !!tenantId,
  });
}

export function useCreateForecastScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scenario: {
      tenant_id: string;
      fiscal_year_id: string;
      name: string;
      description?: string;
      is_default?: boolean;
      created_by?: string;
    }) => {
      const { data, error } = await supabase.from('budget_forecast_scenarios').insert(scenario).select().single();
      if (error) throw error;
      return data as ForecastScenario;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.scenarios(vars.fiscal_year_id, vars.tenant_id) });
    },
  });
}

export function useDeleteForecastScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fiscal_year_id: _fiscal_year_id,
      tenant_id: _tenant_id,
    }: {
      id: string;
      fiscal_year_id: string;
      tenant_id: string;
    }) => {
      const { error } = await supabase.from('budget_forecast_scenarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.scenarios(vars.fiscal_year_id, vars.tenant_id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Forecast Line Items
// ---------------------------------------------------------------------------

export function useForecastLineItems(scenarioId?: string, tenantId?: string) {
  return useQuery({
    queryKey: keys.lineItems(scenarioId, tenantId),
    queryFn: async () => {
      if (!scenarioId || !tenantId) return [];
      const { data, error } = await supabase
        .from('budget_forecast_line_items')
        .select('*')
        .eq('scenario_id', scenarioId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data || []) as ForecastLineItem[];
    },
    enabled: !!scenarioId && !!tenantId,
  });
}

export function useUpsertForecastLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      tenant_id: string;
      scenario_id: string;
      account_id: string;
      month: number;
      forecast_amount: number;
    }) => {
      const { data, error } = await supabase
        .from('budget_forecast_line_items')
        .upsert(
          { ...item, updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id,scenario_id,account_id,month' }
        )
        .select()
        .single();
      if (error) throw error;
      return data as ForecastLineItem;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.lineItems(vars.scenario_id, vars.tenant_id) });
    },
  });
}

export function useBulkUpsertForecastLineItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: Array<{
        tenant_id: string;
        scenario_id: string;
        account_id: string;
        month: number;
        forecast_amount: number;
      }>
    ) => {
      if (items.length === 0) return [];
      const withTimestamp = items.map((i) => ({ ...i, updated_at: new Date().toISOString() }));
      const { data, error } = await supabase
        .from('budget_forecast_line_items')
        .upsert(withTimestamp, { onConflict: 'tenant_id,scenario_id,account_id,month' })
        .select();
      if (error) throw error;
      return (data || []) as ForecastLineItem[];
    },
    onSuccess: (_data, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: keys.lineItems(vars[0].scenario_id, vars[0].tenant_id) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Forecast Drivers
// ---------------------------------------------------------------------------

export function useForecastDrivers(scenarioId?: string) {
  return useQuery({
    queryKey: keys.drivers(scenarioId),
    queryFn: async () => {
      if (!scenarioId) return [];
      const { data, error } = await supabase
        .from('budget_forecast_drivers')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('priority')
        .order('created_at');
      if (error) throw error;
      return (data || []) as ForecastDriver[];
    },
    enabled: !!scenarioId,
  });
}

export function useCreateForecastDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (driver: {
      tenant_id: string;
      scenario_id: string;
      target_account_id: string;
      driver_type: string;
      source_account_id?: string | null;
      driver_value: number;
      apply_months?: number[];
    }) => {
      const { data, error } = await supabase.from('budget_forecast_drivers').insert(driver).select().single();
      if (error) throw error;
      return data as ForecastDriver;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.drivers(vars.scenario_id) });
    },
  });
}

export function useUpdateForecastDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      scenario_id: _scenario_id,
      ...updates
    }: Partial<ForecastDriver> & { id: string; scenario_id: string }) => {
      const { data, error } = await supabase
        .from('budget_forecast_drivers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ForecastDriver;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.drivers(vars.scenario_id) });
    },
  });
}

export function useDeleteForecastDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scenario_id: _scenario_id }: { id: string; scenario_id: string }) => {
      const { error } = await supabase.from('budget_forecast_drivers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.drivers(vars.scenario_id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Seasonal Patterns
// ---------------------------------------------------------------------------

export function useSeasonalPatterns(tenantId?: string) {
  return useQuery({
    queryKey: keys.seasonalPatterns(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('budget_seasonal_patterns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      if (error) throw error;
      return (data || []) as SeasonalPattern[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateSeasonalPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: { tenant_id: string; name: string; month_weights: number[] }) => {
      const { data, error } = await supabase.from('budget_seasonal_patterns').insert(pattern).select().single();
      if (error) throw error;
      return data as SeasonalPattern;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.seasonalPatterns(vars.tenant_id) });
    },
  });
}

export function useDeleteSeasonalPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenant_id: _tenant_id }: { id: string; tenant_id: string }) => {
      const { error } = await supabase.from('budget_seasonal_patterns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.seasonalPatterns(vars.tenant_id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Apply Drivers (server-side calculation)
// ---------------------------------------------------------------------------

export function useApplyDrivers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ scenarioId, tenantId }: { scenarioId: string; tenantId: string }) => {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/budget/forecast/apply-drivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ scenarioId, tenantId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to apply drivers');
      }
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.lineItems(vars.scenarioId, vars.tenantId) });
    },
  });
}
