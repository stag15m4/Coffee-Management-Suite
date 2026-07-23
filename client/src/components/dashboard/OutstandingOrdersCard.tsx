import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Card, CardContent } from '@/components/ui/card';
import { Package, ArrowRight } from 'lucide-react';
import { colors } from '@/lib/colors';

interface OutstandingOrder {
  id: string;
  order_date: string;
  units: number;
  total_cost: number | null;
  tenant_coffee_vendors: { display_name: string } | null;
}

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

/**
 * Dashboard frame listing bulk orders that were sent to a vendor but not yet
 * marked received. Renders nothing when there are no outstanding orders.
 */
export function OutstandingOrdersCard() {
  const { tenant } = useAuth();

  const { data: orders } = useQuery({
    queryKey: ['outstanding-orders', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async (): Promise<OutstandingOrder[]> => {
      const { data, error } = await supabase
        .from('coffee_order_history')
        .select('id, order_date, units, total_cost, tenant_coffee_vendors(display_name)')
        .eq('tenant_id', tenant!.id)
        .eq('sent_to_vendor', true)
        .is('received_at', null)
        .order('order_date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data as unknown as OutstandingOrder[]) || [];
    },
  });

  if (!orders || orders.length === 0) return null;

  const daysSince = (dateStr: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 3600 * 1000)));

  return (
    <Card className="mb-6" data-testid="card-outstanding-orders">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.cream }}
            >
              <Package className="w-4 h-4" style={{ color: colors.gold }} />
            </div>
            <h3 className="font-semibold" style={{ color: colors.brown }}>
              Outstanding Orders
            </h3>
          </div>
          <Link href="/coffee-order">
            <span
              className="text-sm font-medium flex items-center gap-1 cursor-pointer hover:opacity-80"
              style={{ color: colors.gold }}
            >
              View <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
        <div className="space-y-2">
          {orders.map((order) => {
            const days = daysSince(order.order_date);
            const overdue = days >= 7;
            return (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md"
                style={{ backgroundColor: colors.cream }}
                data-testid={`outstanding-order-${order.id}`}
              >
                <div className="min-w-0">
                  <span className="font-medium text-sm" style={{ color: colors.brown }}>
                    {order.tenant_coffee_vendors?.display_name || 'Vendor'}
                  </span>
                  <span className="text-sm ml-2" style={{ color: colors.brownLight }}>
                    {order.units} units
                    {order.total_cost ? ` · ${formatCurrency(Number(order.total_cost))}` : ''}
                  </span>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                  style={{
                    backgroundColor: overdue ? '#fef2f2' : '#fef3c7',
                    color: overdue ? '#dc2626' : '#92400e',
                  }}
                >
                  {days === 0 ? 'today' : `${days}d ago`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: colors.brownLight }}>
          Mark orders received on the Bulk Ordering page when they arrive.
        </p>
      </CardContent>
    </Card>
  );
}
