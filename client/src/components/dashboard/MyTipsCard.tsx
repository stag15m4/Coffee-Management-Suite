import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { buildMyTipsCsv, buildMyTipsPrintHtml, type MyTipPayout } from '@/lib/my-tips-export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Printer } from 'lucide-react';

export function MyTipsCard() {
  const { user, profile, branding, enabledModules } = useAuth();
  const showTips = enabledModules.includes('tip-payout');
  const [searching, setSearching] = useState(false);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  const { data, isError, isFetching } = useQuery({
    queryKey: ['my-tip-payouts', user?.id, range?.start ?? null, range?.end ?? null],
    enabled: !!user?.id && showTips,
    staleTime: 30_000,
    queryFn: async (): Promise<MyTipPayout[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again');
      const params = new URLSearchParams();
      if (range?.start) params.set('start', range.start);
      if (range?.end) params.set('end', range.end);
      const query = params.toString();
      const response = await fetch(`/api/tip-payouts/mine${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Unable to load tip payouts');
      const result = await response.json();
      return result.payouts;
    },
  });

  if (!showTips) return null;

  const employeeName = profile?.full_name || 'Employee';
  const hasRows = !!data?.length;

  const handleExportCsv = () => {
    if (!data?.length) return;
    const csv = buildMyTipsCsv(employeeName, data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tip-payouts-${employeeName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!data?.length) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(buildMyTipsPrintHtml(employeeName, branding?.company_name || '', data));
    printWindow.document.close();
  };

  return (
    <section className="rounded-xl p-4 mb-6" style={{ background: 'var(--color-background, white)' }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-secondary, #4a3728)' }}>
          My Tip Payouts
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSearching(!searching)}>
            <Search className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!hasRows} onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!hasRows} onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {searching && (
        <div className="flex items-end gap-2 mb-3 flex-wrap text-xs">
          <div className="space-y-1">
            <label className="opacity-70">Start</label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={range?.start ?? ''}
              onChange={(e) => setRange((r) => ({ start: e.target.value, end: r?.end ?? '' }))}
            />
          </div>
          <div className="space-y-1">
            <label className="opacity-70">End</label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={range?.end ?? ''}
              onChange={(e) => setRange((r) => ({ start: r?.start ?? '', end: e.target.value }))}
            />
          </div>
          {range && (range.start || range.end) && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setRange(null)}>
              Reset
            </Button>
          )}
        </div>
      )}

      {isError ? (
        <p className="text-sm">Tip payouts could not be loaded. Please refresh.</p>
      ) : isFetching ? (
        <p className="text-sm opacity-70">Loading…</p>
      ) : !hasRows ? (
        <p className="text-sm opacity-70">
          {range?.start || range?.end
            ? 'No approved tip payouts in that range.'
            : 'Approved tip payouts will appear here.'}
        </p>
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
