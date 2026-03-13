import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  useCreateFiscalYear,
  useBudgetLineItems,
  useUpsertBudgetLineItem,
  useBulkUpsertBudgetLineItems,
  useQboStatus,
  useQboSyncActuals,
} from '@/hooks/use-budget';
import { buildAccountTree, ACCOUNT_TYPE_ORDER, MONTH_LABELS } from './types';
import type { ChartOfAccount, AccountType } from './types';
import {
  Plus, Loader2, Copy, RefreshCw, CloudOff, FileSpreadsheet, Download,
  TrendingUp, TrendingDown, Sparkles,
} from 'lucide-react';

interface Props {
  tenantId: string;
  coaTenantId: string;
}

export default function UnifiedBudgetTab({ tenantId, coaTenantId }: Props) {
  const { toast } = useToast();
  const { data: accounts = [], isLoading: loadingCoa } = useChartOfAccounts(coaTenantId);
  const { data: fiscalYears = [], isLoading: loadingFY } = useFiscalYears(tenantId);
  const createFiscalYear = useCreateFiscalYear();
  const upsertLine = useUpsertBudgetLineItem();
  const bulkUpsert = useBulkUpsertBudgetLineItems();
  const { data: qboStatus } = useQboStatus(tenantId);
  const syncActuals = useQboSyncActuals();

  const [selectedFYId, setSelectedFYId] = useState<string>('');
  const [showNewFYDialog, setShowNewFYDialog] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());

  const selectedFY = fiscalYears.find((fy) => fy.id === selectedFYId) || fiscalYears[0];
  const fyId = selectedFY?.id || '';

  // Current year data
  const { data: lineItems = [] } = useBudgetLineItems(fyId, tenantId);

  // Prior year data
  const prevFY = fiscalYears.find((fy) => fy.year === (selectedFY?.year || 0) - 1);
  const { data: prevLineItems = [] } = useBudgetLineItems(prevFY?.id || '', tenantId);

  // Build lookup maps
  const { budgetMap, actualMap, pyActualMap } = useMemo(() => {
    const budget = new Map<string, number>();
    const actual = new Map<string, number>();
    for (const item of lineItems) {
      const key = `${item.account_id}-${item.month}`;
      budget.set(key, Number(item.budget_amount) || 0);
      if (item.actual_amount !== null && item.actual_amount !== undefined) {
        actual.set(key, Number(item.actual_amount));
      }
    }
    const pyActual = new Map<string, number>();
    for (const item of prevLineItems) {
      const key = `${item.account_id}-${item.month}`;
      if (item.actual_amount !== null && item.actual_amount !== undefined) {
        pyActual.set(key, Number(item.actual_amount));
      }
    }
    return { budgetMap: budget, actualMap: actual, pyActualMap: pyActual };
  }, [lineItems, prevLineItems]);

  // Local cell edits (optimistic — saved on blur)
  const [localEdits, setLocalEdits] = useState<Map<string, string>>(new Map());
  const saveTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const getCellValue = (accountId: string, month: number): string => {
    const key = `${accountId}-${month}`;
    if (localEdits.has(key)) return localEdits.get(key)!;
    const val = budgetMap.get(key);
    return val !== undefined && val !== 0 ? val.toString() : '';
  };

  const handleCellChange = (accountId: string, month: number, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    const key = `${accountId}-${month}`;
    setLocalEdits((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
    const existing = saveTimeoutRef.current.get(key);
    if (existing) clearTimeout(existing);
    saveTimeoutRef.current.set(
      key,
      setTimeout(() => {
        const amount = parseFloat(value) || 0;
        upsertLine.mutate({
          tenant_id: tenantId,
          fiscal_year_id: fyId,
          account_id: accountId,
          month,
          budget_amount: amount,
        });
        setLocalEdits((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        saveTimeoutRef.current.delete(key);
      }, 800)
    );
  };

  const handleCellBlur = (accountId: string, month: number) => {
    const key = `${accountId}-${month}`;
    const existing = saveTimeoutRef.current.get(key);
    if (existing) {
      clearTimeout(existing);
      saveTimeoutRef.current.delete(key);
    }
    const value = localEdits.get(key);
    if (value !== undefined) {
      const amount = parseFloat(value) || 0;
      upsertLine.mutate({
        tenant_id: tenantId,
        fiscal_year_id: fyId,
        account_id: accountId,
        month,
        budget_amount: amount,
      });
      setLocalEdits((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Get budget value for totals (respecting local edits)
  const getBudgetValue = (accountId: string, month: number): number => {
    const key = `${accountId}-${month}`;
    const local = localEdits.get(key);
    if (local !== undefined) return parseFloat(local) || 0;
    return budgetMap.get(key) || 0;
  };

  const getColumnTotals = (type: AccountType, month: number) => {
    let budgetTotal = 0;
    let actualTotal = 0;
    let pyTotal = 0;
    let hasActual = false;
    let hasPY = false;
    for (const acc of accounts.filter((a) => a.account_type === type)) {
      const key = `${acc.id}-${month}`;
      budgetTotal += getBudgetValue(acc.id, month);
      if (actualMap.has(key)) {
        actualTotal += actualMap.get(key)!;
        hasActual = true;
      }
      if (pyActualMap.has(key)) {
        pyTotal += pyActualMap.get(key)!;
        hasPY = true;
      }
    }
    return { budget: budgetTotal, actual: hasActual ? actualTotal : null, pyActual: hasPY ? pyTotal : null };
  };

  const getTypeAnnualTotal = (type: AccountType) => {
    let total = 0;
    for (let m = 1; m <= 12; m++) total += getColumnTotals(type, m).budget;
    return total;
  };

  // Build tree and group
  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);
  const grouped = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: accountTree.filter((a) => a.account_type === type),
  })).filter((g) => g.accounts.length > 0);

  const hasActuals = actualMap.size > 0;
  const hasPY = pyActualMap.size > 0;

  // Actions
  const handleCreateFY = async () => {
    const year = parseInt(newYear);
    if (isNaN(year) || year < 2000 || year > 2100) {
      toast({ title: 'Enter a valid year', variant: 'destructive' });
      return;
    }
    try {
      const fy = await createFiscalYear.mutateAsync({ tenant_id: tenantId, year });
      setSelectedFYId(fy.id);
      setShowNewFYDialog(false);
      toast({ title: `${year} budget created` });
    } catch (err: any) {
      toast({ title: 'Failed to create', description: err.message, variant: 'destructive' });
    }
  };

  const handleSeedFromPY = async () => {
    if (!selectedFY || !prevFY) return;
    if (prevLineItems.length === 0) {
      toast({ title: `No ${prevFY.year} actuals to seed from`, variant: 'destructive' });
      return;
    }
    try {
      const items = prevLineItems
        .filter((l: any) => l.actual_amount !== null && l.actual_amount !== undefined)
        .map((line: any) => ({
          tenant_id: tenantId,
          fiscal_year_id: fyId,
          account_id: line.account_id,
          month: line.month,
          budget_amount: Number(line.actual_amount),
        }));
      await bulkUpsert.mutateAsync(items);
      toast({ title: `Seeded ${items.length} entries from ${prevFY.year} actuals` });
    } catch (err: any) {
      toast({ title: 'Seed failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleCopyPreviousYear = async () => {
    if (!selectedFY) return;
    const prevBudgetFY = fiscalYears.find((fy) => fy.year === selectedFY.year - 1);
    if (!prevBudgetFY) {
      toast({ title: `No ${selectedFY.year - 1} budget found`, variant: 'destructive' });
      return;
    }
    try {
      const { data: prevLines, error } = await (await import('@/lib/supabase-queries')).supabase
        .from('budget_line_items')
        .select('account_id, month, budget_amount')
        .eq('fiscal_year_id', prevBudgetFY.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      if (!prevLines || prevLines.length === 0) {
        toast({ title: `${prevBudgetFY.year} budget has no data`, variant: 'destructive' });
        return;
      }
      const items = prevLines.map((line: any) => ({
        tenant_id: tenantId,
        fiscal_year_id: fyId,
        account_id: line.account_id,
        month: line.month,
        budget_amount: Number(line.budget_amount),
      }));
      await bulkUpsert.mutateAsync(items);
      toast({ title: `Copied ${items.length} entries from ${prevBudgetFY.year}` });
    } catch (err: any) {
      toast({ title: 'Copy failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSync = async () => {
    if (!selectedFY) return;
    try {
      const result = await syncActuals.mutateAsync({
        tenantId,
        fiscalYearId: fyId,
        year: selectedFY.year,
      });
      if (result.errors.length > 0) {
        toast({
          title: `Synced ${result.synced} entries — ${result.errors.length} unmatched`,
          description: result.errors.slice(0, 5).join('\n') + (result.errors.length > 5 ? `\n…and ${result.errors.length - 5} more` : ''),
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Actuals synced', description: `${result.synced} entries updated` });
      }
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const VarianceCell = ({ budget, actual, isRevenue }: { budget: number; actual: number | null; isRevenue?: boolean }) => {
    if (actual === null) return <span style={{ color: colors.creamDark }}>—</span>;
    const variance = budget - actual;
    const favorable = isRevenue ? variance <= 0 : variance >= 0;
    return (
      <span style={{ color: favorable ? colors.green : colors.red, fontSize: '0.75rem' }}>
        {variance >= 0 ? '' : '('}{formatCurrency(Math.abs(variance))}{variance < 0 ? ')' : ''}
      </span>
    );
  };

  // Render account rows recursively
  const renderAccountRows = (acc: ChartOfAccount, depth: number, isRevenue: boolean, isLocked: boolean): React.ReactNode => {
    const hasChildren = acc.children && acc.children.length > 0;
    return (
      <Fragment key={acc.id}>
        <tr className="hover:bg-black/[0.02]">
          {/* Account name */}
          <td
            className="py-1 px-3 sticky left-0 z-10 text-sm"
            style={{
              backgroundColor: colors.white,
              color: colors.brown,
              paddingLeft: `${12 + depth * 20}px`,
              ...(hasChildren ? { fontWeight: 600 } : {}),
            }}
          >
            {acc.account_number && (
              <span className="text-xs font-mono mr-1.5" style={{ color: colors.brownLight }}>{acc.account_number}</span>
            )}
            {acc.name}
          </td>
          {/* Month columns: PY Act | Budget | CY Act | Variance */}
          {MONTH_LABELS.map((_, i) => {
            const month = i + 1;
            const key = `${acc.id}-${month}`;
            const pyVal = pyActualMap.get(key);
            const cyVal = actualMap.has(key) ? actualMap.get(key)! : null;
            const budgetVal = getBudgetValue(acc.id, month);
            return (
              <Fragment key={i}>
                {/* PY Actual */}
                {hasPY && (
                  <td className="text-right py-1 px-1 text-xs" style={{ color: colors.brownLight, backgroundColor: colors.cream + '80' }}>
                    {pyVal !== undefined ? formatCurrency(pyVal) : <span style={{ color: colors.creamDark }}>—</span>}
                  </td>
                )}
                {/* Budget (editable) */}
                <td className="py-0.5 px-0.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={getCellValue(acc.id, month)}
                    onChange={(e) => handleCellChange(acc.id, month, e.target.value)}
                    onBlur={() => handleCellBlur(acc.id, month)}
                    onFocus={(e) => e.target.select()}
                    disabled={isLocked}
                    className="w-full text-right text-sm py-1 px-1 rounded border outline-none focus:ring-1"
                    style={{
                      backgroundColor: isLocked ? colors.cream : colors.inputBg,
                      borderColor: 'transparent',
                      color: colors.brown,
                      minWidth: '70px',
                    }}
                    onFocusCapture={(e) => { (e.target as HTMLInputElement).style.borderColor = colors.gold; }}
                    onBlurCapture={(e) => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; }}
                  />
                </td>
                {/* CY Actual */}
                {hasActuals && (
                  <td className="text-right py-1 px-1 text-sm" style={{ color: colors.brown }}>
                    {cyVal !== null ? formatCurrency(cyVal) : <span style={{ color: colors.creamDark }}>—</span>}
                  </td>
                )}
                {/* Variance */}
                {hasActuals && (
                  <td className="text-right py-1 px-1">
                    <VarianceCell budget={budgetVal} actual={cyVal} isRevenue={isRevenue} />
                  </td>
                )}
              </Fragment>
            );
          })}
        </tr>
        {hasChildren && acc.children!.map((child) => renderAccountRows(child, depth + 1, isRevenue, isLocked))}
      </Fragment>
    );
  };

  const isLoading = loadingCoa || loadingFY;
  const isLocked = selectedFY?.status === 'locked';
  const subColCount = 1 + (hasPY ? 1 : 0) + (hasActuals ? 2 : 0); // budget + optional PY + optional (CY + variance)

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
        <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
          Set up your Chart of Accounts first
        </h3>
        <p className="text-sm" style={{ color: colors.brownLight }}>
          Import or add accounts on the Chart of Accounts tab before entering budget data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap" style={{ color: colors.brown }}>
            Fiscal Year:
          </Label>
          <Select value={selectedFYId || selectedFY?.id || ''} onValueChange={setSelectedFYId}>
            <SelectTrigger className="w-[140px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>
                  {fy.year} {fy.status !== 'draft' ? `(${fy.status})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={() => setShowNewFYDialog(true)} style={{ borderColor: colors.gold, color: colors.brown }}>
          <Plus className="w-4 h-4 mr-1" /> New Year
        </Button>

        {selectedFY && prevFY && (
          <>
            <Button variant="outline" onClick={handleCopyPreviousYear} disabled={bulkUpsert.isPending} style={{ borderColor: colors.gold, color: colors.brown }}>
              <Copy className="w-4 h-4 mr-1" /> Copy {selectedFY.year - 1} Budget
            </Button>
            <Button variant="outline" onClick={handleSeedFromPY} disabled={bulkUpsert.isPending} style={{ borderColor: colors.gold, color: colors.brown }}>
              <Sparkles className="w-4 h-4 mr-1" /> Seed from {selectedFY.year - 1} Actuals
            </Button>
          </>
        )}

        {selectedFY && qboStatus?.connected && (
          <Button
            onClick={handleSync}
            disabled={syncActuals.isPending}
            style={{ backgroundColor: colors.gold, color: '#fff' }}
          >
            {syncActuals.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync from QBO
          </Button>
        )}
        {selectedFY && !qboStatus?.connected && (
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.brownLight }}>
            <CloudOff className="w-4 h-4" /> Connect QBO on Chart of Accounts tab
          </div>
        )}

        {selectedFY && (
          <span className="text-xs ml-auto px-2 py-1 rounded" style={{
            backgroundColor: selectedFY.status === 'approved' ? colors.green + '20' : selectedFY.status === 'locked' ? colors.red + '20' : colors.cream,
            color: selectedFY.status === 'approved' ? colors.green : selectedFY.status === 'locked' ? colors.red : colors.brownLight,
          }}>
            {selectedFY.status.charAt(0).toUpperCase() + selectedFY.status.slice(1)}
          </span>
        )}
      </div>

      {qboStatus?.lastSyncAt && (
        <p className="text-xs" style={{ color: colors.brownLight }}>
          Last QBO sync: {new Date(qboStatus.lastSyncAt).toLocaleString()}
        </p>
      )}

      {!selectedFY ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
          <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
            Create a fiscal year to get started
          </h3>
          <Button onClick={() => setShowNewFYDialog(true)} className="mt-3" style={{ backgroundColor: colors.gold, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-2" /> Create {new Date().getFullYear()} Budget
          </Button>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: `${300 + 12 * subColCount * 80}px` }}>
              <thead>
                {/* Month headers */}
                <tr style={{ backgroundColor: colors.gold }}>
                  <th className="text-left py-2 px-3 font-semibold text-white sticky left-0 z-10" style={{ backgroundColor: colors.gold, minWidth: '200px' }}>
                    Account
                  </th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} colSpan={subColCount} className="text-center py-2 px-1 font-semibold text-white border-l border-white/20">
                      {m}
                    </th>
                  ))}
                </tr>
                {/* Sub-column headers */}
                <tr style={{ backgroundColor: colors.goldDark }}>
                  <th className="py-1 px-3 sticky left-0 z-10" style={{ backgroundColor: colors.goldDark }} />
                  {MONTH_LABELS.map((m) => (
                    <Fragment key={m}>
                      {hasPY && <th className="text-right py-1 px-1 text-xs text-white/70 font-normal">PY Act</th>}
                      <th className="text-right py-1 px-1 text-xs text-white/90 font-normal">Budget</th>
                      {hasActuals && <th className="text-right py-1 px-1 text-xs text-white/70 font-normal">Actual</th>}
                      {hasActuals && <th className="text-right py-1 px-1 text-xs text-white/70 font-normal">Var</th>}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ type, accounts: typeAccounts }) => (
                  <Fragment key={type}>
                    <tr>
                      <td colSpan={1 + 12 * subColCount} className="py-2 px-3 font-semibold text-xs uppercase tracking-wider sticky left-0 z-10" style={{ backgroundColor: colors.cream, color: colors.brownLight }}>
                        {type}
                      </td>
                    </tr>
                    {typeAccounts.map((acc) => renderAccountRows(acc, 0, acc.account_type === 'Revenue', isLocked))}
                    {/* Subtotal */}
                    <tr style={{ borderTop: `1px solid ${colors.creamDark}` }}>
                      <td className="py-1.5 px-3 text-sm font-semibold sticky left-0 z-10" style={{ backgroundColor: colors.white, color: colors.brownLight }}>
                        Total {type}
                      </td>
                      {MONTH_LABELS.map((_, i) => {
                        const t = getColumnTotals(type, i + 1);
                        const isRevenue = type === 'Revenue';
                        return (
                          <Fragment key={i}>
                            {hasPY && (
                              <td className="text-right py-1.5 px-1 text-xs font-semibold" style={{ color: colors.brownLight, backgroundColor: colors.cream + '80' }}>
                                {t.pyActual !== null ? formatCurrency(t.pyActual) : ''}
                              </td>
                            )}
                            <td className="text-right py-1.5 px-1 text-sm font-semibold" style={{ color: colors.brown }}>
                              {formatCurrency(t.budget)}
                            </td>
                            {hasActuals && (
                              <td className="text-right py-1.5 px-1 text-sm font-semibold" style={{ color: colors.brown }}>
                                {t.actual !== null ? formatCurrency(t.actual) : <span style={{ color: colors.creamDark }}>—</span>}
                              </td>
                            )}
                            {hasActuals && (
                              <td className="text-right py-1.5 px-1 text-sm font-semibold">
                                <VarianceCell budget={t.budget} actual={t.actual} isRevenue={isRevenue} />
                              </td>
                            )}
                          </Fragment>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}

                {/* Gross Profit */}
                {accounts.some((a) => a.account_type === 'Revenue') && accounts.some((a) => a.account_type === 'COGS') && (
                  <tr style={{ backgroundColor: colors.cream, fontWeight: 600 }}>
                    <td className="py-2 px-3 sticky left-0 z-10" style={{ backgroundColor: colors.cream, color: colors.brown }}>
                      Gross Profit
                    </td>
                    {MONTH_LABELS.map((_, i) => {
                      const m = i + 1;
                      const revT = getColumnTotals('Revenue', m);
                      const cogsT = getColumnTotals('COGS', m);
                      const gpBudget = revT.budget - cogsT.budget;
                      const gpActual = revT.actual !== null && cogsT.actual !== null ? revT.actual - cogsT.actual : null;
                      const gpPY = revT.pyActual !== null && cogsT.pyActual !== null ? revT.pyActual - cogsT.pyActual : null;
                      return (
                        <Fragment key={i}>
                          {hasPY && (
                            <td className="text-right py-2 px-1 text-xs" style={{ color: colors.brownLight, backgroundColor: colors.cream }}>
                              {gpPY !== null ? formatCurrency(gpPY) : ''}
                            </td>
                          )}
                          <td className="text-right py-2 px-1" style={{ color: gpBudget >= 0 ? colors.green : colors.red }}>
                            {formatCurrency(gpBudget)}
                          </td>
                          {hasActuals && (
                            <td className="text-right py-2 px-1" style={{ color: gpActual !== null ? (gpActual >= 0 ? colors.green : colors.red) : colors.creamDark }}>
                              {gpActual !== null ? formatCurrency(gpActual) : '—'}
                            </td>
                          )}
                          {hasActuals && (
                            <td className="text-right py-2 px-1">
                              <VarianceCell budget={gpBudget} actual={gpActual} isRevenue />
                            </td>
                          )}
                        </Fragment>
                      );
                    })}
                  </tr>
                )}

                {/* Net Income */}
                <tr style={{ backgroundColor: colors.goldLight, fontWeight: 700 }}>
                  <td className="py-2 px-3 sticky left-0 z-10" style={{ backgroundColor: colors.goldLight, color: colors.brown }}>
                    Net Income
                  </td>
                  {MONTH_LABELS.map((_, i) => {
                    const m = i + 1;
                    const rev = getColumnTotals('Revenue', m);
                    const cogs = getColumnTotals('COGS', m);
                    const exp = getColumnTotals('Expense', m);
                    const other = getColumnTotals('Other', m);
                    const netBudget = rev.budget - cogs.budget - exp.budget - other.budget;
                    const netActual = [rev.actual, cogs.actual, exp.actual, other.actual].every(v => v !== null)
                      ? (rev.actual! - cogs.actual! - exp.actual! - other.actual!)
                      : null;
                    const netPY = [rev.pyActual, cogs.pyActual, exp.pyActual, other.pyActual].every(v => v !== null)
                      ? (rev.pyActual! - cogs.pyActual! - exp.pyActual! - other.pyActual!)
                      : null;
                    return (
                      <Fragment key={i}>
                        {hasPY && (
                          <td className="text-right py-2 px-1 text-xs" style={{ color: colors.brownLight, backgroundColor: colors.goldLight }}>
                            {netPY !== null ? formatCurrency(netPY) : ''}
                          </td>
                        )}
                        <td className="text-right py-2 px-1" style={{ color: netBudget >= 0 ? colors.green : colors.red }}>
                          {formatCurrency(netBudget)}
                        </td>
                        {hasActuals && (
                          <td className="text-right py-2 px-1" style={{ color: netActual !== null ? (netActual >= 0 ? colors.green : colors.red) : colors.creamDark }}>
                            {netActual !== null ? formatCurrency(netActual) : '—'}
                          </td>
                        )}
                        {hasActuals && (
                          <td className="text-right py-2 px-1">
                            <VarianceCell budget={netBudget} actual={netActual} isRevenue />
                          </td>
                        )}
                      </Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      {hasActuals && (
        <div className="flex items-center gap-4 text-xs" style={{ color: colors.brownLight }}>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" style={{ color: colors.green }} /> Favorable (under budget)
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3" style={{ color: colors.red }} /> Unfavorable (over budget)
          </span>
          {hasPY && <span>PY Act = Prior Year Actual</span>}
        </div>
      )}

      {/* New Fiscal Year Dialog */}
      <Dialog open={showNewFYDialog} onOpenChange={setShowNewFYDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Budget Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Year</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newYear}
                onChange={(e) => { if (e.target.value === '' || /^\d*$/.test(e.target.value)) setNewYear(e.target.value); }}
                onFocus={(e) => e.target.select()}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <Button onClick={handleCreateFY} disabled={createFiscalYear.isPending} style={{ backgroundColor: colors.gold, color: '#fff' }}>
              {createFiscalYear.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Budget
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
