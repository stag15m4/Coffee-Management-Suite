import { useState, useMemo } from 'react';
import { Check, X, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { colors } from '@/lib/colors';
import { formatCurrency } from './utils';
import type { OverheadSettings, OverheadItem } from './types';

interface OverheadTabProps {
  overhead: OverheadSettings | null;
  overheadItems: OverheadItem[];
  avgDailyRevenue: number;
  cashDayCount: number;
  onAddOverheadItem: (item: { name: string; amount: number; frequency: string }) => Promise<void>;
  onUpdateOverheadItem: (id: string, updates: { name?: string; amount?: number; frequency?: string }) => Promise<void>;
  onDeleteOverheadItem: (id: string) => Promise<void>;
}

export const OverheadTab = ({ overhead, overheadItems, avgDailyRevenue, cashDayCount, onAddOverheadItem, onUpdateOverheadItem, onDeleteOverheadItem }: OverheadTabProps) => {
  const [newItem, setNewItem] = useState({ name: '', amount: '', frequency: 'monthly' });
  const [addingItem, setAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemForm, setEditingItemForm] = useState({ name: '', amount: '', frequency: '' });
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollInputs, setPayrollInputs] = useState({ run1: '', run2: '', run3: '' });
  const [laborFrequency, setLaborFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly' | 'bi-monthly'>('bi-weekly');
  const [sortColumn, setSortColumn] = useState<'name' | 'amount' | 'frequency' | 'monthly'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const operatingDays = Math.max(1, overhead?.operating_days_per_week || 7);
  const hoursPerDay = Math.max(1, overhead?.hours_open_per_day || 8);
  const weeksPerMonth = 4.33;
  const daysPerMonth = operatingDays * weeksPerMonth;

  const calculatePeriodAmounts = (amount: number, frequency: string) => {
    let monthlyAmount = 0;
    switch (frequency) {
      case 'daily':
        monthlyAmount = amount * daysPerMonth;
        break;
      case 'weekly':
        monthlyAmount = amount * weeksPerMonth;
        break;
      case 'bi-weekly':
        monthlyAmount = amount * (weeksPerMonth / 2);
        break;
      case 'monthly':
        monthlyAmount = amount;
        break;
      case 'quarterly':
        monthlyAmount = amount / 3;
        break;
      case 'annual':
        monthlyAmount = amount / 12;
        break;
    }
    return {
      daily: monthlyAmount / daysPerMonth,
      weekly: monthlyAmount / weeksPerMonth,
      monthly: monthlyAmount,
      quarterly: monthlyAmount * 3,
      annual: monthlyAmount * 12,
    };
  };

  const handleSort = (column: 'name' | 'amount' | 'frequency' | 'monthly') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedOverheadItems = [...overheadItems].sort((a, b) => {
    let comparison = 0;
    if (sortColumn === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortColumn === 'amount') {
      comparison = Number(a.amount) - Number(b.amount);
    } else if (sortColumn === 'frequency') {
      const freqOrder = ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'annual'];
      comparison = freqOrder.indexOf(a.frequency) - freqOrder.indexOf(b.frequency);
    } else if (sortColumn === 'monthly') {
      const aMonthly = calculatePeriodAmounts(Number(a.amount), a.frequency).monthly;
      const bMonthly = calculatePeriodAmounts(Number(b.amount), b.frequency).monthly;
      comparison = aMonthly - bMonthly;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totals = overheadItems.reduce(
    (acc, item) => {
      const amounts = calculatePeriodAmounts(Number(item.amount), item.frequency);
      return {
        daily: acc.daily + amounts.daily,
        weekly: acc.weekly + amounts.weekly,
        monthly: acc.monthly + amounts.monthly,
        quarterly: acc.quarterly + amounts.quarterly,
        annual: acc.annual + amounts.annual,
      };
    },
    { daily: 0, weekly: 0, monthly: 0, quarterly: 0, annual: 0 }
  );

  const payrollAverage = useMemo(() => {
    const run1 = payrollInputs.run1 !== '' ? parseFloat(payrollInputs.run1) || 0 : null;
    const run2 = payrollInputs.run2 !== '' ? parseFloat(payrollInputs.run2) || 0 : null;
    const run3 = payrollInputs.run3 !== '' ? parseFloat(payrollInputs.run3) || 0 : null;
    const enteredRuns = [run1, run2, run3].filter(r => r !== null) as number[];
    if (enteredRuns.length === 0) return 0;
    return enteredRuns.reduce((a, b) => a + b, 0) / enteredRuns.length;
  }, [payrollInputs]);

  const payrollRunsEntered = useMemo(() => {
    let count = 0;
    if (payrollInputs.run1 !== '') count++;
    if (payrollInputs.run2 !== '') count++;
    if (payrollInputs.run3 !== '') count++;
    return count;
  }, [payrollInputs]);

  const existingPayrollItem = overheadItems.find(item => item.name === 'Labor');

  const openPayrollModal = () => {
    if (existingPayrollItem) {
      const avg = Number(existingPayrollItem.amount);
      setPayrollInputs({ run1: avg.toString(), run2: '', run3: '' });
      setLaborFrequency((existingPayrollItem.frequency as 'weekly' | 'bi-weekly' | 'monthly' | 'bi-monthly') || 'bi-weekly');
    } else {
      setPayrollInputs({ run1: '', run2: '', run3: '' });
      setLaborFrequency('bi-weekly');
    }
    setShowPayrollModal(true);
  };

  const handlePayrollSave = async () => {
    if (payrollAverage <= 0) return;
    if (existingPayrollItem) {
      await onUpdateOverheadItem(existingPayrollItem.id, {
        name: 'Labor',
        amount: payrollAverage,
        frequency: laborFrequency,
      });
    } else {
      await onAddOverheadItem({
        name: 'Labor',
        amount: payrollAverage,
        frequency: laborFrequency,
      });
    }
    setShowPayrollModal(false);
    setPayrollInputs({ run1: '', run2: '', run3: '' });
  };

  return (
    <div className="space-y-6">
      {/* Overhead Calculator */}
      <div className="rounded-xl p-6 shadow-md" style={{ backgroundColor: colors.white }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-bold" style={{ color: colors.brown }}>Overhead Calculator</h3>
          <div className="flex gap-2">
            <button
              onClick={openPayrollModal}
              className="px-3 py-1.5 font-semibold rounded-lg text-sm"
              style={{ backgroundColor: colors.brown, color: colors.white }}
              data-testid="button-labor"
            >
              Labor
            </button>
            <button
              onClick={() => setAddingItem(true)}
              className="px-3 py-1.5 font-semibold rounded-lg text-sm"
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-add-overhead-item"
            >
              + Add Item
            </button>
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
          Add your shop overhead costs. Amounts are automatically converted to all time periods based on your {operatingDays}-day operating week.
        </p>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: colors.brown }}>
                <th className="text-left p-2 font-semibold text-white cursor-pointer hover:opacity-70 select-none" style={{ width: '20%' }} onClick={() => handleSort('name')}>
                  Item {sortColumn === 'name' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-right p-2 font-semibold text-white cursor-pointer hover:opacity-70 select-none" style={{ width: '12%' }} onClick={() => handleSort('amount')}>
                  Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-center p-2 font-semibold text-white cursor-pointer hover:opacity-70 select-none" style={{ width: '12%' }} onClick={() => handleSort('frequency')}>
                  Frequency {sortColumn === 'frequency' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-right p-2 font-semibold text-white/70" style={{ width: '11%' }}>Daily</th>
                <th className="text-right p-2 font-semibold text-white/70" style={{ width: '11%' }}>Weekly</th>
                <th className="text-right p-2 font-semibold text-white/70 cursor-pointer hover:opacity-70 select-none" style={{ width: '11%' }} onClick={() => handleSort('monthly')}>
                  Monthly {sortColumn === 'monthly' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-right p-2 font-semibold text-white/70" style={{ width: '11%' }}>Quarterly</th>
                <th className="text-right p-2 font-semibold text-white/70" style={{ width: '11%' }}>Annual</th>
                <th className="p-2" style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Add New Item Row */}
              {addingItem && (
                <tr style={{ backgroundColor: colors.cream }}>
                  <td className="p-2">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full px-2 py-1 rounded border outline-none"
                      style={{ borderColor: colors.gold }}
                      data-testid="input-new-item-name"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={newItem.amount}
                      onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                      className="w-full px-2 py-1 rounded border outline-none text-right"
                      style={{ borderColor: colors.gold }}
                      data-testid="input-new-item-amount"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={newItem.frequency}
                      onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}
                      className="w-full px-2 py-1 rounded border outline-none"
                      style={{ borderColor: colors.gold }}
                      data-testid="select-new-item-frequency"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </td>
                  <td colSpan={5} className="p-2 text-right">
                    <button
                      onClick={async () => {
                        if (newItem.name && newItem.amount) {
                          await onAddOverheadItem({
                            name: newItem.name,
                            amount: parseFloat(newItem.amount) || 0,
                            frequency: newItem.frequency,
                          });
                          setNewItem({ name: '', amount: '', frequency: 'monthly' });
                          setAddingItem(false);
                        }
                      }}
                      className="px-3 py-1 font-semibold rounded text-sm mr-2"
                      style={{ backgroundColor: colors.gold, color: colors.white }}
                      data-testid="button-save-new-item"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setNewItem({ name: '', amount: '', frequency: 'monthly' });
                        setAddingItem(false);
                      }}
                      className="px-3 py-1 font-semibold rounded text-sm"
                      style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                      data-testid="button-cancel-new-item"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              )}

              {/* Existing Items */}
              {sortedOverheadItems.map((item) => {
                const amounts = calculatePeriodAmounts(Number(item.amount), item.frequency);
                const isEditing = editingItemId === item.id;

                return (
                  <tr key={item.id} className="border-b" style={{ borderColor: colors.cream }}>
                    <td className="p-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingItemForm.name}
                          onChange={(e) => setEditingItemForm({ ...editingItemForm, name: e.target.value })}
                          className="w-full px-2 py-1 rounded border outline-none"
                          style={{ borderColor: colors.gold }}
                          data-testid={`input-edit-item-name-${item.id}`}
                        />
                      ) : (
                        <span style={{ color: colors.brown }}>{item.name}</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingItemForm.amount}
                          onChange={(e) => setEditingItemForm({ ...editingItemForm, amount: e.target.value })}
                          className="w-full px-2 py-1 rounded border outline-none text-right"
                          style={{ borderColor: colors.gold }}
                          data-testid={`input-edit-item-amount-${item.id}`}
                        />
                      ) : (
                        <span style={{ color: colors.brown }}>{formatCurrency(Number(item.amount))}</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {isEditing ? (
                        <select
                          value={editingItemForm.frequency}
                          onChange={(e) => setEditingItemForm({ ...editingItemForm, frequency: e.target.value })}
                          className="w-full px-2 py-1 rounded border outline-none"
                          style={{ borderColor: colors.gold }}
                          data-testid={`select-edit-item-frequency-${item.id}`}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="bi-weekly">Bi-Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annual">Annual</option>
                        </select>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.cream, color: colors.brownLight }}>
                          {item.frequency}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right" style={{ color: colors.brownLight }}>{formatCurrency(amounts.daily)}</td>
                    <td className="p-2 text-right" style={{ color: colors.brownLight }}>{formatCurrency(amounts.weekly)}</td>
                    <td className="p-2 text-right" style={{ color: colors.brownLight }}>{formatCurrency(amounts.monthly)}</td>
                    <td className="p-2 text-right" style={{ color: colors.brownLight }}>{formatCurrency(amounts.quarterly)}</td>
                    <td className="p-2 text-right" style={{ color: colors.brownLight }}>{formatCurrency(amounts.annual)}</td>
                    <td className="p-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              await onUpdateOverheadItem(item.id, {
                                name: editingItemForm.name,
                                amount: parseFloat(editingItemForm.amount) || 0,
                                frequency: editingItemForm.frequency,
                              });
                              setEditingItemId(null);
                            }}
                            className="p-1 rounded"
                            style={{ color: colors.gold }}
                            data-testid={`button-save-item-${item.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="p-1 rounded"
                            style={{ color: colors.brownLight }}
                            data-testid={`button-cancel-item-${item.id}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditingItemForm({
                                      name: item.name,
                                      amount: String(item.amount),
                                      frequency: item.frequency,
                                    });
                                  }}
                                  className="p-1 rounded"
                                  style={{ color: colors.brownLight }}
                                  data-testid={`button-edit-item-${item.id}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => onDeleteOverheadItem(item.id)}
                                  className="p-1 rounded"
                                  style={{ color: colors.brownLight }}
                                  data-testid={`button-delete-item-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Totals Row */}
              {overheadItems.length > 0 && (
                <tr style={{ backgroundColor: colors.cream }}>
                  <td className="p-2 font-bold" style={{ color: colors.brown }}>Total</td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="p-2 text-right font-bold" style={{ color: colors.gold }}>{formatCurrency(totals.daily)}</td>
                  <td className="p-2 text-right font-bold" style={{ color: colors.gold }}>{formatCurrency(totals.weekly)}</td>
                  <td className="p-2 text-right font-bold" style={{ color: colors.gold }}>{formatCurrency(totals.monthly)}</td>
                  <td className="p-2 text-right font-bold" style={{ color: colors.gold }}>{formatCurrency(totals.quarterly)}</td>
                  <td className="p-2 text-right font-bold" style={{ color: colors.gold }}>{formatCurrency(totals.annual)}</td>
                  <td className="p-2"></td>
                </tr>
              )}

              {/* Empty State */}
              {overheadItems.length === 0 && !addingItem && (
                <tr>
                  <td colSpan={9} className="p-8 text-center" style={{ color: colors.brownLight }}>
                    No overhead items yet. Click "Add Item" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue vs Overhead Comparison */}
      {overheadItems.length > 0 && (
        <div className="rounded-xl shadow-md overflow-hidden" style={{ backgroundColor: colors.white }} data-spotlight="revenue-chart">
          <div className="px-4 py-3" style={{ backgroundColor: colors.brown }}>
            <h3 className="font-bold text-white">Daily Revenue vs Overhead</h3>
          </div>
          <div className="p-4">
            {cashDayCount === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: colors.brownLight }}>
                Log cash deposits to see how your daily revenue compares to overhead costs.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: colors.brownLight }}>Avg Daily Revenue</div>
                  <div className="text-xl font-bold" style={{ color: colors.brown }}>{formatCurrency(avgDailyRevenue)}</div>
                  <div className="text-xs" style={{ color: colors.brownLight }}>from {cashDayCount} days</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: colors.brownLight }}>Daily Overhead</div>
                  <div className="text-xl font-bold" style={{ color: colors.gold }}>{formatCurrency(totals.daily)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: colors.brownLight }}>Daily Margin</div>
                  <div className="text-xl font-bold" style={{ color: avgDailyRevenue - totals.daily >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatCurrency(avgDailyRevenue - totals.daily)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: colors.brownLight }}>Overhead %</div>
                  <div className="text-xl font-bold" style={{ color: avgDailyRevenue > 0 && (totals.daily / avgDailyRevenue) <= 0.5 ? '#22c55e' : colors.gold }}>
                    {avgDailyRevenue > 0 ? `${((totals.daily / avgDailyRevenue) * 100).toFixed(1)}%` : '\u2014'}
                  </div>
                  <div className="text-xs" style={{ color: colors.brownLight }}>of revenue</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl p-6 shadow-xl max-w-md w-full" style={{ backgroundColor: colors.white }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: colors.brown }}>Labor Calculator</h3>
            <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
              Enter your last 3 payroll runs (including all taxes) to calculate an average labor cost.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
                  Pay Frequency
                </label>
                <select
                  value={laborFrequency}
                  onChange={(e) => setLaborFrequency(e.target.value as 'weekly' | 'bi-weekly' | 'monthly' | 'bi-monthly')}
                  className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                  style={{ borderColor: colors.gold }}
                  data-testid="select-labor-frequency"
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="bi-monthly">Bi-Monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {[
                { key: 'run1', label: 'Payroll Run 1' },
                { key: 'run2', label: 'Payroll Run 2' },
                { key: 'run3', label: 'Payroll Run 3' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={payrollInputs[key as keyof typeof payrollInputs]}
                      onChange={(e) => setPayrollInputs({ ...payrollInputs, [key]: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      className="w-full pl-7 pr-3 py-2 rounded-lg border-2 outline-none"
                      style={{ borderColor: colors.gold }}
                      data-testid={`input-payroll-${key}`}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t" style={{ borderColor: colors.cream }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs" style={{ color: colors.brownLight }}>
                    {payrollRunsEntered === 0 ? 'Enter payroll runs above' :
                     payrollRunsEntered === 1 ? 'Average of 1 run' :
                     payrollRunsEntered === 2 ? 'Average of 2 runs' :
                     'Average of 3 runs'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: colors.brownLight }}>
                    {laborFrequency === 'weekly' ? 'Weekly' :
                     laborFrequency === 'bi-weekly' ? 'Bi-Weekly' :
                     laborFrequency === 'bi-monthly' ? 'Bi-Monthly' : 'Monthly'} Labor
                  </span>
                  <span className="text-lg font-bold" style={{ color: colors.brown }}>
                    {formatCurrency(payrollAverage)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowPayrollModal(false);
                  setPayrollInputs({ run1: '', run2: '', run3: '' });
                }}
                className="flex-1 px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-payroll"
              >
                Cancel
              </button>
              <button
                onClick={handlePayrollSave}
                disabled={payrollAverage <= 0}
                className="flex-1 px-4 py-2 font-semibold rounded-lg disabled:opacity-50"
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-save-payroll"
              >
                {existingPayrollItem ? 'Update Labor' : 'Add Labor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
