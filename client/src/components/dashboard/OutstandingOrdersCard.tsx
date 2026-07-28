import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Package, ArrowRight, Check } from 'lucide-react';
import { colors } from '@/lib/colors';

interface OutstandingOrder {
  id: string;
  order_date: string;
  units: number;
  total_cost: number | null;
  tenant_coffee_vendors: { display_name: string } | null;
}

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

// Only surface recently-placed orders. Orders older than this are presumed
// delivered (bulk coffee/dairy arrives within days) and drop off the cue
// automatically, so a forgotten "Mark received" never leaves stale rows here.
// Tune this if a vendor routinely takes longer to deliver.
const OUTSTANDING_WINDOW_DAYS = 14;

/**
 * Dashboard frame listing bulk orders that were sent to a vendor but not yet
 * marked received, within the recency window. Renders nothing when empty.
 */
export function OutstandingOrdersCard() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: orders } = useQuery({
    queryKey: ['outstanding-orders', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async (): Promise<OutstandingOrder[]> => {
      const cutoff = new Date(Date.now() - OUTSTANDING_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('coffee_order_history')
        .select('id, order_date, units, total_cost, tenant_coffee_vendors(display_name)')
        .eq('tenant_id', tenant!.id)
        .eq('sent_to_vendor', true)
        .is('received_at', null)
        .gte('order_date', cutoff)
        .order('order_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as unknown as OutstandingOrder[]) || [];
    },
  });

  const setReceivedAt = async (orderId: string, value: string | null) => {
    const { error } = await supabase.from('coffee_order_history').update({ received_at: value }).eq('id', orderId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['outstanding-orders', tenant?.id] });
  };

  // Mark received straight from the dashboard, with a one-tap Undo (nothing
  // else in the UI can un-receive an order, so a mis-tap must be reversible).
  const markReceived = useMutation({
    mutationFn: (orderId: string) => setReceivedAt(orderId, new Date().toISOString()),
    onSuccess: (_data, orderId) => {
      toast({
        title: 'Order marked received',
        action: (
          <ToastAction altText="Undo" onClick={() => undoReceived.mutate(orderId)}>
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (err) =>
      toast({ title: 'Failed to mark received', description: getErrorMessage(err), variant: 'destructive' }),
  });

  const undoReceived = useMutation({
    mutationFn: (orderId: string) => setReceivedAt(orderId, null),
    onSuccess: () => toast({ title: 'Order restored' }),
    onError: (err) => toast({ title: 'Failed to undo', description: getErrorMessage(err), variant: 'destructive' }),
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                    style={{
                      backgroundColor: overdue ? '#fef2f2' : '#fef3c7',
                      color: overdue ? '#dc2626' : '#92400e',
                    }}
                  >
                    {days === 0 ? 'today' : `${days}d ago`}
                  </span>
                  <button
                    onClick={() => markReceived.mutate(order.id)}
                    disabled={markReceived.isPending && markReceived.variables === order.id}
                    title="Mark received"
                    aria-label={`Mark ${order.tenant_coffee_vendors?.display_name || 'vendor'} order received`}
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded disabled:opacity-50"
                    style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
                    data-testid={`button-dashboard-mark-received-${order.id}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Received
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: colors.brownLight }}>
          Tap <span className="font-semibold">Received</span> when an order arrives. Orders older than{' '}
          {OUTSTANDING_WINDOW_DAYS} days clear automatically.
        </p>
      </CardContent>
    </Card>
  );
}
