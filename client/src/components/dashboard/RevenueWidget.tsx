import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { MOCK_REVENUE_DATA, useMockData } from './MockDataProvider';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  green: '#22c55e',
  red: '#ef4444',
};

export function RevenueWidget() {
  const { tenant } = useAuth();
  const { isMockMode } = useMockData();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-revenue', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      // Use mock data in dev mode
      if (isMockMode) {
        return MOCK_REVENUE_DATA;
      }

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get current month revenue
      const { data: currentMonth, error: currentError } = await supabase
        .from('cash_activity')
        .select('gross_revenue')
        .eq('tenant_id', tenant.id)
        .gte('drawer_date', firstDayOfMonth)
        .lte('drawer_date', lastDayOfMonth)
        .or('archived.is.null,archived.eq.false');

      if (currentError) throw currentError;

      // Get last month revenue for comparison
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

      const { data: lastMonth, error: lastError } = await supabase
        .from('cash_activity')
        .select('gross_revenue')
        .eq('tenant_id', tenant.id)
        .gte('drawer_date', firstDayLastMonth)
        .lte('drawer_date', lastDayLastMonth)
        .or('archived.is.null,archived.eq.false');

      if (lastError) throw lastError;

      const currentTotal = currentMonth?.reduce((sum, entry) => sum + (Number(entry.gross_revenue) || 0), 0) || 0;
      const lastTotal = lastMonth?.reduce((sum, entry) => sum + (Number(entry.gross_revenue) || 0), 0) || 0;

      const percentChange = lastTotal > 0 ? ((currentTotal - lastTotal) / lastTotal) * 100 : 0;

      return {
        currentMonth: currentTotal,
        lastMonth: lastTotal,
        percentChange,
        trend: currentTotal >= lastTotal ? 'up' : 'down',
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60000, // 1 minute
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <DashboardWidget
      title="Revenue This Month"
      icon={DollarSign}
      loading={isLoading}
      error={error ? 'Failed to load revenue data' : undefined}
    >
      {data && (
        <div className="space-y-3">
          <div>
            <p className="text-3xl font-bold" style={{ color: colors.brown }}>
              {formatCurrency(data.currentMonth)}
            </p>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Total gross revenue
            </p>
          </div>

          {data.lastMonth > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              {data.trend === 'up' ? (
                <TrendingUp className="w-4 h-4" style={{ color: colors.green }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: colors.red }} />
              )}
              <span
                className="text-sm font-medium"
                style={{ color: data.trend === 'up' ? colors.green : colors.red }}
              >
                {Math.abs(data.percentChange).toFixed(1)}%
              </span>
              <span className="text-sm" style={{ color: colors.brownLight }}>
                vs last month
              </span>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
