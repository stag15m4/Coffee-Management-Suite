import { getErrorMessage } from '@/lib/utils';
import { useState, useCallback, useRef, useMemo } from 'react';
import { colors } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useChartOfAccounts,
  useFiscalYears,
  useCreateFiscalYear,
  useBudgetLineItems,
  useUpsertBudgetLineItem,
  useBulkUpsertBudgetLineItems,
} from '@/hooks/use-budget';
import { ACCOUNT_TYPE_ORDER, MONTH_LABELS } from './types';
import type { ChartOfAccount, AccountType } from './types';
import { Plus, Loader2, Copy, FileSpreadsheet, Download } from 'lucide-react';
import { exportBudgetPdf } from './budget-export';

interface Props {
  tenantId: string;
  coaTenantId: string;
}

export default function BudgetEntryTab({ tenantId, coaTenantId }: Props) {
  const { toast } = useToast();
  const { data: accounts = [], isLoading: loadingCoa } = useChartOfAccounts(coaTenantId);
  const { data: fiscalYears = [], isLoading: loadingFY } = useFiscalYears(tenantId);
  const createFiscalYear = useCreateFiscalYear();
  const upsertLine = useUpsertBudgetLineItem();
  const bulkUpsert = useBulkUpsertBudgetLineItems();

  const [selectedFYId, setSelectedFYId] = useState<string>('');
  const [showNewFYDialog, setShowNewFYDialog] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());

  // Auto-select first fiscal year when data loads
  const selectedFY = fiscalYears.find((fy) => fy.id === selectedFYId) || fiscalYears[0];
  const fyId = selectedFY?.id || '';

  const { data: lineItems = [], isLoading: loadingLines } = useBudgetLineItems(fyId, tenantId);

  // Build a lookup map: accountId-month → budget_amount
  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of lineItems) {
      map.set(`${item.account_id}-${item.month}`, Number(item.budget_amount));
    }
    return map;
  }, [lineItems]);

  // Local cell edits (optimistic — written to DB on blur)
  const [localEdits, setLocalEdits] = useState<Map<string, string>>(new Map());
  const saveTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const getCellValue = (accountId: string, month: number): string => {
    const key = `${accountId}-${month}`;
    if (localEdits.has(key)) return localEdits.get(key)!;
    const val = cellMap.get(key);
    return val !== undefined ? val.toString() : '';
  };

  const handleCellChange = (accountId: string, month: number, value: string) => {
    // iPad Safari number validation
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    const key = `${accountId}-${month}`;
    setLocalEdits((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });

    // Debounced save
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
        // Clear local edit after save
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

  // Calculate row total
  const getRowTotal = (accountId: string): number => {
    let total = 0;
    for (let m = 1; m <= 12; m++) {
      const key = `${accountId}-${m}`;
      const local = localEdits.get(key);
      if (local !== undefined) {
        total += parseFloat(local) || 0;
      } else {
        total += cellMap.get(key) || 0;
      }
    }
    return total;
  };

  // Calculate column total for a type
  const getColumnTotal = (type: AccountType, month: number): number => {
    return accounts
      .filter((a) => a.account_type === type)
      .reduce((sum, acc) => {
        const key = `${acc.id}-${month}`;
        const local = localEdits.get(key);
        if (local !== undefined) return sum + (parseFloat(local) || 0);
        return sum + (cellMap.get(key) || 0);
      }, 0);
  };

  const getTypeAnnualTotal = (type: AccountType): number => {
    let total = 0;
    for (let m = 1; m <= 12; m++) {
      total += getColumnTotal(type, m);
    }
    return total;
  };

  // Group accounts by type (only types that have accounts)
  const grouped = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.account_type === type && !a.parent_id),
  })).filter((g) => g.accounts.length > 0);

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
    } catch (err: unknown) {
      toast({ title: 'Failed to create', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const handleCopyPreviousYear = async () => {
    if (!selectedFY) return;
    const prevFY = fiscalYears.find((fy) => fy.year === selectedFY.year - 1);
    if (!prevFY) {
      toast({ title: `No ${selectedFY.year - 1} budget found`, variant: 'destructive' });
      return;
    }
    // Fetch previous year's line items (we need to query directly)
    try {
      const { data: prevLines, error } = await (await import('@/lib/supabase-queries')).supabase
        .from('budget_line_items')
        .select('account_id, month, budget_amount')
        .eq('fiscal_year_id', prevFY.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      if (!prevLines || prevLines.length === 0) {
        toast({ title: `${prevFY.year} budget has no data`, variant: 'destructive' });
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
      toast({ title: `Copied ${items.length} entries from ${prevFY.year}` });
    } catch (err: unknown) {
      toast({ title: 'Copy failed', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      <div
        className="rounded-xl p-8 text-center"
        style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
      >
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

        <Button
          variant="outline"
          onClick={() => setShowNewFYDialog(true)}
          style={{ borderColor: colors.gold, color: colors.brown }}
        >
          <Plus className="w-4 h-4 mr-1" />
          New Year
        </Button>

        {selectedFY && (
          <Button
            variant="outline"
            onClick={handleCopyPreviousYear}
            disabled={bulkUpsert.isPending}
            style={{ borderColor: colors.gold, color: colors.brown }}
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy from {selectedFY.year - 1}
          </Button>
        )}

        {selectedFY && accounts.length > 0 && (
          <Button
            variant="outline"
            onClick={() =>
              exportBudgetPdf({
                title: `${selectedFY.year} Annual Budget`,
                year: selectedFY.year,
                accounts,
                cellMap,
              })
            }
            style={{ borderColor: colors.gold, color: colors.brown }}
          >
            <Download className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
        )}

        {selectedFY && (
          <span
            className="text-xs ml-auto px-2 py-1 rounded"
            style={{
              backgroundColor:
                selectedFY.status === 'approved'
                  ? colors.green + '20'
                  : selectedFY.status === 'locked'
                    ? colors.red + '20'
                    : colors.cream,
              color:
                selectedFY.status === 'approved'
                  ? colors.green
                  : selectedFY.status === 'locked'
                    ? colors.red
                    : colors.brownLight,
            }}
          >
            {selectedFY.status.charAt(0).toUpperCase() + selectedFY.status.slice(1)}
          </span>
        )}
      </div>

      {!selectedFY ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
        >
          <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
            Create a fiscal year to get started
          </h3>
          <Button
            onClick={() => setShowNewFYDialog(true)}
            className="mt-3"
            style={{ backgroundColor: colors.gold, color: '#fff' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create {new Date().getFullYear()} Budget
          </Button>
        </div>
      ) : (
        /* Budget Grid */
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
        >
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '900px' }}>
              <thead>
                <tr style={{ backgroundColor: colors.gold }}>
                  <th
                    className="text-left py-2 px-3 font-semibold text-white sticky left-0 z-10"
                    style={{ backgroundColor: colors.gold, minWidth: '200px' }}
                  >
                    Account
                  </th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="text-right py-2 px-2 font-semibold text-white" style={{ minWidth: '90px' }}>
                      {m}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 font-semibold text-white" style={{ minWidth: '100px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ type, accounts: typeAccounts }, gi) => (
                  <GroupRows
                    key={type}
                    type={type}
                    accounts={typeAccounts}
                    getCellValue={getCellValue}
                    handleCellChange={handleCellChange}
                    handleCellBlur={handleCellBlur}
                    getRowTotal={getRowTotal}
                    getColumnTotal={getColumnTotal}
                    getTypeAnnualTotal={getTypeAnnualTotal}
                    formatCurrency={formatCurrency}
                    isLocked={selectedFY.status === 'locked'}
                  />
                ))}

                {/* Gross Profit row (Revenue - COGS) */}
                {accounts.some((a) => a.account_type === 'Revenue') &&
                  accounts.some((a) => a.account_type === 'COGS') && (
                    <tr style={{ backgroundColor: colors.cream, fontWeight: 600 }}>
                      <td
                        className="py-2 px-3 sticky left-0 z-10"
                        style={{ backgroundColor: colors.cream, color: colors.brown }}
                      >
                        Gross Profit
                      </td>
                      {MONTH_LABELS.map((_, i) => {
                        const val = getColumnTotal('Revenue', i + 1) - getColumnTotal('COGS', i + 1);
                        return (
                          <td
                            key={i}
                            className="text-right py-2 px-2"
                            style={{ color: val >= 0 ? colors.green : colors.red }}
                          >
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                      <td
                        className="text-right py-2 px-3"
                        style={{
                          color:
                            getTypeAnnualTotal('Revenue') - getTypeAnnualTotal('COGS') >= 0 ? colors.green : colors.red,
                        }}
                      >
                        {formatCurrency(getTypeAnnualTotal('Revenue') - getTypeAnnualTotal('COGS'))}
                      </td>
                    </tr>
                  )}

                {/* Net Income row */}
                <tr style={{ backgroundColor: colors.goldLight, fontWeight: 700 }}>
                  <td
                    className="py-2 px-3 sticky left-0 z-10"
                    style={{ backgroundColor: colors.goldLight, color: colors.brown }}
                  >
                    Net Income
                  </td>
                  {MONTH_LABELS.map((_, i) => {
                    const m = i + 1;
                    const revenue = getColumnTotal('Revenue', m);
                    const cogs = getColumnTotal('COGS', m);
                    const expense = getColumnTotal('Expense', m);
                    const other = getColumnTotal('Other', m);
                    const net = revenue - cogs - expense - other;
                    return (
                      <td
                        key={i}
                        className="text-right py-2 px-2"
                        style={{ color: net >= 0 ? colors.green : colors.red }}
                      >
                        {formatCurrency(net)}
                      </td>
                    );
                  })}
                  <td
                    className="text-right py-2 px-3"
                    style={{
                      color:
                        getTypeAnnualTotal('Revenue') -
                          getTypeAnnualTotal('COGS') -
                          getTypeAnnualTotal('Expense') -
                          getTypeAnnualTotal('Other') >=
                        0
                          ? colors.green
                          : colors.red,
                    }}
                  >
                    {formatCurrency(
                      getTypeAnnualTotal('Revenue') -
                        getTypeAnnualTotal('COGS') -
                        getTypeAnnualTotal('Expense') -
                        getTypeAnnualTotal('Other')
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*$/.test(v)) setNewYear(v);
                }}
                onFocus={(e) => e.target.select()}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <Button
              onClick={handleCreateFY}
              disabled={createFiscalYear.isPending}
              style={{ backgroundColor: colors.gold, color: '#fff' }}
            >
              {createFiscalYear.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Budget
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Rows sub-component (for performance — memoized per type)
// ---------------------------------------------------------------------------

interface GroupRowsProps {
  type: AccountType;
  accounts: ChartOfAccount[];
  getCellValue: (accountId: string, month: number) => string;
  handleCellChange: (accountId: string, month: number, value: string) => void;
  handleCellBlur: (accountId: string, month: number) => void;
  getRowTotal: (accountId: string) => number;
  getColumnTotal: (type: AccountType, month: number) => number;
  getTypeAnnualTotal: (type: AccountType) => number;
  formatCurrency: (val: number) => string;
  isLocked: boolean;
}

function GroupRows({
  type,
  accounts,
  getCellValue,
  handleCellChange,
  handleCellBlur,
  getRowTotal,
  getColumnTotal,
  getTypeAnnualTotal,
  formatCurrency,
  isLocked,
}: GroupRowsProps) {
  return (
    <>
      {/* Type header */}
      <tr>
        <td
          colSpan={14}
          className="py-2 px-3 font-semibold text-xs uppercase tracking-wider sticky left-0 z-10"
          style={{ backgroundColor: colors.cream, color: colors.brownLight }}
        >
          {type}
        </td>
      </tr>

      {/* Account rows */}
      {accounts.map((acc) => (
        <tr key={acc.id} className="hover:bg-black/[0.02] transition-colors">
          <td
            className="py-1 px-3 sticky left-0 z-10 text-sm"
            style={{ backgroundColor: colors.white, color: colors.brown }}
          >
            <div className="flex items-center gap-1.5">
              {acc.account_number && (
                <span className="text-xs font-mono" style={{ color: colors.brownLight }}>
                  {acc.account_number}
                </span>
              )}
              <span>{acc.name}</span>
            </div>
          </td>
          {MONTH_LABELS.map((_, i) => (
            <td key={i} className="py-1 px-1">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={getCellValue(acc.id, i + 1)}
                onChange={(e) => handleCellChange(acc.id, i + 1, e.target.value)}
                onBlur={() => handleCellBlur(acc.id, i + 1)}
                onFocus={(e) => e.target.select()}
                disabled={isLocked}
                className="w-full text-right text-sm py-1 px-1.5 rounded border outline-none focus:ring-1"
                style={{
                  backgroundColor: isLocked ? colors.cream : colors.inputBg,
                  borderColor: 'transparent',
                  color: colors.brown,
                }}
                onFocusCapture={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = colors.gold;
                }}
                onBlurCapture={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = 'transparent';
                }}
              />
            </td>
          ))}
          <td className="text-right py-1 px-3 text-sm font-medium" style={{ color: colors.brown }}>
            {formatCurrency(getRowTotal(acc.id))}
          </td>
        </tr>
      ))}

      {/* Subtotal row */}
      <tr style={{ borderTop: `1px solid ${colors.creamDark}` }}>
        <td
          className="py-1.5 px-3 text-sm font-semibold sticky left-0 z-10"
          style={{ backgroundColor: colors.white, color: colors.brownLight }}
        >
          Total {type}
        </td>
        {MONTH_LABELS.map((_, i) => (
          <td key={i} className="text-right py-1.5 px-2 text-sm font-semibold" style={{ color: colors.brown }}>
            {formatCurrency(getColumnTotal(type, i + 1))}
          </td>
        ))}
        <td className="text-right py-1.5 px-3 text-sm font-bold" style={{ color: colors.brown }}>
          {formatCurrency(getTypeAnnualTotal(type))}
        </td>
      </tr>
    </>
  );
}
