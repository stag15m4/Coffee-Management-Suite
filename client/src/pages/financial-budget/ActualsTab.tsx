import React, { useState, useMemo } from 'react';
import { colors } from '@/lib/colors';
import { Button } from '@/components/ui/button';
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
  useChartOfAccounts,
  useFiscalYears,
  useBudgetLineItems,
  useQboStatus,
  useQboSyncActuals,
} from '@/hooks/use-budget';
import { buildAccountTree, ACCOUNT_TYPE_ORDER, MONTH_LABELS } from './types';
import type { AccountType, ChartOfAccount } from './types';
import { Loader2, RefreshCw, CloudOff, FileSpreadsheet, TrendingUp, TrendingDown, Download } from 'lucide-react';
import { exportActualsPdf } from './budget-export';

interface Props {
  tenantId: string;
  coaTenantId: string;
}

export default function ActualsTab({ tenantId, coaTenantId }: Props) {
  const { toast } = useToast();
  const { data: accounts = [], isLoading: loadingCoa } = useChartOfAccounts(coaTenantId);
  const { data: fiscalYears = [], isLoading: loadingFY } = useFiscalYears(tenantId);
  const { data: qboStatus } = useQboStatus(tenantId);
  const syncActuals = useQboSyncActuals();

  const [selectedFYId, setSelectedFYId] = useState<string>('');
  const selectedFY = fiscalYears.find((fy) => fy.id === selectedFYId) || fiscalYears[0];
  const fyId = selectedFY?.id || '';

  const { data: lineItems = [], isLoading: loadingLines } = useBudgetLineItems(fyId, tenantId);

  // Build lookup maps
  const cellMap = useMemo(() => {
    const budget = new Map<string, number>();
    const actual = new Map<string, number>();
    for (const item of lineItems) {
      const key = `${item.account_id}-${item.month}`;
      budget.set(key, Number(item.budget_amount) || 0);
      if (item.actual_amount !== null && item.actual_amount !== undefined) {
        actual.set(key, Number(item.actual_amount));
      }
    }
    return { budget, actual };
  }, [lineItems]);

  const hasActuals = cellMap.actual.size > 0;

  const getVariance = (accountId: string, month: number): { budget: number; actual: number | null; variance: number | null } => {
    const key = `${accountId}-${month}`;
    const b = cellMap.budget.get(key) || 0;
    const a = cellMap.actual.has(key) ? cellMap.actual.get(key)! : null;
    return {
      budget: b,
      actual: a,
      variance: a !== null ? b - a : null,
    };
  };

  const getColumnTotals = (type: AccountType, month: number): { budget: number; actual: number; variance: number | null } => {
    let budgetTotal = 0;
    let actualTotal = 0;
    let hasAny = false;
    for (const acc of accounts.filter((a) => a.account_type === type)) {
      const key = `${acc.id}-${month}`;
      budgetTotal += cellMap.budget.get(key) || 0;
      if (cellMap.actual.has(key)) {
        actualTotal += cellMap.actual.get(key)!;
        hasAny = true;
      }
    }
    return {
      budget: budgetTotal,
      actual: actualTotal,
      variance: hasAny ? budgetTotal - actualTotal : null,
    };
  };

  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);

  const grouped = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: accountTree.filter((a) => a.account_type === type),
  })).filter((g) => g.accounts.length > 0);

  const handleSync = async () => {
    if (!selectedFY) return;
    try {
      const result = await syncActuals.mutateAsync({
        tenantId,
        fiscalYearId: fyId,
        year: selectedFY.year,
      });
      if (result.errors.length > 0) {
        console.warn('[QBO Sync] Unmatched accounts:', result.errors);
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

  const VarianceCell = ({ variance, isRevenue }: { variance: number | null; isRevenue?: boolean }) => {
    if (variance === null) return <span style={{ color: colors.creamDark }}>—</span>;
    // For revenue: positive variance = under budget (bad), negative = over budget (good)
    // For expenses: positive variance = under budget (good), negative = over budget (bad)
    const favorable = isRevenue ? variance <= 0 : variance >= 0;
    return (
      <span style={{ color: favorable ? colors.green : colors.red }}>
        {variance >= 0 ? '' : '('}{formatCurrency(Math.abs(variance))}{variance < 0 ? ')' : ''}
      </span>
    );
  };

  const renderAccountRows = (acc: ChartOfAccount, depth: number, isRevenue: boolean): React.ReactNode => {
    const hasChildren = acc.children && acc.children.length > 0;
    return (
      <Fragment key={acc.id}>
        <tr className="hover:bg-black/[0.02]">
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
              <span className="text-xs mr-1.5" style={{ color: colors.brownLight }}>{acc.account_number}</span>
            )}
            {acc.name}
          </td>
          {MONTH_LABELS.map((_, i) => {
            const v = getVariance(acc.id, i + 1);
            return (
              <Fragment key={i}>
                <td className="text-right py-1 px-1 text-sm" style={{ color: colors.brown }}>
                  {v.budget ? formatCurrency(v.budget) : ''}
                </td>
                <td className="text-right py-1 px-1 text-sm" style={{ color: colors.brown }}>
                  {v.actual !== null ? formatCurrency(v.actual) : <span style={{ color: colors.creamDark }}>—</span>}
                </td>
                <td className="text-right py-1 px-1 text-sm">
                  <VarianceCell variance={v.variance} isRevenue={isRevenue} />
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
        <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
          Set up your Chart of Accounts first
        </h3>
        <p className="text-sm" style={{ color: colors.brownLight }}>
          Import or add accounts on the Chart of Accounts tab before viewing actuals.
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
                <SelectItem key={fy.id} value={fy.id}>{fy.year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {qboStatus?.connected ? (
          <Button
            onClick={handleSync}
            disabled={syncActuals.isPending || !selectedFY}
            style={{ backgroundColor: colors.gold, color: '#fff' }}
          >
            {syncActuals.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync from QBO
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.brownLight }}>
            <CloudOff className="w-4 h-4" />
            Connect QuickBooks on the Chart of Accounts tab to sync actuals
          </div>
        )}

        {selectedFY && accounts.length > 0 && (
          <Button
            variant="outline"
            onClick={() => exportActualsPdf({
              title: `${selectedFY.year} Budget vs Actual`,
              year: selectedFY.year,
              accounts,
              budgetMap: cellMap.budget,
              actualMap: cellMap.actual,
            })}
            style={{ borderColor: colors.gold, color: colors.brown }}
          >
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
        )}

        {qboStatus?.lastSyncAt && (
          <span className="text-xs ml-auto" style={{ color: colors.brownLight }}>
            Last sync: {new Date(qboStatus.lastSyncAt).toLocaleString()}
          </span>
        )}
      </div>

      {!selectedFY ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
          <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
            Create a fiscal year on the Budget Entry tab first
          </h3>
        </div>
      ) : (
        /* Budget vs Actual Grid */
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
              <thead>
                <tr style={{ backgroundColor: colors.gold }}>
                  <th className="text-left py-2 px-3 font-semibold text-white sticky left-0 z-10" style={{ backgroundColor: colors.gold, minWidth: '180px' }}>
                    Account
                  </th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} colSpan={3} className="text-center py-2 px-1 font-semibold text-white border-l border-white/20" style={{ minWidth: '240px' }}>
                      {m}
                    </th>
                  ))}
                </tr>
                <tr style={{ backgroundColor: colors.goldDark }}>
                  <th className="py-1 px-3 sticky left-0 z-10" style={{ backgroundColor: colors.goldDark }} />
                  {MONTH_LABELS.map((m) => (
                    <Fragment key={m}>
                      <th className="text-right py-1 px-1 text-xs text-white/80 font-normal">Budget</th>
                      <th className="text-right py-1 px-1 text-xs text-white/80 font-normal">Actual</th>
                      <th className="text-right py-1 px-1 text-xs text-white/80 font-normal">Variance</th>
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
                        const isRevenue = type === 'Revenue';
                        return (
                          <Fragment key={i}>
                            <td className="text-right py-1.5 px-1 text-sm font-semibold" style={{ color: colors.brown }}>
                              {formatCurrency(t.budget)}
                            </td>
                            <td className="text-right py-1.5 px-1 text-sm font-semibold" style={{ color: colors.brown }}>
                              {t.variance !== null ? formatCurrency(t.actual) : <span style={{ color: colors.creamDark }}>—</span>}
                            </td>
                            <td className="text-right py-1.5 px-1 text-sm font-semibold">
                              <VarianceCell variance={t.variance} isRevenue={isRevenue} />
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}
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
        </div>
      )}
    </div>
  );
}

// React.Fragment workaround for inline use
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
