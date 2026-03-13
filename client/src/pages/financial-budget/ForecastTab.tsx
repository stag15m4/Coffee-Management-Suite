import React, { useState, useMemo, useRef } from 'react';
import { colors } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useChartOfAccounts,
  useFiscalYears,
  useBudgetLineItems,
} from '@/hooks/use-budget';
import {
  useForecastScenarios,
  useCreateForecastScenario,
  useDeleteForecastScenario,
  useForecastLineItems,
  useUpsertForecastLineItem,
  useBulkUpsertForecastLineItems,
  useForecastDrivers,
  useCreateForecastDriver,
  useDeleteForecastDriver,
  useApplyDrivers,
  useSeasonalPatterns,
  useCreateSeasonalPattern,
} from '@/hooks/use-forecast';
import { buildAccountTree, ACCOUNT_TYPE_ORDER, MONTH_LABELS } from './types';
import type { ChartOfAccount, AccountType, ForecastDriver, DriverType } from './types';
import {
  Loader2, Plus, Trash2, Play, Copy, TrendingUp, TrendingDown,
  DollarSign, Percent, BarChart3, FileSpreadsheet, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Props {
  tenantId: string;
  coaTenantId: string;
}

export default function ForecastTab({ tenantId, coaTenantId }: Props) {
  const { toast } = useToast();
  const { data: accounts = [], isLoading: loadingCoa } = useChartOfAccounts(coaTenantId);
  const { data: fiscalYears = [], isLoading: loadingFY } = useFiscalYears(tenantId);

  const [selectedFYId, setSelectedFYId] = useState<string>('');
  const selectedFY = fiscalYears.find((fy) => fy.id === selectedFYId) || fiscalYears[0];
  const fyId = selectedFY?.id || '';

  // Scenarios
  const { data: scenarios = [] } = useForecastScenarios(fyId, tenantId);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios.find((s) => s.is_default) || scenarios[0];
  const scenarioId = activeScenario?.id || '';

  const createScenario = useCreateForecastScenario();
  const deleteScenario = useDeleteForecastScenario();
  const [showNewScenarioDialog, setShowNewScenarioDialog] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');

  // Data
  const { data: budgetLineItems = [] } = useBudgetLineItems(fyId, tenantId);
  const { data: forecastLineItems = [] } = useForecastLineItems(scenarioId, tenantId);
  const { data: drivers = [] } = useForecastDrivers(scenarioId);
  const { data: seasonalPatterns = [] } = useSeasonalPatterns(tenantId);

  const upsertForecast = useUpsertForecastLineItem();
  const bulkUpsertForecast = useBulkUpsertForecastLineItems();
  const createDriver = useCreateForecastDriver();
  const deleteDriver = useDeleteForecastDriver();
  const applyDrivers = useApplyDrivers();
  const createPattern = useCreateSeasonalPattern();

  // UI state
  const [showDrivers, setShowDrivers] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);

  // Current month (1-12) — months before this are "closed"
  const currentMonth = new Date().getMonth() + 1;

  // Build maps
  const { budgetMap, actualMap, forecastMap } = useMemo(() => {
    const budget = new Map<string, number>();
    const actual = new Map<string, number>();
    for (const item of budgetLineItems) {
      const key = `${item.account_id}-${item.month}`;
      budget.set(key, Number(item.budget_amount) || 0);
      if (item.actual_amount !== null && item.actual_amount !== undefined) {
        actual.set(key, Number(item.actual_amount));
      }
    }
    const forecast = new Map<string, number>();
    for (const item of forecastLineItems) {
      const key = `${item.account_id}-${item.month}`;
      forecast.set(key, Number(item.forecast_amount) || 0);
    }
    return { budgetMap: budget, actualMap: actual, forecastMap: forecast };
  }, [budgetLineItems, forecastLineItems]);

  // Local edits
  const [localEdits, setLocalEdits] = useState<Map<string, string>>(new Map());
  const saveTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const getCellValue = (accountId: string, month: number): string => {
    const key = `${accountId}-${month}`;
    if (localEdits.has(key)) return localEdits.get(key)!;
    // For closed months show actual, for future months show forecast
    if (month < currentMonth && actualMap.has(key)) {
      return actualMap.get(key)!.toString();
    }
    const val = forecastMap.get(key);
    return val !== undefined && val !== 0 ? val.toString() : '';
  };

  const isClosed = (month: number) => month < currentMonth;

  const handleCellChange = (accountId: string, month: number, value: string) => {
    if (isClosed(month)) return;
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    const key = `${accountId}-${month}`;
    setLocalEdits((prev) => { const next = new Map(prev); next.set(key, value); return next; });
    const existing = saveTimeoutRef.current.get(key);
    if (existing) clearTimeout(existing);
    saveTimeoutRef.current.set(key, setTimeout(() => {
      upsertForecast.mutate({
        tenant_id: tenantId,
        scenario_id: scenarioId,
        account_id: accountId,
        month,
        forecast_amount: parseFloat(value) || 0,
      });
      setLocalEdits((prev) => { const next = new Map(prev); next.delete(key); return next; });
      saveTimeoutRef.current.delete(key);
    }, 800));
  };

  const handleCellBlur = (accountId: string, month: number) => {
    if (isClosed(month)) return;
    const key = `${accountId}-${month}`;
    const existing = saveTimeoutRef.current.get(key);
    if (existing) { clearTimeout(existing); saveTimeoutRef.current.delete(key); }
    const value = localEdits.get(key);
    if (value !== undefined) {
      upsertForecast.mutate({
        tenant_id: tenantId,
        scenario_id: scenarioId,
        account_id: accountId,
        month,
        forecast_amount: parseFloat(value) || 0,
      });
      setLocalEdits((prev) => { const next = new Map(prev); next.delete(key); return next; });
    }
  };

  // Get effective value for a cell (actual for closed, forecast for open)
  const getEffectiveValue = (accountId: string, month: number): number => {
    const key = `${accountId}-${month}`;
    if (isClosed(month) && actualMap.has(key)) return actualMap.get(key)!;
    const local = localEdits.get(key);
    if (local !== undefined) return parseFloat(local) || 0;
    return forecastMap.get(key) || 0;
  };

  const getColumnTotals = (type: AccountType, month: number) => {
    let total = 0;
    let budgetTotal = 0;
    for (const acc of accounts.filter((a) => a.account_type === type)) {
      total += getEffectiveValue(acc.id, month);
      budgetTotal += budgetMap.get(`${acc.id}-${month}`) || 0;
    }
    return { forecast: total, budget: budgetTotal };
  };

  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);
  const grouped = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: accountTree.filter((a) => a.account_type === type),
  })).filter((g) => g.accounts.length > 0);

  // KPI calculations
  const kpis = useMemo(() => {
    let totalRevenue = 0, totalCOGS = 0, totalExpense = 0, totalOther = 0;
    let budgetRevenue = 0, budgetCOGS = 0, budgetExpense = 0, budgetOther = 0;
    for (let m = 1; m <= 12; m++) {
      const rev = getColumnTotals('Revenue', m);
      const cogs = getColumnTotals('COGS', m);
      const exp = getColumnTotals('Expense', m);
      const other = getColumnTotals('Other', m);
      totalRevenue += rev.forecast;
      totalCOGS += cogs.forecast;
      totalExpense += exp.forecast;
      totalOther += other.forecast;
      budgetRevenue += rev.budget;
      budgetCOGS += cogs.budget;
      budgetExpense += exp.budget;
      budgetOther += other.budget;
    }
    const grossProfit = totalRevenue - totalCOGS;
    const netIncome = grossProfit - totalExpense - totalOther;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const cogsPercent = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
    const expensePercent = totalRevenue > 0 ? (totalExpense / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const budgetNetIncome = budgetRevenue - budgetCOGS - budgetExpense - budgetOther;
    return {
      totalRevenue, grossProfit, netIncome, grossMargin, cogsPercent, expensePercent, netMargin,
      budgetRevenue, budgetNetIncome,
      revenueVariance: totalRevenue - budgetRevenue,
      netVariance: netIncome - budgetNetIncome,
    };
  }, [accounts, budgetMap, forecastMap, actualMap, localEdits]);

  // Actions
  const handleCreateScenario = async () => {
    if (!newScenarioName.trim() || !fyId) return;
    try {
      const s = await createScenario.mutateAsync({
        tenant_id: tenantId,
        fiscal_year_id: fyId,
        name: newScenarioName.trim(),
        is_default: scenarios.length === 0,
      });
      setSelectedScenarioId(s.id);
      setShowNewScenarioDialog(false);
      setNewScenarioName('');
      toast({ title: `Scenario "${s.name}" created` });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSeedFromBudget = async () => {
    if (!scenarioId) return;
    const items = budgetLineItems
      .filter((l: any) => Number(l.budget_amount) > 0)
      .map((l: any) => ({
        tenant_id: tenantId,
        scenario_id: scenarioId,
        account_id: l.account_id,
        month: l.month,
        forecast_amount: Number(l.budget_amount),
      }));
    if (items.length === 0) {
      toast({ title: 'No budget data to seed from', variant: 'destructive' });
      return;
    }
    try {
      await bulkUpsertForecast.mutateAsync(items);
      toast({ title: `Seeded ${items.length} entries from budget` });
    } catch (err: any) {
      toast({ title: 'Seed failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleApplyDrivers = async () => {
    if (!scenarioId) return;
    try {
      const result = await applyDrivers.mutateAsync({ scenarioId, tenantId });
      toast({ title: `Drivers applied — ${result.updated} entries updated` });
    } catch (err: any) {
      toast({ title: 'Failed to apply drivers', description: err.message, variant: 'destructive' });
    }
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Render account rows
  const renderAccountRows = (acc: ChartOfAccount, depth: number, isRevenue: boolean): React.ReactNode => {
    const hasChildren = acc.children && acc.children.length > 0;
    return (
      <Fragment key={acc.id}>
        <tr className="hover:bg-black/[0.02]">
          <td
            className="py-1 px-3 sticky left-0 z-10 text-sm"
            style={{
              backgroundColor: colors.white, color: colors.brown,
              paddingLeft: `${12 + depth * 20}px`,
              ...(hasChildren ? { fontWeight: 600 } : {}),
            }}
          >
            {acc.account_number && <span className="text-xs font-mono mr-1.5" style={{ color: colors.brownLight }}>{acc.account_number}</span>}
            {acc.name}
          </td>
          {MONTH_LABELS.map((_, i) => {
            const month = i + 1;
            const closed = isClosed(month);
            const budgetVal = budgetMap.get(`${acc.id}-${month}`) || 0;
            const effectiveVal = getEffectiveValue(acc.id, month);
            const variance = budgetVal > 0 ? budgetVal - effectiveVal : null;
            return (
              <Fragment key={i}>
                {/* Budget reference */}
                <td className="text-right py-1 px-1 text-xs" style={{ color: colors.brownLight, backgroundColor: colors.cream + '60' }}>
                  {budgetVal > 0 ? formatCurrency(budgetVal) : <span style={{ color: colors.creamDark }}>—</span>}
                </td>
                {/* Forecast/Actual */}
                <td className="py-0.5 px-0.5">
                  {closed ? (
                    <div className="text-right text-sm py-1 px-1 rounded" style={{ backgroundColor: colors.cream + '80', color: colors.brown }}>
                      {formatCurrency(effectiveVal)}
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      value={getCellValue(acc.id, month)}
                      onChange={(e) => handleCellChange(acc.id, month, e.target.value)}
                      onBlur={() => handleCellBlur(acc.id, month)}
                      onFocus={(e) => e.target.select()}
                      className="w-full text-right text-sm py-1 px-1 rounded border outline-none focus:ring-1"
                      style={{ backgroundColor: colors.inputBg, borderColor: 'transparent', color: colors.brown, minWidth: '70px' }}
                      onFocusCapture={(e) => { (e.target as HTMLInputElement).style.borderColor = colors.gold; }}
                      onBlurCapture={(e) => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; }}
                    />
                  )}
                </td>
                {/* Variance */}
                <td className="text-right py-1 px-1 text-xs">
                  {variance !== null ? (
                    <span style={{ color: (isRevenue ? variance <= 0 : variance >= 0) ? colors.green : colors.red }}>
                      {variance >= 0 ? '' : '('}{formatCurrency(Math.abs(variance))}{variance < 0 ? ')' : ''}
                    </span>
                  ) : <span style={{ color: colors.creamDark }}>—</span>}
                </td>
              </Fragment>
            );
          })}
        </tr>
        {hasChildren && acc.children!.map((child) => renderAccountRows(child, depth + 1, isRevenue))}
      </Fragment>
    );
  };

  const isLoading = loadingCoa || loadingFY;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.gold }} />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3" style={{ color: colors.creamDark }} />
        <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>Set up your Chart of Accounts first</h3>
      </div>
    );
  }

  if (!selectedFY) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
        <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
          Create a fiscal year on the Budget tab first
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Forecast Revenue', value: formatCurrency(kpis.totalRevenue), sub: `Budget: ${formatCurrency(kpis.budgetRevenue)}`, color: colors.brown },
          { label: 'Gross Margin', value: `${kpis.grossMargin.toFixed(1)}%`, sub: `GP: ${formatCurrency(kpis.grossProfit)}`, color: kpis.grossMargin >= 60 ? colors.green : colors.red },
          { label: 'Net Income', value: formatCurrency(kpis.netIncome), sub: `Budget: ${formatCurrency(kpis.budgetNetIncome)}`, color: kpis.netIncome >= 0 ? colors.green : colors.red },
          { label: 'Net Margin', value: `${kpis.netMargin.toFixed(1)}%`, sub: `COGS: ${kpis.cogsPercent.toFixed(1)}% | OpEx: ${kpis.expensePercent.toFixed(1)}%`, color: kpis.netMargin >= 10 ? colors.green : kpis.netMargin >= 0 ? colors.gold : colors.red },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-3" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
            <p className="text-xs font-medium" style={{ color: colors.brownLight }}>{kpi.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap" style={{ color: colors.brown }}>Year:</Label>
          <Select value={selectedFYId || fyId} onValueChange={setSelectedFYId}>
            <SelectTrigger className="w-[120px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((fy) => <SelectItem key={fy.id} value={fy.id}>{fy.year}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap" style={{ color: colors.brown }}>Scenario:</Label>
          <Select value={selectedScenarioId || scenarioId} onValueChange={setSelectedScenarioId}>
            <SelectTrigger className="w-[180px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowNewScenarioDialog(true)} style={{ borderColor: colors.gold, color: colors.brown }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {scenarioId && (
          <>
            <Button variant="outline" size="sm" onClick={handleSeedFromBudget} disabled={bulkUpsertForecast.isPending} style={{ borderColor: colors.gold, color: colors.brown }}>
              <Copy className="w-4 h-4 mr-1" /> Seed from Budget
            </Button>
            {drivers.length > 0 && (
              <Button size="sm" onClick={handleApplyDrivers} disabled={applyDrivers.isPending} style={{ backgroundColor: colors.gold, color: '#fff' }}>
                {applyDrivers.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Apply Drivers
              </Button>
            )}
          </>
        )}
      </div>

      {/* No scenario message */}
      {scenarios.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: colors.creamDark }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.brown }}>Create your first forecast scenario</h3>
          <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
            Scenarios let you model different outcomes — Base Case, Optimistic, Conservative.
          </p>
          <Button onClick={() => { setNewScenarioName('Base Case'); setShowNewScenarioDialog(true); }} style={{ backgroundColor: colors.gold, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-2" /> Create Base Case
          </Button>
        </div>
      ) : (
        <>
          {/* Forecast Grid */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm" style={{ minWidth: '1800px' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.gold }}>
                    <th className="text-left py-2 px-3 font-semibold text-white sticky left-0 z-10" style={{ backgroundColor: colors.gold, minWidth: '200px' }}>Account</th>
                    {MONTH_LABELS.map((m, i) => (
                      <th key={m} colSpan={3} className="text-center py-2 px-1 font-semibold text-white border-l border-white/20" style={{ ...(isClosed(i + 1) ? { opacity: 0.7 } : {}) }}>
                        {m} {isClosed(i + 1) ? '(closed)' : ''}
                      </th>
                    ))}
                  </tr>
                  <tr style={{ backgroundColor: colors.goldDark }}>
                    <th className="py-1 px-3 sticky left-0 z-10" style={{ backgroundColor: colors.goldDark }} />
                    {MONTH_LABELS.map((m) => (
                      <Fragment key={m}>
                        <th className="text-right py-1 px-1 text-xs text-white/70 font-normal">Budget</th>
                        <th className="text-right py-1 px-1 text-xs text-white/90 font-normal">Forecast</th>
                        <th className="text-right py-1 px-1 text-xs text-white/70 font-normal">Var</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ type, accounts: typeAccounts }) => (
                    <Fragment key={type}>
                      <tr>
                        <td colSpan={1 + 36} className="py-2 px-3 font-semibold text-xs uppercase tracking-wider sticky left-0 z-10" style={{ backgroundColor: colors.cream, color: colors.brownLight }}>
                          {type}
                        </td>
                      </tr>
                      {typeAccounts.map((acc) => renderAccountRows(acc, 0, acc.account_type === 'Revenue'))}
                      {/* Subtotal */}
                      <tr style={{ borderTop: `1px solid ${colors.creamDark}` }}>
                        <td className="py-1.5 px-3 text-sm font-semibold sticky left-0 z-10" style={{ backgroundColor: colors.white, color: colors.brownLight }}>
                          Total {type}
                        </td>
                        {MONTH_LABELS.map((_, i) => {
                          const t = getColumnTotals(type, i + 1);
                          const variance = t.budget - t.forecast;
                          const isRevenue = type === 'Revenue';
                          return (
                            <Fragment key={i}>
                              <td className="text-right py-1.5 px-1 text-xs font-semibold" style={{ color: colors.brownLight, backgroundColor: colors.cream + '60' }}>
                                {formatCurrency(t.budget)}
                              </td>
                              <td className="text-right py-1.5 px-1 text-sm font-semibold" style={{ color: colors.brown }}>
                                {formatCurrency(t.forecast)}
                              </td>
                              <td className="text-right py-1.5 px-1 text-xs font-semibold">
                                <span style={{ color: (isRevenue ? variance <= 0 : variance >= 0) ? colors.green : colors.red }}>
                                  {variance >= 0 ? '' : '('}{formatCurrency(Math.abs(variance))}{variance < 0 ? ')' : ''}
                                </span>
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    </Fragment>
                  ))}

                  {/* Net Income */}
                  <tr style={{ backgroundColor: colors.goldLight, fontWeight: 700 }}>
                    <td className="py-2 px-3 sticky left-0 z-10" style={{ backgroundColor: colors.goldLight, color: colors.brown }}>Net Income</td>
                    {MONTH_LABELS.map((_, i) => {
                      const m = i + 1;
                      const rev = getColumnTotals('Revenue', m);
                      const cogs = getColumnTotals('COGS', m);
                      const exp = getColumnTotals('Expense', m);
                      const other = getColumnTotals('Other', m);
                      const netForecast = rev.forecast - cogs.forecast - exp.forecast - other.forecast;
                      const netBudget = rev.budget - cogs.budget - exp.budget - other.budget;
                      const variance = netBudget - netForecast;
                      return (
                        <Fragment key={i}>
                          <td className="text-right py-2 px-1 text-xs" style={{ color: colors.brownLight, backgroundColor: colors.goldLight }}>
                            {formatCurrency(netBudget)}
                          </td>
                          <td className="text-right py-2 px-1" style={{ color: netForecast >= 0 ? colors.green : colors.red }}>
                            {formatCurrency(netForecast)}
                          </td>
                          <td className="text-right py-2 px-1 text-xs">
                            <span style={{ color: variance <= 0 ? colors.green : colors.red }}>
                              {variance >= 0 ? '' : '('}{formatCurrency(Math.abs(variance))}{variance < 0 ? ')' : ''}
                            </span>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs" style={{ color: colors.brownLight }}>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" style={{ color: colors.green }} /> Favorable
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3" style={{ color: colors.red }} /> Unfavorable
            </span>
            <span>Closed months show actuals (locked). Future months are editable forecasts.</span>
          </div>

          {/* Drivers Panel */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
            <button
              onClick={() => setShowDrivers(!showDrivers)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
              style={{ color: colors.brown }}
            >
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4" style={{ color: colors.gold }} />
                Forecast Drivers ({drivers.length})
              </span>
              {showDrivers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDrivers && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs" style={{ color: colors.brownLight }}>
                  Drivers auto-calculate account values. E.g., "COGS = 35% of Revenue" or "Rent = $2,500 fixed monthly."
                </p>
                {drivers.map((d) => (
                  <DriverRow key={d.id} driver={d} accounts={accounts} onDelete={() => deleteDriver.mutate({ id: d.id, scenario_id: scenarioId })} />
                ))}
                <AddDriverForm
                  accounts={accounts}
                  onAdd={async (driver) => {
                    await createDriver.mutateAsync({ ...driver, tenant_id: tenantId, scenario_id: scenarioId });
                    toast({ title: 'Driver added' });
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* New Scenario Dialog */}
      <Dialog open={showNewScenarioDialog} onOpenChange={setShowNewScenarioDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Forecast Scenario</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Scenario Name</Label>
              <Input
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="e.g., Base Case, Optimistic, Conservative"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <Button onClick={handleCreateScenario} disabled={createScenario.isPending} style={{ backgroundColor: colors.gold, color: '#fff' }}>
              {createScenario.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Scenario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DriverRow({ driver, accounts, onDelete }: { driver: ForecastDriver; accounts: ChartOfAccount[]; onDelete: () => void }) {
  const target = accounts.find(a => a.id === driver.target_account_id);
  const source = driver.source_account_id ? accounts.find(a => a.id === driver.source_account_id) : null;
  const typeLabel: Record<DriverType, string> = {
    percentage_of_account: `${(driver.driver_value * 100).toFixed(1)}% of ${source?.name || '?'}`,
    fixed_amount: `$${driver.driver_value.toFixed(2)} / month`,
    growth_rate: `${(driver.driver_value * 100).toFixed(1)}% growth MoM`,
    per_unit: `$${driver.driver_value.toFixed(2)} / unit`,
  };
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: colors.brown }}>{target?.name || 'Unknown'}</p>
        <p className="text-xs" style={{ color: colors.brownLight }}>{typeLabel[driver.driver_type]}</p>
      </div>
      <button onClick={onDelete} className="p-1 rounded hover:bg-black/5"><Trash2 className="w-4 h-4" style={{ color: colors.red }} /></button>
    </div>
  );
}

function AddDriverForm({ accounts, onAdd }: {
  accounts: ChartOfAccount[];
  onAdd: (driver: { target_account_id: string; driver_type: string; source_account_id?: string; driver_value: number }) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState('');
  const [driverType, setDriverType] = useState<DriverType>('fixed_amount');
  const [sourceId, setSourceId] = useState('');
  const [value, setValue] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!targetId || !value) return;
    setAdding(true);
    try {
      const numVal = driverType === 'percentage_of_account' || driverType === 'growth_rate'
        ? parseFloat(value) / 100
        : parseFloat(value);
      await onAdd({
        target_account_id: targetId,
        driver_type: driverType,
        ...(driverType === 'percentage_of_account' ? { source_account_id: sourceId } : {}),
        driver_value: numVal,
      });
      setTargetId('');
      setValue('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 pt-2" style={{ borderTop: `1px solid ${colors.creamDark}` }}>
      <div className="flex-1" style={{ minWidth: '140px' }}>
        <Label className="text-xs">Target Account</Label>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger className="h-8 text-xs" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
            <SelectValue placeholder="Account..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.filter(a => !a.parent_id).map(a => (
              <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div style={{ minWidth: '140px' }}>
        <Label className="text-xs">Driver Type</Label>
        <Select value={driverType} onValueChange={(v) => setDriverType(v as DriverType)}>
          <SelectTrigger className="h-8 text-xs" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed_amount" className="text-xs">Fixed $ / month</SelectItem>
            <SelectItem value="percentage_of_account" className="text-xs">% of account</SelectItem>
            <SelectItem value="growth_rate" className="text-xs">% growth MoM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {driverType === 'percentage_of_account' && (
        <div style={{ minWidth: '140px' }}>
          <Label className="text-xs">Source Account</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="h-8 text-xs" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
              <SelectValue placeholder="Source..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.filter(a => !a.parent_id).map(a => (
                <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div style={{ minWidth: '80px' }}>
        <Label className="text-xs">{driverType === 'fixed_amount' ? 'Amount' : 'Percentage'}</Label>
        <Input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          value={value}
          onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setValue(e.target.value); }}
          onFocus={(e) => e.target.select()}
          placeholder={driverType === 'fixed_amount' ? '2500' : '35'}
          className="h-8 text-xs"
          style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
        />
      </div>
      <Button size="sm" onClick={handleAdd} disabled={adding || !targetId || !value} style={{ backgroundColor: colors.gold, color: '#fff' }}>
        <Plus className="w-3 h-3 mr-1" /> Add
      </Button>
    </div>
  );
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
