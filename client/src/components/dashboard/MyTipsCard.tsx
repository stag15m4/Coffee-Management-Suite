import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

interface MyTipPayout {
  week_key: string;
  approved_at: string;
  hours: string;
  payout: string;
  tenant_id: string;
}

export function MyTipsCard() {
  const { user, enabledModules } = useAuth();
  const showTips = enabledModules.includes('tip-payout');
  const { data, isError } = useQuery({
    queryKey: ['my-tip-payouts', user?.id],
    enabled: !!user?.id && showTips,
    staleTime: 30_000,
    queryFn: async (): Promise<MyTipPayout[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again');
      const response = await fetch('/api/tip-payouts/mine', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Unable to load tip payouts');
      const result = await response.json();
      return result.payouts;
    },
  });

  if (!showTips) return null;

  return (
    <section className="rounded-xl p-4" style={{ background: 'var(--color-background, white)' }}>
      <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-secondary, #4a3728)' }}>
        My Tip Payouts
      </h2>
      {isError ? (
        <p className="text-sm">Tip payouts could not be loaded. Please refresh.</p>
      ) : !data?.length ? (
        <p className="text-sm opacity-70">Approved tip payouts will appear here.</p>
      ) : (
        <div className="space-y-2">
          {data.map((tip) => (
            <div key={`${tip.tenant_id}-${tip.week_key}`} className="flex items-center justify-between text-sm gap-3">
              <div>
                <span className="font-medium">Week of {new Date(`${tip.week_key}T00:00:00`).toLocaleDateString()}</span>
                <span className="block opacity-70">{Number(tip.hours).toFixed(2)} tip hours · Approved</span>
              </div>
              <strong>${Number(tip.payout).toFixed(2)}</strong>
            </div>
          ))}
          <p className="text-xs opacity-70">Tip statement only. Payroll and taxes are handled in Gusto.</p>
        </div>
      )}
    </section>
  );
}
