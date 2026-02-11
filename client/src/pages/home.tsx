import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearch, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, Check, X, Pencil, Copy, Plus, Layers, Truck, Phone, Mail, FileText } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { showDeleteUndoToast } from '@/hooks/use-delete-with-undo';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { IngredientsTab } from './recipe-costing/IngredientsTab';
import { RecipesTab } from './recipe-costing/RecipesTab';
import { PricingTab } from './recipe-costing/PricingTab';
import {
  supabase,
  queryKeys,
  useIngredientCategories,
  useIngredients,
  useProductCategories,
  useBaseTemplates,
  useDrinkSizes,
  useRecipes,
  useOverhead,
  useOverheadItems,
  useAddOverheadItem,
  useUpdateOverheadItem,
  useDeleteOverheadItem,
  useRecipePricing,
  useRecipeSizeBases,
  useUpdateIngredient,
  useAddIngredient,
  useUpdateOverhead,
  useUpdateRecipePricing,
  useUpdateRecipeSizeBase,
  useCashActivityRevenue,
  useRecipeVendors,
  useAddRecipeVendor,
  useUpdateRecipeVendor,
  useDeleteRecipeVendor,
  type RecipeVendor,
} from '@/lib/supabase-queries';
import { colors } from '@/lib/colors';
import { formatCurrency, formatPercent, calculateCostPerUsageUnit } from './recipe-costing/utils';
import type {
  Category,
  Ingredient,
  Recipe,
  DrinkSize,
  BaseTemplate,
  BaseTemplateIngredient,
  RecipeIngredient,
  OverheadSettings,
  OverheadItem,
  RecipeSizeBase,
  RecipeSizePricing,
} from './recipe-costing/types';

const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className="px-6 py-3 font-semibold rounded-t-lg transition-all"
    style={{
      backgroundColor: active ? colors.white : colors.creamDark,
      color: active ? colors.brown : colors.brownLight,
      borderBottom: active ? `3px solid ${colors.gold}` : 'none',
    }}
    data-testid={`tab-${String(children).toLowerCase().replace(/\s+/g, '-')}`}
  >
    {children}
  </button>
);

interface OverheadTabProps {
  overhead: OverheadSettings | null;
  overheadItems: OverheadItem[];
  avgDailyRevenue: number;
  cashDayCount: number;
  onAddOverheadItem: (item: { name: string; amount: number; frequency: string }) => Promise<void>;
  onUpdateOverheadItem: (id: string, updates: { name?: string; amount?: number; frequency?: string }) => Promise<void>;
  onDeleteOverheadItem: (id: string) => Promise<void>;
}

interface SettingsTabProps {
  overhead: OverheadSettings | null;
  onUpdateOverhead: (updates: Partial<OverheadSettings>) => Promise<void>;
  ingredients: Ingredient[];
  recipes: Recipe[];
  drinkSizes: DrinkSize[];
  baseTemplates: BaseTemplate[];
  recipeSizeBases: RecipeSizeBase[];
  recipePricing: RecipeSizePricing[];
}

const OverheadTab = ({ overhead, overheadItems, avgDailyRevenue, cashDayCount, onAddOverheadItem, onUpdateOverheadItem, onDeleteOverheadItem }: OverheadTabProps) => {
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
  const minutesPerDay = hoursPerDay * 60;
  const minutesPerMonth = minutesPerDay * daysPerMonth;

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

  // Sort handler
  const handleSort = (column: 'name' | 'amount' | 'frequency' | 'monthly') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort overhead items
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

        {/* Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: colors.brown }}>
                <th
                  className="text-left p-2 font-semibold text-white cursor-pointer hover:opacity-70 select-none"
                  style={{ width: '20%' }}
                  onClick={() => handleSort('name')}
                >
                  Item {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right p-2 font-semibold text-white cursor-pointer hover:opacity-70 select-none"
                  style={{ width: '12%' }}
                  onClick={() => handleSort('amount')}
                >
                  Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-center p-2 font-semibold text-white cursor-pointer hover:opacity-70 select-none"
                  style={{ width: '12%' }}
                  onClick={() => handleSort('frequency')}
                >
                  Frequency {sortColumn === 'frequency' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right p-2 font-semibold text-white/70" style={{ width: '11%' }}>Daily</th>
                <th className="text-right p-2 font-semibold text-white/70" style={{ width: '11%' }}>Weekly</th>
                <th
                  className="text-right p-2 font-semibold text-white/70 cursor-pointer hover:opacity-70 select-none"
                  style={{ width: '11%' }}
                  onClick={() => handleSort('monthly')}
                >
                  Monthly {sortColumn === 'monthly' && (sortDirection === 'asc' ? '↑' : '↓')}
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
        <div className="rounded-xl shadow-md overflow-hidden" style={{ backgroundColor: colors.white }}>
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
                    {avgDailyRevenue > 0 ? `${((totals.daily / avgDailyRevenue) * 100).toFixed(1)}%` : '—'}
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
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
                  Payroll Run 1
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={payrollInputs.run1}
                    onChange={(e) => setPayrollInputs({ ...payrollInputs, run1: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.gold }}
                    data-testid="input-payroll-run1"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
                  Payroll Run 2
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={payrollInputs.run2}
                    onChange={(e) => setPayrollInputs({ ...payrollInputs, run2: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.gold }}
                    data-testid="input-payroll-run2"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
                  Payroll Run 3
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={payrollInputs.run3}
                    onChange={(e) => setPayrollInputs({ ...payrollInputs, run3: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.gold }}
                    data-testid="input-payroll-run3"
                  />
                </div>
              </div>

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

const SettingsTab = ({ overhead, onUpdateOverhead, ingredients, recipes, drinkSizes, baseTemplates, recipeSizeBases, recipePricing }: SettingsTabProps) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cost_per_minute: overhead?.cost_per_minute || 2.26,
    minutes_per_drink: overhead?.minutes_per_drink || 1,
    notes: overhead?.notes || '',
    operating_days_per_week: overhead?.operating_days_per_week || 7,
    hours_open_per_day: overhead?.hours_open_per_day || 8,
  });

  const costPerMinute = overhead?.cost_per_minute || 0;
  const overheadPerDrink = costPerMinute * (overhead?.minutes_per_drink || 1);

  const handleSave = async () => {
    await onUpdateOverhead(form);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Overhead Settings */}
      <div className="rounded-xl p-6 shadow-md" style={{ backgroundColor: colors.white }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: colors.brown }}>Overhead Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Minutes per Drink
            </label>
            {editing ? (
              <input
                type="text"
                inputMode="decimal"
                value={form.minutes_per_drink}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setForm({ ...form, minutes_per_drink: val === '' ? 0 : parseFloat(val) || 0 });
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-minutes-per-drink"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {overhead?.minutes_per_drink ? String(overhead.minutes_per_drink).replace(/^0+(?=\d)/, '') : '1'}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Operating Days Per Week
            </label>
            {editing ? (
              <input
                type="number"
                min="1"
                max="7"
                value={form.operating_days_per_week}
                onChange={(e) => setForm({ ...form, operating_days_per_week: Math.min(7, Math.max(1, parseInt(e.target.value) || 7)) })}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-operating-days"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {overhead?.operating_days_per_week || 7} days
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Hours Open Per Day
            </label>
            {editing ? (
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={form.hours_open_per_day}
                onChange={(e) => setForm({ ...form, hours_open_per_day: Math.min(24, Math.max(1, parseFloat(e.target.value) || 8)) })}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-hours-open"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {overhead?.hours_open_per_day || 8} hours
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Calculated Cost/Minute
            </label>
            <div className="text-2xl font-bold" style={{ color: colors.gold }}>
              {formatCurrency(costPerMinute)}
            </div>
            <div className="text-xs" style={{ color: colors.brownLight }}>
              From overhead calculator
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
          <div className="text-sm" style={{ color: colors.brownLight }}>Overhead per Drink</div>
          <div className="text-3xl font-bold" style={{ color: colors.gold }}>
            {formatCurrency(overheadPerDrink)}
          </div>
          <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
            Cost/min ({formatCurrency(costPerMinute)}) x Minutes/drink ({overhead?.minutes_per_drink || 1})
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
            Notes
          </label>
          {editing ? (
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.gold }}
              rows={2}
              data-testid="input-notes"
            />
          ) : (
            <p style={{ color: colors.brownLight }}>{overhead?.notes || 'No notes'}</p>
          )}
        </div>

        <div className="mt-4">
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-save-settings"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-settings"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 font-semibold rounded-lg"
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-edit-settings"
            >
              Edit Settings
            </button>
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="rounded-xl p-6 shadow-md" style={{ backgroundColor: colors.white }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: colors.brown }}>Export Data</h3>
        <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
          Export your recipe costing data for backup, reporting, or sharing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              let csv = 'Name,Category,Type,Cost,Quantity,Unit,Cost Per Unit,Usage Unit,Cost Per Usage,Vendor,Manufacturer,Item Number,Last Updated\n';
              ingredients.forEach(ing => {
                const ingQuantity = Number(ing.quantity) || 1;
                const costPerUnit = (Number(ing.cost) || 0) / (ingQuantity > 0 ? ingQuantity : 1);
                const usageUnit = ing.usage_unit || ing.unit;
                const costPerUsage = calculateCostPerUsageUnit(
                  Number(ing.cost) || 0,
                  Number(ing.quantity) || 1,
                  ing.unit,
                  usageUnit
                );
                csv += `"${ing.name}","${ing.category_name || ''}","${ing.ingredient_type || ''}",${Number(ing.cost) || 0},${Number(ing.quantity) || 0},"${ing.unit}",${costPerUnit.toFixed(4)},"${usageUnit}",${costPerUsage?.toFixed(4) || ''},`
                csv += `"${ing.vendor || ''}","${ing.manufacturer || ''}","${ing.item_number || ''}","${ing.updated_at || ''}"\n`;
              });
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            }}
            className="px-4 py-3 font-semibold rounded-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: colors.cream, color: colors.brown, border: `1px solid ${colors.gold}` }}
            data-testid="button-export-ingredients"
          >
            Export Ingredients CSV
          </button>

          <button
            onClick={() => {
              let csv = 'Recipe Name,Category,Size,Base Template,Ingredient Cost,Overhead,Total Cost,Sale Price,Margin %,Profit\n';

              recipes.forEach(recipe => {
                const recipeMinutes = recipe.minutes_per_drink ?? overhead?.minutes_per_drink ?? 1;
                const overheadCost = (overhead?.cost_per_minute || 0) * recipeMinutes;
                const category = recipe.category_name || '';

                drinkSizes.forEach(size => {
                  const sizeBase = recipeSizeBases.find(rsb => rsb.recipe_id === recipe.id && rsb.size_id === size.id);
                  const baseTemplate = sizeBase ? baseTemplates.find(bt => bt.id === sizeBase.base_template_id) :
                    (recipe.base_template_id ? baseTemplates.find(bt => bt.id === recipe.base_template_id) : null);

                  const recipeIngredients = (recipe.recipe_ingredients || []).filter((ri: RecipeIngredient) => ri.size_id === size.id);
                  let ingredientCost = 0;

                  recipeIngredients.forEach((ri: RecipeIngredient) => {
                    if (ri.ingredient_id) {
                      const ing = ingredients.find(i => i.id === ri.ingredient_id);
                      if (ing) {
                        const usageUnit = ing.usage_unit || ing.unit;
                        const costPerUsage = calculateCostPerUsageUnit(
                          Number(ing.cost) || 0,
                          Number(ing.quantity) || 1,
                          ing.unit,
                          usageUnit
                        );
                        ingredientCost += (costPerUsage || 0) * (Number(ri.quantity) || 0);
                      }
                    }
                  });

                  if (baseTemplate) {
                    const baseIngredients = (baseTemplate.ingredients || []).filter((bi: any) => bi.size_id === size.id);
                    baseIngredients.forEach((bi: any) => {
                      const ing = ingredients.find(i => i.id === bi.ingredient_id);
                      if (ing) {
                        const usageUnit = ing.usage_unit || ing.unit;
                        const costPerUsage = calculateCostPerUsageUnit(
                          Number(ing.cost) || 0,
                          Number(ing.quantity) || 1,
                          ing.unit,
                          usageUnit
                        );
                        ingredientCost += (costPerUsage || 0) * (Number(bi.quantity) || 0);
                      }
                    });
                  }

                  const totalCost = ingredientCost + overheadCost;
                  const pricing = recipePricing.find(rp => rp.recipe_id === recipe.id && rp.size_id === size.id);
                  const salePrice = pricing ? Number(pricing.sale_price) || 0 : 0;
                  const margin = salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0;
                  const profit = salePrice - totalCost;

                  csv += `"${recipe.name}","${category}","${size.name}","${baseTemplate?.name || 'None'}",${ingredientCost.toFixed(2)},${overheadCost.toFixed(2)},${totalCost.toFixed(2)},${salePrice.toFixed(2)},${margin.toFixed(1)},${profit.toFixed(2)}\n`;
                });
              });

              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            }}
            className="px-4 py-3 font-semibold rounded-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: colors.cream, color: colors.brown, border: `1px solid ${colors.gold}` }}
            data-testid="button-export-recipes"
          >
            Export Recipes & Pricing CSV
          </button>
        </div>
      </div>
    </div>
  );
};

interface BaseTemplatesTabProps {
  baseTemplates: BaseTemplate[];
  ingredients: Ingredient[];
  drinkSizes: DrinkSize[];
  onAddTemplate: (template: { name: string; drink_type: string; description?: string }) => Promise<void>;
  onAddTemplateIngredient: (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number; unit?: string }) => Promise<void>;
  onDeleteTemplateIngredient: (id: string) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onAddDrinkSize: (size: { name: string; size_oz: number; drink_type: string }) => Promise<string>;
  onRemoveTemplateSize: (templateId: string, sizeId: string) => Promise<void>;
}

const BaseTemplatesTab = ({ baseTemplates, ingredients, drinkSizes, onAddTemplate, onAddTemplateIngredient, onDeleteTemplateIngredient, onDeleteTemplate, onAddDrinkSize, onRemoveTemplateSize }: BaseTemplatesTabProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', drink_type: 'Hot', description: '' });
  const [addingIngredient, setAddingIngredient] = useState<{ templateId: string; sizeId: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '1', unit: '' });
  const [copying, setCopying] = useState(false);
  const [pendingSizes, setPendingSizes] = useState<Record<string, string[]>>({});
  const [addingSizeFor, setAddingSizeFor] = useState<string | null>(null);
  const [creatingSize, setCreatingSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeOz, setNewSizeOz] = useState('');

  const handleCopyFromSize = async (template: BaseTemplate, targetSizeId: string, sourceSizeId: string) => {
    const sourceIngredients = (template.ingredients || []).filter(i => i.size_id === sourceSizeId);
    if (sourceIngredients.length === 0) {
      alert('No ingredients to copy from that size');
      return;
    }
    setCopying(true);
    try {
      for (const ing of sourceIngredients) {
        await onAddTemplateIngredient({
          base_template_id: template.id,
          ingredient_id: ing.ingredient_id,
          size_id: targetSizeId,
          quantity: ing.quantity,
          unit: ing.unit || 'each',
        });
      }
    } finally {
      setCopying(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name) {
      alert('Please enter a template name');
      return;
    }
    await onAddTemplate(newTemplate);
    setNewTemplate({ name: '', drink_type: 'Hot', description: '' });
    setShowAddForm(false);
  };

  const handleAddIngredient = async (templateId: string, sizeId: string) => {
    if (!newIngredient.ingredient_id) {
      alert('Please select an ingredient');
      return;
    }
    const selectedIng = ingredients.find(i => i.id === newIngredient.ingredient_id);
    const unit = newIngredient.unit || selectedIng?.usage_unit || selectedIng?.unit || 'each';
    await onAddTemplateIngredient({
      base_template_id: templateId,
      ingredient_id: newIngredient.ingredient_id,
      size_id: sizeId,
      quantity: parseFloat(newIngredient.quantity) || 1,
      unit,
    });
    setNewIngredient({ ingredient_id: '', quantity: '1', unit: '' });
    setAddingIngredient(null);
  };

  const drinkTypes = ['Hot', 'Cold', 'Food'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <h3 className="font-bold text-lg" style={{ color: colors.brown }}>Base Templates (Disposables)</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-add-template"
        >
          + New Base Template
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-xl p-4 shadow-md" style={{ backgroundColor: colors.white }}>
          <h3 className="font-bold mb-3" style={{ color: colors.brown }}>New Base Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Template Name (e.g., Hot Drink Base)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-template-name"
            />
            <select
              value={newTemplate.drink_type}
              onChange={(e) => setNewTemplate({ ...newTemplate, drink_type: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-template-type"
            >
              {drinkTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Description (optional)"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-template-description"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTemplate}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-save-template"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-template"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {baseTemplates.map(template => {
          const usedSizeIds = Array.from(new Set((template.ingredients || []).map(i => i.size_id)));
          const pendingForTemplate = (pendingSizes[template.id] || []).filter(id => !usedSizeIds.includes(id));
          const allShownSizeIds = [...usedSizeIds, ...pendingForTemplate];
          const templateSizes = drinkSizes.filter(s => allShownSizeIds.includes(s.id));
          return (
            <div
              key={template.id}
              className="rounded-xl shadow-md overflow-hidden"
              style={{ backgroundColor: colors.white }}
              data-testid={`card-template-${template.id}`}
            >
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                style={{ backgroundColor: colors.creamDark }}
              >
                <div>
                  <h3 className="font-bold" style={{ color: colors.brown }}>{template.name}</h3>
                  <span className="text-sm" style={{ color: colors.brownLight }}>
                    {template.drink_type === 'Food' ? 'Food items' : `${template.drink_type} drinks`} {template.description ? `- ${template.description}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTemplate(template.id);
                    }}
                    data-testid={`button-delete-template-${template.id}`}
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <span style={{ color: colors.gold }}>{expandedTemplate === template.id ? '▼' : '▶'}</span>
                </div>
              </div>

              {expandedTemplate === template.id && (
                <div className="p-4">
                  <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                    Add items for each size:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {templateSizes.map(size => {
                      const sizeIngredients = (template.ingredients || []).filter(i => i.size_id === size.id);
                      const isAdding = addingIngredient?.templateId === template.id && addingIngredient?.sizeId === size.id;
                      const isPending = sizeIngredients.length === 0;

                      return (
                        <div
                          key={size.id}
                          className="rounded-lg p-3"
                          style={{ backgroundColor: colors.cream }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="font-semibold" style={{ color: colors.brown }}>{size.name}</div>
                              <button
                                onClick={async () => {
                                  if (sizeIngredients.length > 0) {
                                    if (!window.confirm(`Remove "${size.name}" and all its items from this template?`)) return;
                                    await onRemoveTemplateSize(template.id, size.id);
                                  }
                                  setPendingSizes(prev => ({
                                    ...prev,
                                    [template.id]: (prev[template.id] || []).filter(id => id !== size.id),
                                  }));
                                }}
                                className="p-0.5 rounded hover:bg-black/5"
                                title="Remove size"
                                data-testid={`button-remove-size-${size.id}`}
                              >
                                <X className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                              </button>
                          </div>

                          {sizeIngredients.map(ing => {
                            const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
                            const displayUnit = ing.unit || ingredient?.usage_unit || ingredient?.unit || 'each';
                            return (
                              <div key={ing.id} className="flex items-center justify-between text-sm mb-1">
                                <span style={{ color: colors.brownLight }}>
                                  {ingredient?.name || 'Unknown'} — {ing.quantity} {displayUnit}
                                </span>
                                <button
                                  onClick={() => onDeleteTemplateIngredient(ing.id)}
                                  className="p-1 rounded hover:bg-red-50 shrink-0"
                                  title="Remove item"
                                  data-testid={`button-delete-ing-${ing.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
                                </button>
                              </div>
                            );
                          })}

                          {isAdding ? (
                            <div className="mt-2 space-y-2">
                              <select
                                value={newIngredient.ingredient_id}
                                onChange={(e) => {
                                  const sel = ingredients.find(i => i.id === e.target.value);
                                  setNewIngredient({
                                    ...newIngredient,
                                    ingredient_id: e.target.value,
                                    unit: sel?.usage_unit || sel?.unit || 'each',
                                  });
                                }}
                                className="w-full px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.gold }}
                                data-testid={`select-ing-${size.id}`}
                              >
                                <option value="">Select ingredient</option>
                                {ingredients
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(ing => (
                                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.ingredient_type || 'FOH Ingredient'})</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={newIngredient.quantity}
                                  onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                  className="flex-1 px-2 py-1 rounded border text-sm"
                                  style={{ borderColor: colors.gold }}
                                  placeholder="Qty"
                                  data-testid={`input-qty-${size.id}`}
                                />
                                <select
                                  value={(() => {
                                    if (newIngredient.unit) return newIngredient.unit;
                                    const sel = ingredients.find(i => i.id === newIngredient.ingredient_id);
                                    return sel?.usage_unit || sel?.unit || 'each';
                                  })()}
                                  onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                  className="flex-1 px-2 py-1 rounded border text-sm"
                                  style={{ borderColor: colors.gold }}
                                  data-testid={`select-unit-${size.id}`}
                                >
                                  {(() => {
                                    const sel = ingredients.find(i => i.id === newIngredient.ingredient_id);
                                    const defaultUnit = sel?.usage_unit || sel?.unit || 'each';
                                    const units = ['each', 'oz', 'lb', 'gram', 'ml'];
                                    const sortedUnits = [defaultUnit, ...units.filter(u => u !== defaultUnit)];
                                    return sortedUnits.map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ));
                                  })()}
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleAddIngredient(template.id, size.id)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                                  data-testid={`button-confirm-ing-${size.id}`}
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => setAddingIngredient(null)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                                  data-testid={`button-cancel-ing-${size.id}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => setAddingIngredient({ templateId: template.id, sizeId: size.id })}
                                className="text-sm font-medium"
                                style={{ color: colors.gold }}
                                data-testid={`button-add-ing-${size.id}`}
                              >
                                + Add Item
                              </button>
                              {sizeIngredients.length === 0 && templateSizes.filter(s => s.id !== size.id && (template.ingredients || []).some(i => i.size_id === s.id)).length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleCopyFromSize(template, size.id, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  disabled={copying}
                                  className="text-xs px-2 py-1 rounded border"
                                  style={{ borderColor: colors.gold, color: colors.brownLight }}
                                  data-testid={`select-copy-${size.id}`}
                                >
                                  <option value="">Copy from...</option>
                                  {templateSizes
                                    .filter(s => s.id !== size.id && (template.ingredients || []).some(i => i.size_id === s.id))
                                    .map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))
                                  }
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Size button */}
                    <Popover open={addingSizeFor === template.id} onOpenChange={(open) => {
                      setAddingSizeFor(open ? template.id : null);
                      if (!open) {
                        setCreatingSize(false);
                        setNewSizeName('');
                        setNewSizeOz('');
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <button
                          className="rounded-lg p-3 border-2 border-dashed flex flex-col items-center justify-center gap-2 min-h-[80px] transition-colors hover:border-solid"
                          style={{ borderColor: colors.gold, color: colors.brownLight }}
                          data-testid={`button-add-size-${template.id}`}
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-sm font-medium">Add Size</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        {creatingSize ? (
                          <div className="p-3 space-y-2">
                            <p className="text-sm font-semibold" style={{ color: colors.brown }}>New Size</p>
                            <input
                              type="text"
                              placeholder="Name (e.g., 24oz Cold, Small Box)"
                              value={newSizeName}
                              onChange={(e) => setNewSizeName(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border text-sm"
                              style={{ borderColor: colors.gold }}
                              autoFocus
                              data-testid="input-new-size-name"
                            />
                            <input
                              type="number"
                              placeholder="Size (oz) — 0 for non-drinks"
                              value={newSizeOz}
                              onChange={(e) => setNewSizeOz(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border text-sm"
                              style={{ borderColor: colors.gold }}
                              data-testid="input-new-size-oz"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!newSizeName.trim()) return;
                                  try {
                                    const newId = await onAddDrinkSize({
                                      name: newSizeName.trim(),
                                      size_oz: parseFloat(newSizeOz) || 0,
                                      drink_type: template.drink_type,
                                    });
                                    setPendingSizes(prev => ({
                                      ...prev,
                                      [template.id]: [...(prev[template.id] || []), newId],
                                    }));
                                    setAddingSizeFor(null);
                                    setCreatingSize(false);
                                    setNewSizeName('');
                                    setNewSizeOz('');
                                  } catch (err: any) {
                                    alert('Error creating size: ' + err.message);
                                  }
                                }}
                                className="flex-1 px-2 py-1.5 rounded text-sm font-medium"
                                style={{ backgroundColor: colors.gold, color: colors.brown }}
                                data-testid="button-save-new-size"
                              >
                                Create
                              </button>
                              <button
                                onClick={() => {
                                  setCreatingSize(false);
                                  setNewSizeName('');
                                  setNewSizeOz('');
                                }}
                                className="flex-1 px-2 py-1.5 rounded text-sm font-medium"
                                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                              >
                                Back
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-1">
                            {(() => {
                              const matchingType = drinkSizes.filter(s =>
                                (s.drink_type || '').toLowerCase() === (template.drink_type || '').toLowerCase()
                                && !allShownSizeIds.includes(s.id)
                              );
                              const otherSizes = drinkSizes.filter(s =>
                                (s.drink_type || '').toLowerCase() !== (template.drink_type || '').toLowerCase()
                                && !allShownSizeIds.includes(s.id)
                                && s.drink_type !== 'bulk'
                              );

                              return (
                                <>
                                  {matchingType.length > 0 && (
                                    <>
                                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.brownLight }}>
                                        {template.drink_type} sizes
                                      </p>
                                      {matchingType.map(size => (
                                        <button
                                          key={size.id}
                                          onClick={() => {
                                            setPendingSizes(prev => ({
                                              ...prev,
                                              [template.id]: [...(prev[template.id] || []), size.id],
                                            }));
                                            setAddingSizeFor(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                                          style={{ color: colors.brown }}
                                          data-testid={`option-size-${size.id}`}
                                        >
                                          {size.name}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {otherSizes.length > 0 && (
                                    <>
                                      <div className="border-t my-1" style={{ borderColor: colors.creamDark }} />
                                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.brownLight }}>
                                        Other sizes
                                      </p>
                                      {otherSizes.map(size => (
                                        <button
                                          key={size.id}
                                          onClick={() => {
                                            setPendingSizes(prev => ({
                                              ...prev,
                                              [template.id]: [...(prev[template.id] || []), size.id],
                                            }));
                                            setAddingSizeFor(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                                          style={{ color: colors.brown }}
                                          data-testid={`option-size-${size.id}`}
                                        >
                                          {size.name} <span className="text-xs" style={{ color: colors.brownLight }}>({size.drink_type})</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {matchingType.length === 0 && otherSizes.length === 0 && (
                                    <p className="px-3 py-2 text-sm" style={{ color: colors.brownLight }}>
                                      No more existing sizes available.
                                    </p>
                                  )}
                                  <div className="border-t my-1" style={{ borderColor: colors.creamDark }} />
                                  <button
                                    onClick={() => setCreatingSize(true)}
                                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-black/5 transition-colors flex items-center gap-2"
                                    style={{ color: colors.gold }}
                                    data-testid="button-create-new-size"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Create new size
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {baseTemplates.length === 0 && (
          <div className="text-center py-10">
            <Layers className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No base templates yet</h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Create base templates to define shared ingredient foundations across your recipes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

interface VendorsTabProps {
  ingredients: Ingredient[];
  recipeVendors: RecipeVendor[];
  tenantId: string;
  onUpdateIngredientCost: (id: string, cost: number) => Promise<void>;
  onAddVendor: (vendor: { tenant_id: string; name: string; phone?: string; email?: string; notes?: string }) => Promise<RecipeVendor>;
  onUpdateVendor: (id: string, updates: Partial<RecipeVendor>) => Promise<RecipeVendor>;
  onDeleteVendor: (id: string) => Promise<void>;
}

const VendorsTab = ({ ingredients, recipeVendors, tenantId, onUpdateIngredientCost, onAddVendor, onUpdateVendor, onDeleteVendor }: VendorsTabProps) => {
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState<string>('');
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<RecipeVendor | null>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const resetVendorForm = () => {
    setVendorForm({ name: '', phone: '', email: '', notes: '' });
    setEditingVendor(null);
    setShowVendorForm(false);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name.trim()) return;
    if (editingVendor) {
      await onUpdateVendor(editingVendor.id, {
        name: vendorForm.name.trim(),
        phone: vendorForm.phone.trim() || null,
        email: vendorForm.email.trim() || null,
        notes: vendorForm.notes.trim() || null,
      });
    } else {
      await onAddVendor({
        tenant_id: tenantId,
        name: vendorForm.name.trim(),
        phone: vendorForm.phone.trim() || undefined,
        email: vendorForm.email.trim() || undefined,
        notes: vendorForm.notes.trim() || undefined,
      });
    }
    resetVendorForm();
  };

  const openEditVendor = (vendor: RecipeVendor) => {
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name,
      phone: vendor.phone || '',
      email: vendor.email || '',
      notes: vendor.notes || '',
    });
    setShowVendorForm(true);
  };

  const vendors = Array.from(new Set(ingredients.map(i => i.vendor).filter(Boolean))) as string[];
  
  const vendorData = vendors.map(vendor => {
    const vendorIngredients = ingredients.filter(i => i.vendor === vendor);
    const totalValue = vendorIngredients.reduce((sum, ing) => sum + (Number(ing.cost) || 0), 0);
    return {
      name: vendor,
      ingredients: vendorIngredients,
      itemCount: vendorIngredients.length,
      totalValue,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const displayedVendors = selectedVendor === 'all' 
    ? vendorData 
    : vendorData.filter(v => v.name === selectedVendor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: colors.brown }}>Vendor:</span>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 outline-none"
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="select-vendor-filter"
          >
            <option value="all">All Vendors ({vendors.length})</option>
            {vendors.sort().map(vendor => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>
        </div>
        <div className="text-sm" style={{ color: colors.brownLight }}>
          {ingredients.filter(i => !i.vendor).length > 0 && (
            <span>{ingredients.filter(i => !i.vendor).length} items without vendor</span>
          )}
        </div>
      </div>

      {/* Vendor Profiles Section */}
      <div className="rounded-xl shadow-md overflow-hidden" style={{ backgroundColor: colors.white }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: colors.brown }}>
          <h3 className="font-bold text-white">Vendor Profiles</h3>
          <button
            onClick={() => { resetVendorForm(); setShowVendorForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: colors.gold, color: colors.brown }}
            data-testid="button-add-vendor"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Vendor
          </button>
        </div>
        <div className="p-4">
          {showVendorForm && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
              <h4 className="font-semibold mb-3" style={{ color: colors.brown }}>
                {editingVendor ? 'Edit Vendor' : 'New Vendor'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Name *</label>
                  <input
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Vendor name"
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Phone</label>
                  <input
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-phone"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Email</label>
                  <input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="sales@vendor.com"
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Notes</label>
                  <input
                    value={vendorForm.notes}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Account #, rep name, delivery schedule..."
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-notes"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveVendor}
                  disabled={!vendorForm.name.trim()}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-save-vendor"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingVendor ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={resetVendorForm}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ color: colors.brownLight }}
                  data-testid="button-cancel-vendor"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {recipeVendors.length === 0 && !showVendorForm ? (
            <div className="text-center py-6">
              <Truck className="w-8 h-8 mx-auto mb-2" style={{ color: colors.brownLight }} />
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Add vendor profiles to store contact info, account numbers, and notes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipeVendors.map(vendor => {
                const vendorIngredientCount = ingredients.filter(i => i.vendor === vendor.name).length;
                return (
                  <div
                    key={vendor.id}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: colors.creamDark }}
                    data-testid={`vendor-profile-${vendor.id}`}
                  >
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedProfile(expandedProfile === vendor.id ? null : vendor.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: colors.cream, color: colors.brown }}>
                          {vendor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: colors.brown }}>{vendor.name}</div>
                          {vendorIngredientCount > 0 && (
                            <div className="text-xs" style={{ color: colors.brownLight }}>{vendorIngredientCount} ingredients</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {vendor.phone && <Phone className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />}
                        {vendor.email && <Mail className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />}
                        {vendor.notes && <FileText className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />}
                      </div>
                    </button>

                    {expandedProfile === vendor.id && (
                      <div className="px-4 pb-3 pt-1 space-y-2" style={{ borderTop: `1px solid ${colors.cream}` }}>
                        {vendor.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                            <a href={`tel:${vendor.phone}`} className="hover:underline" style={{ color: colors.brown }}>{vendor.phone}</a>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                            <a href={`mailto:${vendor.email}`} className="hover:underline" style={{ color: colors.brown }}>{vendor.email}</a>
                          </div>
                        )}
                        {vendor.notes && (
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-3.5 h-3.5 mt-0.5" style={{ color: colors.brownLight }} />
                            <span style={{ color: colors.brownLight }}>{vendor.notes}</span>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => openEditVendor(vendor)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium"
                            style={{ backgroundColor: colors.cream, color: colors.brown }}
                            data-testid={`button-edit-vendor-${vendor.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteVendor(vendor.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium hover:bg-red-50"
                            style={{ color: '#ef4444' }}
                            data-testid={`button-delete-vendor-${vendor.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {displayedVendors.map(vendor => (
          <div
            key={vendor.name}
            className="rounded-xl shadow-md overflow-hidden"
            style={{ backgroundColor: colors.white }}
            data-testid={`card-vendor-${vendor.name}`}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: colors.brown }}
            >
              <div>
                <h3 className="font-bold text-white">{vendor.name}</h3>
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span>{vendor.itemCount} items</span>
                  {(() => {
                    const profile = recipeVendors.find(v => v.name === vendor.name);
                    if (!profile) return null;
                    return (
                      <>
                        {profile.phone && (
                          <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:text-white/90">
                            <Phone className="w-3 h-3" /> {profile.phone}
                          </a>
                        )}
                        {profile.email && (
                          <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:text-white/90">
                            <Mail className="w-3 h-3" /> {profile.email}
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white/60">Total Spend</div>
                <div className="font-bold font-mono text-white">
                  {formatCurrency(vendor.totalValue)}
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.creamDark}` }}>
                    <th className="py-2 px-2 text-left font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Product</th>
                    <th className="py-2 px-2 text-left font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Category</th>
                    <th className="py-2 px-2 text-right font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Cost</th>
                    <th className="py-2 px-2 text-right font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Quantity</th>
                    <th className="py-2 px-2 text-left font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Item #</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.ingredients.map(ing => (
                    <tr
                      key={ing.id}
                      style={{ borderBottom: `1px solid ${colors.cream}` }}
                      data-testid={`row-vendor-item-${ing.id}`}
                    >
                      <td className="py-2 font-medium" style={{ color: colors.brown }}>{ing.name}</td>
                      <td className="py-2" style={{ color: colors.brownLight }}>{ing.category_name}</td>
                      <td className="py-2 text-right font-mono" style={{ color: colors.brown }}>
                        {editingCost === ing.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editCostValue}
                            onChange={(e) => setEditCostValue(e.target.value)}
                            onBlur={async () => {
                              const newCost = parseFloat(editCostValue);
                              if (!isNaN(newCost) && newCost !== Number(ing.cost)) {
                                await onUpdateIngredientCost(ing.id, newCost);
                              }
                              setEditingCost(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const newCost = parseFloat(editCostValue);
                                if (!isNaN(newCost) && newCost !== Number(ing.cost)) {
                                  await onUpdateIngredientCost(ing.id, newCost);
                                }
                                setEditingCost(null);
                              } else if (e.key === 'Escape') {
                                setEditingCost(null);
                              }
                            }}
                            autoFocus
                            className="w-20 px-2 py-1 text-right rounded border"
                            style={{ borderColor: colors.gold, backgroundColor: colors.inputBg }}
                            data-testid={`input-cost-${ing.id}`}
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingCost(ing.id);
                              setEditCostValue(String(ing.cost || 0));
                            }}
                            className="hover:underline cursor-pointer"
                            style={{ color: colors.brown }}
                            data-testid={`button-edit-cost-${ing.id}`}
                          >
                            {formatCurrency(ing.cost)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono" style={{ color: colors.brownLight }}>
                        {ing.quantity} {ing.unit}
                      </td>
                      <td className="py-2" style={{ color: colors.brownLight }}>
                        {ing.item_number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {displayedVendors.length === 0 && (
          <div className="text-center py-10">
            <Truck className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No vendors found</h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Add vendor information to your ingredients to see them grouped here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const activeTab = new URLSearchParams(searchString).get('tab') || 'pricing';
  const setActiveTab = useCallback((tab: string) => {
    setLocation(`/recipe-costing?tab=${tab}`);
  }, [setLocation]);
  const queryClient = useQueryClient();
  const { profile, tenant, branding, primaryTenant, adminViewingTenant } = useAuth();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  
  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const { data: ingredientCategories = [], isLoading: loadingCategories, isError: errorCategories } = useIngredientCategories();
  const { data: ingredients = [], isLoading: loadingIngredients, isError: errorIngredients } = useIngredients();
  const { data: productCategories = [], isLoading: loadingProductCategories, isError: errorProductCategories } = useProductCategories();
  const { data: baseTemplates = [], isLoading: loadingBaseTemplates, isError: errorBaseTemplates } = useBaseTemplates();
  const { data: drinkSizes = [], isLoading: loadingDrinkSizes, isError: errorDrinkSizes } = useDrinkSizes();
  const { data: recipes = [], isLoading: loadingRecipes, isError: errorRecipes } = useRecipes();
  const { data: overhead, isLoading: loadingOverhead, isError: errorOverhead } = useOverhead();
  const { data: overheadItems = [], isLoading: loadingOverheadItems, isError: errorOverheadItems } = useOverheadItems();
  const { data: pricingData = [], isLoading: loadingPricing, isError: errorPricing } = useRecipePricing();
  const { data: recipeSizeBases = [], isLoading: loadingRecipeSizeBases, isError: errorRecipeSizeBases } = useRecipeSizeBases();
  const { data: cashActivity = [] } = useCashActivityRevenue();
  const { data: recipeVendors = [] } = useRecipeVendors();
  const addVendorMutation = useAddRecipeVendor();
  const updateVendorMutation = useUpdateRecipeVendor();
  const deleteVendorMutation = useDeleteRecipeVendor();

  // Calculate cost per minute from overhead items
  const calculatedCostPerMinute = useMemo(() => {
    const operatingDays = Math.max(1, overhead?.operating_days_per_week || 7);
    const hoursPerDay = Math.max(1, overhead?.hours_open_per_day || 8);
    const weeksPerMonth = 4.33;
    const daysPerMonth = operatingDays * weeksPerMonth;
    const minutesPerMonth = hoursPerDay * 60 * daysPerMonth;
    
    // Calculate monthly total from overhead items
    const monthlyTotal = (overheadItems as OverheadItem[]).reduce((total, item) => {
      let monthlyAmount = 0;
      const amount = Number(item.amount) || 0;
      switch (item.frequency) {
        case 'daily': monthlyAmount = amount * daysPerMonth; break;
        case 'weekly': monthlyAmount = amount * weeksPerMonth; break;
        case 'bi-weekly': monthlyAmount = amount * (weeksPerMonth / 2); break;
        case 'monthly': monthlyAmount = amount; break;
        case 'quarterly': monthlyAmount = amount / 3; break;
        case 'annual': monthlyAmount = amount / 12; break;
      }
      return total + monthlyAmount;
    }, 0);
    
    return minutesPerMonth > 0 ? monthlyTotal / minutesPerMonth : 0;
  }, [overhead?.operating_days_per_week, overhead?.hours_open_per_day, overheadItems]);

  // Create enhanced overhead with calculated cost per minute
  // Always use calculated value from overhead items (even if 0)
  const enhancedOverhead = useMemo(() => {
    if (!overhead) return overhead;
    return {
      ...overhead,
      cost_per_minute: calculatedCostPerMinute,
    };
  }, [overhead, calculatedCostPerMinute]);

  // Calculate average gross daily revenue from cash deposits (excluding outliers)
  const includedCashDays = useMemo(() => cashActivity.filter((e: any) => !e.excluded_from_average), [cashActivity]);
  const avgDailyRevenue = useMemo(() => {
    if (includedCashDays.length === 0) return 0;
    const total = includedCashDays.reduce((sum: number, entry: any) => sum + (Number(entry.gross_revenue) || 0), 0);
    return total / includedCashDays.length;
  }, [includedCashDays]);

  const updateIngredientMutation = useUpdateIngredient();
  const addIngredientMutation = useAddIngredient();
  const updateOverheadMutation = useUpdateOverhead();
  const addOverheadItemMutation = useAddOverheadItem();
  const updateOverheadItemMutation = useUpdateOverheadItem();
  const deleteOverheadItemMutation = useDeleteOverheadItem();
  const updateRecipePricingMutation = useUpdateRecipePricing();
  const updateRecipeSizeBaseMutation = useUpdateRecipeSizeBase();

  const loading = loadingCategories || loadingIngredients || loadingProductCategories || 
                  loadingBaseTemplates || loadingDrinkSizes || loadingRecipes || 
                  loadingOverhead || loadingPricing || loadingRecipeSizeBases;

  const hasError = errorCategories || errorIngredients || errorProductCategories || 
                   errorBaseTemplates || errorDrinkSizes || errorRecipes || 
                   errorOverhead || errorPricing || errorRecipeSizeBases;

  const handleUpdateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    try {
      await updateIngredientMutation.mutateAsync({ id, updates: updates as Record<string, any> });
    } catch (error: any) {
      alert('Error updating ingredient: ' + error.message);
      throw error;
    }
  };

  const handleAddIngredient = async (ingredient: Partial<Ingredient>) => {
    try {
      await addIngredientMutation.mutateAsync({ ...ingredient, tenant_id: profile?.tenant_id } as Record<string, any>);
    } catch (error: any) {
      alert('Error adding ingredient: ' + error.message);
    }
  };

  const handleUpdateIngredientCost = async (id: string, cost: number) => {
    await handleUpdateIngredient(id, { cost });
  };

  const handleUpdateOverhead = async (updates: Partial<OverheadSettings>) => {
    try {
      if (!overhead?.id) return;
      await updateOverheadMutation.mutateAsync({ id: overhead.id, updates });
    } catch (error: any) {
      alert('Error updating overhead: ' + error.message);
    }
  };

  const handleAddOverheadItem = async (item: { name: string; amount: number; frequency: string }) => {
    try {
      if (!profile?.tenant_id) return;
      await addOverheadItemMutation.mutateAsync({
        ...item,
        tenant_id: profile.tenant_id,
        sort_order: overheadItems.length,
      });
    } catch (error: any) {
      alert('Error adding overhead item: ' + error.message);
    }
  };

  const handleUpdateOverheadItem = async (id: string, updates: { name?: string; amount?: number; frequency?: string }) => {
    try {
      await updateOverheadItemMutation.mutateAsync({ id, updates });
    } catch (error: any) {
      alert('Error updating overhead item: ' + error.message);
    }
  };

  const handleDeleteOverheadItem = async (id: string) => {
    try {
      await deleteOverheadItemMutation.mutateAsync(id);
    } catch (error: any) {
      alert('Error deleting overhead item: ' + error.message);
    }
  };

  const handleUpdatePricing = async (recipeId: string, sizeId: string, salePrice: number) => {
    try {
      const existing = pricingData.find(p => p.recipe_id === recipeId && p.size_id === sizeId);
      await updateRecipePricingMutation.mutateAsync({
        recipeId,
        sizeId,
        salePrice,
        existingId: existing?.id,
      });
    } catch (error: any) {
      alert('Error updating price: ' + error.message);
    }
  };

  const handleUpdateRecipeSizeBase = async (recipeId: string, sizeId: string, baseTemplateId: string | null) => {
    try {
      const existing = recipeSizeBases.find(rsb => rsb.recipe_id === recipeId && rsb.size_id === sizeId);
      await updateRecipeSizeBaseMutation.mutateAsync({
        recipeId,
        sizeId,
        baseTemplateId,
        existingId: existing?.id,
      });
    } catch (error: any) {
      alert('Error updating base: ' + error.message);
    }
  };

  const invalidateRecipeData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
    queryClient.invalidateQueries({ queryKey: queryKeys.recipePricing });
    queryClient.invalidateQueries({ queryKey: queryKeys.recipeSizeBases });
  };

  const handleDuplicateRecipe = async (recipe: Recipe) => {
    try {
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: `${recipe.name} (Copy)`,
          category_id: recipe.category_id,
          base_template_id: recipe.base_template_id || null,
          is_active: true,
          is_bulk_recipe: recipe.is_bulk_recipe || false,
          minutes_per_drink: recipe.minutes_per_drink ?? null,
          tenant_id: profile?.tenant_id,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      if (recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0) {
        const ingredientInserts = recipe.recipe_ingredients.map(ri => ({
          recipe_id: newRecipe.id,
          ingredient_id: ri.ingredient_id || null,
          syrup_recipe_id: ri.syrup_recipe_id || null,
          size_id: ri.size_id,
          quantity: ri.quantity,
          unit: ri.unit,
        }));
        const { error: ingError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientInserts);
        if (ingError) throw ingError;
      }

      const recipeBases = recipeSizeBases.filter(rsb => rsb.recipe_id === recipe.id);
      if (recipeBases.length > 0) {
        const baseInserts = recipeBases.map(rsb => ({
          recipe_id: newRecipe.id,
          size_id: rsb.size_id,
          base_template_id: rsb.base_template_id,
        }));
        const { error: baseError } = await supabase
          .from('recipe_size_bases')
          .insert(baseInserts);
        if (baseError) throw baseError;
      }

      invalidateRecipeData();
    } catch (error: any) {
      alert('Error duplicating recipe: ' + error.message);
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    const name = recipes.find(r => r.id === recipeId)?.name || 'this recipe';
    if (!await confirm({ title: `Delete ${name}?`, description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' })) {
      return;
    }
    try {
      // Delete recipe ingredients where this recipe IS the recipe
      const { error: ingError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      if (ingError) throw ingError;
      
      // Also delete recipe ingredients where this recipe is used AS a syrup/bulk ingredient in other recipes
      const { error: syrupIngError } = await supabase.from('recipe_ingredients').delete().eq('syrup_recipe_id', recipeId);
      if (syrupIngError) throw syrupIngError;
      
      const { error: baseError } = await supabase.from('recipe_size_bases').delete().eq('recipe_id', recipeId);
      if (baseError) throw baseError;
      
      const { error: pricingError } = await supabase.from('recipe_size_pricing').delete().eq('recipe_id', recipeId);
      if (pricingError) throw pricingError;
      
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (error) throw error;
      invalidateRecipeData();
      showDeleteUndoToast({
        itemName: name,
        undo: { type: 'none' },
      });
    } catch (error: any) {
      alert('Error deleting recipe: ' + error.message);
    }
  };

  const handleAddRecipe = async (recipe: { name: string; category_id: string; base_template_id?: string; is_bulk_recipe?: boolean }) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .insert({
          name: recipe.name,
          category_id: recipe.category_id,
          base_template_id: recipe.base_template_id || null,
          is_active: true,
          is_bulk_recipe: recipe.is_bulk_recipe || false,
          tenant_id: profile?.tenant_id,
        });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
    } catch (error: any) {
      alert('Error adding recipe: ' + error.message);
    }
  };

  const handleUpdateRecipe = async (id: string, updates: { name?: string; category_id?: string; base_template_id?: string | null; is_bulk_recipe?: boolean; minutes_per_drink?: number | null }) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
    } catch (error: any) {
      alert('Error updating recipe: ' + error.message);
    }
  };

  const handleAddBulkSize = async (name: string, oz: number): Promise<boolean> => {
    try {
      const { data: maxOrder } = await supabase
        .from('drink_sizes')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
      const nextOrder = (maxOrder?.[0]?.display_order || 0) + 1;
      
      const { error } = await supabase
        .from('drink_sizes')
        .insert({ name, size_oz: oz, display_order: nextOrder, drink_type: 'bulk', tenant_id: profile?.tenant_id });

      if (error) {
        console.error('Supabase error adding bulk size:', error);
        alert('Error adding bulk size: ' + error.message + '\n\nMake sure your Supabase RLS policies allow inserts on the drink_sizes table.');
        return false;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.drinkSizes });
      return true;
    } catch (error: any) {
      console.error('Error in handleAddBulkSize:', error);
      alert('Error adding bulk size: ' + error.message);
      return false;
    }
  };

  const handleDeleteBulkSize = async (sizeId: string) => {
    const name = drinkSizes.find(s => s.id === sizeId)?.name || 'this batch size';
    if (!await confirm({ title: `Delete ${name}?`, description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' })) return;
    try {
      const { error: ingredientError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('size_id', sizeId);

      if (ingredientError) {
        console.error('Error deleting associated ingredients:', ingredientError);
        alert('Error removing ingredients for this size: ' + ingredientError.message);
        return;
      }

      const { error } = await supabase
        .from('drink_sizes')
        .delete()
        .eq('id', sizeId);

      if (error) {
        console.error('Supabase error deleting bulk size:', error);
        alert('Error deleting bulk size: ' + error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.drinkSizes });
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
      showDeleteUndoToast({ itemName: name, undo: { type: 'none' } });
    } catch (error: any) {
      console.error('Error in handleDeleteBulkSize:', error);
      alert('Error deleting bulk size: ' + error.message);
    }
  };

  const handleAddDrinkSize = async (size: { name: string; size_oz: number; drink_type: string }): Promise<string> => {
    const { data: maxOrder } = await supabase
      .from('drink_sizes')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    const nextOrder = (maxOrder?.[0]?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('drink_sizes')
      .insert({ name: size.name, size_oz: size.size_oz, display_order: nextOrder, drink_type: size.drink_type, tenant_id: profile?.tenant_id })
      .select('id')
      .single();

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: queryKeys.drinkSizes });
    return data.id;
  };

  const handleRemoveTemplateSize = async (templateId: string, sizeId: string) => {
    const { error } = await supabase
      .from('base_template_ingredients')
      .delete()
      .eq('base_template_id', templateId)
      .eq('size_id', sizeId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: queryKeys.baseTemplates });
  };

  const handleAddBaseTemplate = async (template: { name: string; drink_type: string; description?: string }) => {
    try {
      // Get tenant_id from an existing base_template since profile may not be loaded
      let tenantId = profile?.tenant_id;
      if (!tenantId) {
        const { data: existingTemplates } = await supabase
          .from('base_templates')
          .select('tenant_id')
          .limit(1);
        tenantId = existingTemplates?.[0]?.tenant_id;
      }
      
      if (!tenantId) {
        alert('Unable to determine your tenant. Please refresh the page and try again.');
        return;
      }

      const { error } = await supabase
        .from('base_templates')
        .insert({
          name: template.name,
          drink_type: template.drink_type,
          description: template.description || null,
          is_active: true,
          tenant_id: tenantId,
        });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.baseTemplates });
    } catch (error: any) {
      console.error('Error adding base template:', error);
      alert('Error adding base template: ' + error.message);
    }
  };

  const handleAddTemplateIngredient = async (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number; unit?: string }) => {
    try {
      const { error } = await supabase
        .from('base_template_ingredients')
        .insert({
          base_template_id: ingredient.base_template_id,
          ingredient_id: ingredient.ingredient_id,
          size_id: ingredient.size_id,
          quantity: ingredient.quantity,
          unit: ingredient.unit || 'each',
        });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.baseTemplates });
    } catch (error: any) {
      alert('Error adding template ingredient: ' + error.message);
    }
  };

  const handleDeleteTemplateIngredient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('base_template_ingredients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.baseTemplates });
    } catch (error: any) {
      alert('Error deleting template ingredient: ' + error.message);
    }
  };

  const handleDeleteBaseTemplate = async (id: string) => {
    const name = baseTemplates.find(t => t.id === id)?.name || 'this base template';
    if (!await confirm({ title: `Delete ${name}?`, description: 'This will also remove all its ingredients.', confirmLabel: 'Delete', variant: 'destructive' })) {
      return;
    }
    try {
      // Delete the template - cascade will handle ingredients (migration 053 required)
      const { error } = await supabase
        .from('base_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.baseTemplates });
      showDeleteUndoToast({ itemName: name, undo: { type: 'none' } });
    } catch (error: any) {
      console.error('Error deleting base template:', error);
      alert('Error deleting base template: ' + error.message);
    }
  };

  const handleAddRecipeIngredient = async (ingredient: { recipe_id: string; ingredient_id?: string | null; size_id: string; quantity: number; unit?: string; syrup_recipe_id?: string | null }) => {
    try {
      const insertData: Record<string, any> = {
        recipe_id: ingredient.recipe_id,
        size_id: ingredient.size_id,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      };
      if (ingredient.ingredient_id) {
        insertData.ingredient_id = ingredient.ingredient_id;
      }
      if (ingredient.syrup_recipe_id) {
        insertData.syrup_recipe_id = ingredient.syrup_recipe_id;
      }
      
      const { error } = await supabase
        .from('recipe_ingredients')
        .insert(insertData);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
    } catch (error: any) {
      alert('Error adding recipe ingredient: ' + error.message);
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    const ingredient = ingredients.find(i => i.id === id);
    const name = ingredient?.name || 'this ingredient';
    if (!await confirm({ title: `Delete ${name}?`, description: 'This cannot be undone.', confirmLabel: 'Delete', variant: 'destructive' })) return;
    try {
      // Strip view-computed columns (category_name, cost_per_unit, cost_per_usage_unit) that don't exist on the ingredients table
      // Ensure tenant_id is included since v_ingredients view may not return it
      const savedData = ingredient ? (() => {
        const { category_name, cost_per_unit, cost_per_usage_unit, ...tableColumns } = ingredient as Record<string, unknown>;
        return { ...tableColumns, tenant_id: tableColumns.tenant_id || profile?.tenant_id };
      })() : null;
      const { error } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredients });
      showDeleteUndoToast({
        itemName: name,
        undo: savedData
          ? { type: 'reinsert', table: 'ingredients', data: savedData }
          : { type: 'none' },
        invalidateKeys: [queryKeys.ingredients],
      });
    } catch (error: any) {
      alert('Error deleting ingredient: ' + error.message);
    }
  };

  const handleDeleteRecipeIngredient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
    } catch (error: any) {
      alert('Error deleting recipe ingredient: ' + error.message);
    }
  };

  if (loading) {
    return <CoffeeLoader fullScreen text="Brewing..." />;
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center p-8 rounded-lg max-w-md" style={{ backgroundColor: colors.white }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: colors.brown }}>Connection Issue</h2>
          <p className="mb-4" style={{ color: colors.brownLight }}>
            Unable to load Recipe Cost Manager data. This could be:
          </p>
          <ul className="text-left mb-4 text-sm space-y-1" style={{ color: colors.brownLight }}>
            <li>• Recipe Costing tables may not exist in database</li>
            <li>• Network connectivity issue</li>
            <li>• Supabase project may need configuration</li>
          </ul>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 rounded-lg font-semibold"
            style={{ backgroundColor: colors.gold, color: colors.white }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
            Recipe Cost Manager
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • {orgName}
            </p>
          )}
        </div>
      </header>

      <div className="px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1 border-b-2 flex-wrap" style={{ borderColor: colors.creamDark }}>
            <TabButton active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')}>
              Pricing Matrix
            </TabButton>
            <TabButton active={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')}>
              Ingredients
            </TabButton>
            {!adminViewingTenant && (
              <TabButton active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')}>
                Recipes
              </TabButton>
            )}
            <TabButton active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')}>
              Vendors
            </TabButton>
            <TabButton active={activeTab === 'bases'} onClick={() => setActiveTab('bases')}>
              Bases
            </TabButton>
            <TabButton active={activeTab === 'overhead'} onClick={() => setActiveTab('overhead')}>
              Overhead
            </TabButton>
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              Settings
            </TabButton>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'ingredients' && (
          <IngredientsTab
            ingredients={ingredients}
            categories={ingredientCategories}
            onUpdate={handleUpdateIngredient}
            onAdd={handleAddIngredient}
            onDelete={handleDeleteIngredient}
          />
        )}
        {activeTab === 'vendors' && (
          <VendorsTab
            ingredients={ingredients}
            recipeVendors={recipeVendors}
            tenantId={tenant?.id || ''}
            onUpdateIngredientCost={handleUpdateIngredientCost}
            onAddVendor={async (v) => { const result = await addVendorMutation.mutateAsync(v); return result; }}
            onUpdateVendor={async (id, updates) => { const result = await updateVendorMutation.mutateAsync({ id, updates }); return result; }}
            onDeleteVendor={async (id) => { await deleteVendorMutation.mutateAsync(id); }}
          />
        )}
        {activeTab === 'bases' && (
          <BaseTemplatesTab
            baseTemplates={baseTemplates}
            ingredients={ingredients}
            drinkSizes={drinkSizes}
            onAddTemplate={handleAddBaseTemplate}
            onAddTemplateIngredient={handleAddTemplateIngredient}
            onDeleteTemplateIngredient={handleDeleteTemplateIngredient}
            onDeleteTemplate={handleDeleteBaseTemplate}
            onAddDrinkSize={handleAddDrinkSize}
            onRemoveTemplateSize={handleRemoveTemplateSize}
          />
        )}
        {activeTab === 'recipes' && !adminViewingTenant && (
          <RecipesTab
            recipes={recipes}
            ingredients={ingredients}
            productCategories={productCategories}
            baseTemplates={baseTemplates}
            drinkSizes={drinkSizes}
            overhead={enhancedOverhead}
            recipeSizeBases={recipeSizeBases}
            onAddRecipe={handleAddRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            onAddRecipeIngredient={handleAddRecipeIngredient}
            onDeleteRecipeIngredient={handleDeleteRecipeIngredient}
            onUpdateRecipeSizeBase={handleUpdateRecipeSizeBase}
            onDuplicateRecipe={handleDuplicateRecipe}
            onDeleteRecipe={handleDeleteRecipe}
            onAddBulkSize={handleAddBulkSize}
            onDeleteBulkSize={handleDeleteBulkSize}
          />
        )}
        {activeTab === 'pricing' && (
          <PricingTab
            recipes={recipes}
            ingredients={ingredients}
            baseTemplates={baseTemplates}
            drinkSizes={drinkSizes}
            overhead={enhancedOverhead}
            pricingData={pricingData}
            recipeSizeBases={recipeSizeBases}
            onUpdatePricing={handleUpdatePricing}
          />
        )}
        {activeTab === 'overhead' && (
          <OverheadTab
            overhead={enhancedOverhead}
            overheadItems={overheadItems as OverheadItem[]}
            avgDailyRevenue={avgDailyRevenue}
            cashDayCount={includedCashDays.length}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            overhead={enhancedOverhead}
            onUpdateOverhead={handleUpdateOverhead}
            ingredients={ingredients}
            recipes={recipes}
            drinkSizes={drinkSizes}
            baseTemplates={baseTemplates}
            recipeSizeBases={recipeSizeBases}
            recipePricing={pricingData}
          />
        )}
      </main>
      {ConfirmDialog}
    </div>
  );
}
