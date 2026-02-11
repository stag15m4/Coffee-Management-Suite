import { Coffee, Package } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { MOCK_RECENT_ORDERS, useMockData } from './MockDataProvider';
import { colors } from '@/lib/colors';

interface Order {
  id: string;
  order_date: string;
  total_amount: number;
  items_count: number;
  vendor_name: string | null;
}

export function RecentOrdersWidget() {
  const { tenant } = useAuth();
  const { isMockMode } = useMockData();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-orders', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      // Use mock data in dev mode
      if (isMockMode) {
        return MOCK_RECENT_ORDERS;
      }

      // Get recent orders
      const { data: orders, error: ordersError } = await supabase
        .from('coffee_order_history')
        .select(`
          id,
          order_date,
          total_amount,
          order_items,
          vendor:tenant_coffee_vendors(vendor_name)
        `)
        .eq('tenant_id', tenant.id)
        .order('order_date', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      const formattedOrders: Order[] = (orders || []).map((order: any) => {
        const items = typeof order.order_items === 'string'
          ? JSON.parse(order.order_items)
          : order.order_items || [];

        return {
          id: order.id,
          order_date: order.order_date,
          total_amount: Number(order.total_amount) || 0,
          items_count: Array.isArray(items) ? items.length : 0,
          vendor_name: order.vendor?.vendor_name || 'Unknown Vendor',
        };
      });

      const totalThisMonth = formattedOrders
        .filter((order) => {
          const orderDate = new Date(order.order_date);
          const now = new Date();
          return (
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear()
          );
        })
        .reduce((sum, order) => sum + order.total_amount, 0);

      return {
        orders: formattedOrders,
        totalThisMonth,
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <DashboardWidget
      title="Recent Coffee Orders"
      icon={Coffee}
      loading={isLoading}
      error={error ? 'Failed to load orders' : undefined}
    >
      {data && (
        <>
          {data.orders.length === 0 ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: colors.brownLight }}>
              <Package className="w-4 h-4" style={{ color: colors.gold }} />
              <span>No orders yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {data.orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: colors.brown }}>
                        {order.vendor_name}
                      </p>
                      <p className="text-xs" style={{ color: colors.brownLight }}>
                        {order.items_count} {order.items_count === 1 ? 'item' : 'items'} · {formatDate(order.order_date)}
                      </p>
                    </div>
                    <p className="text-sm font-medium ml-2" style={{ color: colors.brown }}>
                      {formatCurrency(order.total_amount)}
                    </p>
                  </div>
                ))}
              </div>

              {data.totalThisMonth > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: colors.brownLight }}>
                      Total this month
                    </span>
                    <span className="text-sm font-bold" style={{ color: colors.gold }}>
                      {formatCurrency(data.totalThisMonth)}
                    </span>
                  </div>
                </div>
              )}

              <Link href="/coffee-order">
                <button
                  className="w-full text-sm font-medium mt-2 py-1 rounded hover:opacity-80 transition-opacity"
                  style={{ color: colors.gold }}
                >
                  View all orders →
                </button>
              </Link>
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
