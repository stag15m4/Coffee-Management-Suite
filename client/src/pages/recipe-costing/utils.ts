export const formatCurrency = (value: number | string) => {
  const num = parseFloat(String(value)) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatPercent = (value: number | string) => {
  const num = parseFloat(String(value)) || 0;
  return `${num.toFixed(1)}%`;
};

export const pluralizeType = (type: string) => {
  if (type === 'Supply') return 'Supplies';
  if (type === 'Merchandise') return 'Merchandise';
  return type + 's';
};

export const isOlderThan3Months = (dateStr?: string): boolean => {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return date < threeMonthsAgo;
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const unitConversions: Record<string, Record<string, number>> = {
  oz: { g: 28.3495, grams: 28.3495, gram: 28.3495, oz: 1, ml: 29.5735 },
  lb: { oz: 16, g: 453.592, grams: 453.592, gram: 453.592, lb: 1 },
  gal: { oz: 128, ml: 3785.41, l: 3.78541, gal: 1 },
  l: { ml: 1000, oz: 33.814, l: 1 },
  kg: { g: 1000, grams: 1000, gram: 1000, oz: 35.274, lb: 2.20462, kg: 1 },
};

import type { ActualVolumeOverhead } from './types';

/**
 * Derives a real overhead-per-item rate from actual logged transaction
 * volume, instead of assuming the shop makes an item every `assumedMinutesPerItem`
 * minutes for its entire open time. `scalingFactor` rescales any theoretical
 * per-recipe overhead cost (cost_per_minute x that recipe's own prep
 * minutes) to match actual volume while preserving each recipe's relative
 * prep-time weighting.
 */
export const calculateActualVolumeOverhead = (params: {
  avgDailyTransactions: number;
  transactionDayCount: number;
  itemsPerTransaction: number;
  costPerMinute: number;
  hoursPerDay: number;
  assumedMinutesPerItem: number;
}): ActualVolumeOverhead | null => {
  const { avgDailyTransactions, transactionDayCount, costPerMinute, hoursPerDay } = params;
  if (avgDailyTransactions <= 0 || costPerMinute <= 0) return null;

  const itemsPerTransaction = Math.max(0.01, params.itemsPerTransaction || 1);
  const assumedMinutesPerItem = Math.max(0.01, params.assumedMinutesPerItem || 1);
  const minutesPerDay = hoursPerDay * 60;
  const itemsPerDay = avgDailyTransactions * itemsPerTransaction;
  const trueMinutesPerItem = itemsPerDay > 0 ? minutesPerDay / itemsPerDay : 0;
  const trueOverheadPerItem = costPerMinute * trueMinutesPerItem;
  const scalingFactor = trueMinutesPerItem / assumedMinutesPerItem;

  return {
    avgDailyTransactions,
    transactionDayCount,
    itemsPerTransaction,
    trueMinutesPerItem,
    trueOverheadPerItem,
    scalingFactor,
  };
};

/**
 * Backs sales tax out of a tax-inclusive menu price so margin/profit is
 * computed on real revenue, not on tax collected for the state. Only the
 * sale side is affected — ingredient cost is untouched, since sales tax is
 * charged to the customer, not paid by the business on its own COGS.
 */
export const getNetSalePrice = (
  salePrice: number,
  overhead: { prices_include_tax?: boolean; sales_tax_rate?: number } | null | undefined
): number => {
  if (!overhead?.prices_include_tax) return salePrice;
  const rate = Number(overhead.sales_tax_rate) || 0;
  if (rate <= 0) return salePrice;
  return salePrice / (1 + rate);
};

export const calculateCostPerUsageUnit = (
  cost: number,
  purchaseQty: number,
  purchaseUnit: string,
  usageUnit: string
): number | null => {
  if (!usageUnit || usageUnit === purchaseUnit) {
    return cost / purchaseQty;
  }

  const fromUnit = purchaseUnit.toLowerCase().trim();
  const toUnit = usageUnit.toLowerCase().trim();

  if (unitConversions[fromUnit] && unitConversions[fromUnit][toUnit]) {
    const conversionFactor = unitConversions[fromUnit][toUnit];
    const totalUsageUnits = purchaseQty * conversionFactor;
    return cost / totalUsageUnits;
  }

  return null;
};
