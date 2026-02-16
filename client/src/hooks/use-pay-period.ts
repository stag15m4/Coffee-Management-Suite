import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import {
  type PayPeriodType,
  type PayPeriod,
  getCurrentPayPeriod,
  getNextPayPeriod,
  getPreviousPayPeriod,
  getDaysInPayPeriod,
  getWeekGroupsInPeriod,
} from '@/lib/pay-periods';

/** Fetch pay period config from tenants table. */
export function usePayPeriodConfig() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: ['pay-period-config', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('pay_period_type, pay_period_anchor_date')
        .eq('id', tenant.id)
        .single();
      if (error) throw error;
      return data as { pay_period_type: PayPeriodType; pay_period_anchor_date: string };
    },
    enabled: !!tenant?.id,
    staleTime: 10 * 60_000, // 10 min — rarely changes
  });
}

/** Full pay period hook with navigation. */
export function usePayPeriod() {
  const { data: config, isLoading } = usePayPeriodConfig();
  const periodType = config?.pay_period_type ?? 'biweekly';
  const anchorDate = config?.pay_period_anchor_date ?? '2026-01-05';

  const [period, setPeriod] = useState<PayPeriod>(() =>
    getCurrentPayPeriod(periodType, anchorDate)
  );

  // Re-sync when config loads (only on first load)
  const [initialized, setInitialized] = useState(false);
  if (config && !initialized) {
    const current = getCurrentPayPeriod(config.pay_period_type, config.pay_period_anchor_date);
    setPeriod(current);
    setInitialized(true);
  }

  const goNext = useCallback(() => {
    setPeriod((prev) => getNextPayPeriod(prev, periodType, anchorDate));
  }, [periodType, anchorDate]);

  const goPrev = useCallback(() => {
    setPeriod((prev) => getPreviousPayPeriod(prev, periodType, anchorDate));
  }, [periodType, anchorDate]);

  const days = useMemo(() => getDaysInPayPeriod(period), [period]);
  const weeks = useMemo(() => getWeekGroupsInPeriod(period), [period]);

  return { period, days, weeks, goNext, goPrev, periodType, anchorDate, isLoading };
}
