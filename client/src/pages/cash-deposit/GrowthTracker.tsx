import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import { formatCurrency } from './deposit-utils';
import {
  useGrowthTrackerData,
  useUpsertGrowthMonth,
  useBulkUpsertGrowthMonths,
  useOverhead,
  useUpdateOverhead,
  supabase,
} from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface GrowthTrackerProps {
  expanded: boolean;
  onToggle: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthRow {
  year: number;
  month: number;
  label: string;
  revenue: number;
  hasData: boolean;
  momPct: string | null;
  momPositive: boolean | null;
  yoyPct: string | null;
  yoyPositive: boolean | null;
}

export default function GrowthTracker({ expanded, onToggle }: GrowthTrackerProps) {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const { data: growthData = [], isLoading: growthLoading } = useGrowthTrackerData();
  const { data: overhead } = useOverhead();
  const upsertMonth = useUpsertGrowthMonth();
  const bulkUpsert = useBulkUpsertGrowthMonths();
  const updateOverhead = useUpdateOverhead();
  const [importing, setImporting] = useState(false);
  const [showChart, setShowChart] = useState(false);

  // Local edits tracked by "year-month" key; focused field tracked separately
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const openMonth = overhead?.growth_open_month as number | null;
  const openYear = overhead?.growth_open_year as number | null;
  const overheadId = overhead?.id as string | undefined;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Build a lookup from growth data
  const revenueMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of growthData) {
      map[`${row.year}-${row.month}`] = Number(row.gross_revenue) || 0;
    }
    return map;
  }, [growthData]);

  // Generate all month rows from opening date to now
  const monthRows: MonthRow[] = useMemo(() => {
    if (!openYear || !openMonth) return [];
    const rows: MonthRow[] = [];
    let y = openYear;
    let m = openMonth;
    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const key = `${y}-${m}`;
      const revenue = revenueMap[key] ?? 0;
      const hasData = key in revenueMap;

      // MoM: compare to previous month
      let prevKey: string;
      if (m === 1) {
        prevKey = `${y - 1}-12`;
      } else {
        prevKey = `${y}-${m - 1}`;
      }
      const prevRevenue = revenueMap[prevKey];
      let momPct: string | null = null;
      let momPositive: boolean | null = null;
      if (prevRevenue !== undefined && prevRevenue > 0 && hasData) {
        const pct = ((revenue - prevRevenue) / prevRevenue) * 100;
        momPct = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        momPositive = pct >= 0;
      }

      // YoY: compare to same month last year
      const yoyKey = `${y - 1}-${m}`;
      const yoyRevenue = revenueMap[yoyKey];
      let yoyPct: string | null = null;
      let yoyPositive: boolean | null = null;
      if (yoyRevenue !== undefined && yoyRevenue > 0 && hasData) {
        const pct = ((revenue - yoyRevenue) / yoyRevenue) * 100;
        yoyPct = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        yoyPositive = pct >= 0;
      }

      rows.push({
        year: y,
        month: m,
        label: `${MONTH_ABBR[m - 1]} ${y}`,
        revenue,
        hasData,
        momPct,
        momPositive,
        yoyPct,
        yoyPositive,
      });

      m++;
      if (m > 12) { m = 1; y++; }
    }
    return rows;
  }, [openYear, openMonth, currentYear, currentMonth, revenueMap]);

  // Group rows by year for display with annual totals
  const rowsByYear = useMemo(() => {
    const groups: Record<number, MonthRow[]> = {};
    for (const row of monthRows) {
      if (!groups[row.year]) groups[row.year] = [];
      groups[row.year].push(row);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, rows]) => {
        const y = Number(year);
        // Annual gross total (only months with data)
        const monthsWithData = rows.filter(r => r.hasData && r.revenue > 0);
        const annualTotal = monthsWithData.reduce((sum, r) => sum + r.revenue, 0);
        // Average MoM growth for the year
        const momValues = rows
          .filter(r => r.momPct !== null && r.momPositive !== null)
          .map(r => parseFloat(r.momPct!.replace(/[+%]/g, '')));
        const avgMom = momValues.length > 0
          ? momValues.reduce((sum, v) => sum + v, 0) / momValues.length
          : null;
        // Annual YoY: only compare months that have data in THIS year
        // against the same months in the prior year (apples to apples)
        const priorRows = groups[y - 1];
        let annualYoy: number | null = null;
        if (priorRows && monthsWithData.length > 0) {
          const activeMonths = new Set(monthsWithData.map(r => r.month));
          const priorMatchTotal = priorRows
            .filter(r => activeMonths.has(r.month) && r.hasData && r.revenue > 0)
            .reduce((sum, r) => sum + r.revenue, 0);
          if (priorMatchTotal > 0) {
            annualYoy = ((annualTotal - priorMatchTotal) / priorMatchTotal) * 100;
          }
        }
        return {
          year: y,
          rows: [...rows].reverse(),
          annualTotal,
          avgMom,
          annualYoy,
        };
      });
  }, [monthRows]);

  // Latest MoM and YoY for collapsed summary
  const latestMom = useMemo(() => {
    for (let i = monthRows.length - 1; i >= 0; i--) {
      if (monthRows[i].momPct) return monthRows[i];
    }
    return null;
  }, [monthRows]);

  const latestYoy = useMemo(() => {
    for (let i = monthRows.length - 1; i >= 0; i--) {
      if (monthRows[i].yoyPct) return monthRows[i];
    }
    return null;
  }, [monthRows]);

  // Chart data (ascending order for chart)
  const chartData = useMemo(() => {
    return monthRows
      .filter(r => r.hasData && r.revenue > 0)
      .map(r => ({
        name: `${MONTH_ABBR[r.month - 1]} '${String(r.year).slice(2)}`,
        revenue: r.revenue,
      }));
  }, [monthRows]);

  // Save opening date
  const handleOpenDateChange = useCallback((field: 'growth_open_month' | 'growth_open_year', value: number) => {
    if (!overheadId) return;
    updateOverhead.mutate({ id: overheadId, updates: { [field]: value } });
  }, [overheadId, updateOverhead]);

  // Clear local edits once the saved data catches up
  useEffect(() => {
    setLocalEdits(prev => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        const saved = revenueMap[key];
        const edited = parseFloat(next[key]) || 0;
        if (saved !== undefined && Math.abs(saved - edited) < 0.01) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [revenueMap]);

  // Auto-save revenue on blur with debounce
  const handleRevenueChange = useCallback((year: number, month: number, value: string) => {
    const key = `${year}-${month}`;
    setLocalEdits(prev => ({ ...prev, [key]: value }));

    // Clear existing timeout
    if (saveTimeouts.current[key]) clearTimeout(saveTimeouts.current[key]);

    // Debounced save
    saveTimeouts.current[key] = setTimeout(() => {
      const numValue = parseFloat(value) || 0;
      if (tenant?.id) {
        upsertMonth.mutate({
          tenant_id: tenant.id,
          year,
          month,
          gross_revenue: numValue,
        });
      }
    }, 1500);
  }, [tenant?.id, upsertMonth]);

  const handleRevenueBlur = useCallback((year: number, month: number) => {
    const key = `${year}-${month}`;
    const editValue = localEdits[key];
    if (editValue === undefined) return;

    // Clear debounce and save immediately
    if (saveTimeouts.current[key]) clearTimeout(saveTimeouts.current[key]);
    const numValue = parseFloat(editValue) || 0;
    if (tenant?.id) {
      upsertMonth.mutate({
        tenant_id: tenant.id,
        year,
        month,
        gross_revenue: numValue,
      });
    }
  }, [tenant?.id, upsertMonth, localEdits]);

  // Import from cash deposits
  const handleImport = useCallback(async () => {
    if (!tenant?.id) return;
    setImporting(true);
    try {
      const { data, error } = await supabase
        .from('cash_activity')
        .select('drawer_date, gross_revenue')
        .eq('tenant_id', tenant.id)
        .or('archived.is.null,archived.eq.false');
      if (error) throw error;

      // Aggregate by month
      const monthly: Record<string, number> = {};
      for (const row of data || []) {
        const d = new Date(row.drawer_date + 'T00:00:00');
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        monthly[key] = (monthly[key] || 0) + (Number(row.gross_revenue) || 0);
      }

      const entries = Object.entries(monthly).map(([key, revenue]) => {
        const [y, m] = key.split('-').map(Number);
        return { tenant_id: tenant.id, year: y, month: m, gross_revenue: Math.round(revenue * 100) / 100 };
      });

      if (entries.length === 0) {
        toast({ title: 'No cash deposit data found to import' });
        return;
      }

      await bulkUpsert.mutateAsync(entries);
      toast({ title: `Imported ${entries.length} months from cash deposits` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [tenant?.id, bulkUpsert, toast]);

  const getRevenueValue = (year: number, month: number): string => {
    const key = `${year}-${month}`;
    const isFocused = focusedKey === key;
    // While editing, show raw number
    if (key in localEdits) return localEdits[key];
    const saved = revenueMap[key];
    if (saved !== undefined && saved > 0) {
      // When focused, show raw number for easy editing; otherwise formatted
      return isFocused ? saved.toFixed(2) : saved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '';
  };

  // Year options for dropdown
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y--) years.push(y);
    return years;
  }, [currentYear]);

  const hasSetup = openYear && openMonth;

  return (
    <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
      <CardContent className="pt-4 pb-4">
        {/* Header / Toggle */}
        <button
          type="button"
          className="flex items-center justify-between w-full text-left gap-2 transition-colors hover:opacity-80"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: colors.gold }} />
            <span className="text-sm font-semibold" style={{ color: colors.brown }}>
              Growth Tracker
            </span>
            {!expanded && hasSetup && latestMom && (
              <span className="flex items-center gap-1 text-xs ml-2">
                {latestMom.momPositive ? (
                  <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />
                ) : (
                  <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                )}
                <span style={{ color: latestMom.momPositive ? '#16a34a' : '#ef4444' }}>
                  MoM {latestMom.momPct}
                </span>
              </span>
            )}
            {!expanded && hasSetup && latestYoy && (
              <span className="flex items-center gap-1 text-xs ml-2">
                {latestYoy.yoyPositive ? (
                  <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />
                ) : (
                  <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                )}
                <span style={{ color: latestYoy.yoyPositive ? '#16a34a' : '#ef4444' }}>
                  YoY {latestYoy.yoyPct}
                </span>
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
            style={{ color: colors.brownLight }}
          />
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Opening Date & Actions */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: colors.brownLight }}>
                  Business Opened
                </label>
                <div className="flex gap-2">
                  <select
                    value={openMonth || ''}
                    onChange={(e) => handleOpenDateChange('growth_open_month', Number(e.target.value))}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }}
                  >
                    <option value="">Month</option>
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={i + 1}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={openYear || ''}
                    onChange={(e) => handleOpenDateChange('growth_open_year', Number(e.target.value))}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }}
                  >
                    <option value="">Year</option>
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-1.5"
                style={{ borderColor: colors.gold, color: colors.gold }}
              >
                <Download className="w-3.5 h-3.5" />
                {importing ? 'Importing...' : 'Import from Cash Deposits'}
              </Button>
              {monthRows.length > 0 && chartData.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChart(!showChart)}
                  className="flex items-center gap-1.5"
                  style={{ borderColor: colors.creamDark, color: colors.brownLight }}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  {showChart ? 'Hide Chart' : 'Show Chart'}
                </Button>
              )}
            </div>

            {!hasSetup && (
              <div className="text-center py-6">
                <BarChart3 className="w-8 h-8 mx-auto mb-2" style={{ color: colors.brownLight }} />
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Set your business opening date above to start tracking growth.
                </p>
              </div>
            )}

            {/* Chart */}
            {hasSetup && showChart && chartData.length > 1 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: colors.brownLight }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: colors.brownLight }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{
                        backgroundColor: colors.white,
                        borderColor: colors.creamDark,
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="revenue" fill={colors.gold} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly Revenue Table */}
            {hasSetup && monthRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${colors.creamDark}` }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: colors.brown }}>
                      <th className="px-4 py-2.5 text-left font-semibold text-white">Month</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-white">Revenue</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-white">MoM</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-white">YoY</th>
                    </tr>
                  </thead>
                  {rowsByYear.map(({ year, rows, annualTotal, avgMom, annualYoy }) => (
                    <tbody key={year}>
                      <tr style={{ backgroundColor: colors.brown, borderTop: `3px solid ${colors.gold}` }}>
                        <td className="px-4 py-2.5 font-bold text-base text-white">
                          {year}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-sm" style={{ color: colors.gold }}>
                          {annualTotal > 0 ? formatCurrency(annualTotal) : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-sm text-white">
                          {avgMom !== null ? (
                            <span style={{ color: avgMom >= 0 ? '#4ade80' : '#fca5a5' }}>
                              Avg: {avgMom >= 0 ? '+' : ''}{avgMom.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-sm text-white">
                          {annualYoy !== null ? (
                            <span style={{ color: annualYoy >= 0 ? '#4ade80' : '#fca5a5' }}>
                              {annualYoy >= 0 ? '+' : ''}{annualYoy.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                      </tr>
                      {rows.map((row, idx) => (
                        <tr
                          key={`${row.year}-${row.month}`}
                          style={{
                            backgroundColor: idx % 2 === 1 ? colors.cream : colors.white,
                            borderBottom: `1px solid ${colors.creamDark}`,
                          }}
                        >
                          <td className="px-4 py-2" style={{ color: colors.brown }}>
                            {MONTH_NAMES[row.month - 1]}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-2 text-sm" style={{ color: colors.brownLight }}>$</span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={getRevenueValue(row.year, row.month)}
                                onFocus={() => {
                                  const key = `${row.year}-${row.month}`;
                                  setFocusedKey(key);
                                  // Put raw number into local edits on focus for clean editing
                                  const saved = revenueMap[key];
                                  if (saved !== undefined && saved > 0 && !(key in localEdits)) {
                                    setLocalEdits(prev => ({ ...prev, [key]: saved.toFixed(2) }));
                                  }
                                }}
                                onChange={(e) => {
                                  // Allow only digits, decimal point, and empty
                                  const v = e.target.value.replace(/[^0-9.]/g, '');
                                  handleRevenueChange(row.year, row.month, v);
                                }}
                                onBlur={() => {
                                  setFocusedKey(null);
                                  handleRevenueBlur(row.year, row.month);
                                }}
                                className="w-32 text-right pl-6 pr-2 py-1 h-8 text-sm"
                                style={{
                                  backgroundColor: colors.inputBg,
                                  borderColor: colors.gold,
                                  color: colors.brown,
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-medium">
                            {row.momPct ? (
                              <span className="flex items-center justify-end gap-1">
                                {row.momPositive ? (
                                  <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />
                                ) : (
                                  <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                                )}
                                <span style={{ color: row.momPositive ? '#16a34a' : '#ef4444' }}>
                                  {row.momPct}
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: colors.creamDark }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-medium">
                            {row.yoyPct ? (
                              <span className="flex items-center justify-end gap-1">
                                {row.yoyPositive ? (
                                  <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />
                                ) : (
                                  <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                                )}
                                <span style={{ color: row.yoyPositive ? '#16a34a' : '#ef4444' }}>
                                  {row.yoyPct}
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: colors.creamDark }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            )}

            {growthLoading && (
              <div className="text-center py-4 text-sm" style={{ color: colors.brownLight }}>
                Loading growth data...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
