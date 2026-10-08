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

import type { ActualVolumeOverhead, Recipe, Ingredient, BaseTemplate, ProductSize, RecipeIngredient } from './types';

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

function getIngredientCostPerUnit(ing: Ingredient): number {
  const cost = typeof ing.cost === 'string' ? parseFloat(ing.cost) : ing.cost;
  const quantity = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : ing.quantity;
  if (!cost || !quantity) return 0;
  const usageUnit = ing.usage_unit || ing.unit;
  const costPerUnit = calculateCostPerUsageUnit(cost, quantity, ing.unit, usageUnit);
  return costPerUnit || cost / quantity;
}

/**
 * Pure ingredient cost for one (recipe, size) — ingredients plus any base
 * template's ingredients, deliberately excluding overhead entirely (unlike
 * the Pricing Matrix's cost, which folds overhead in). A syrup/bulk-recipe
 * ingredient is costed from its own raw ingredients only, not the overhead
 * the Pricing Matrix adds on top of it for a standalone syrup batch — this
 * is meant to estimate aggregate daily COGS, not reproduce per-drink
 * pricing, and double-counting overhead there would overstate it.
 */
function calculateIngredientOnlyCost(
  recipe: Recipe,
  sizeId: string,
  ctx: { recipes: Recipe[]; ingredients: Ingredient[]; baseTemplates: BaseTemplate[]; productSizes: ProductSize[] }
): number {
  let totalCost = 0;

  const getBulkRecipeCostPerOz = (bulkRecipeId: string): number => {
    const bulkRecipe = ctx.recipes.find((r) => r.id === bulkRecipeId);
    if (!bulkRecipe || !bulkRecipe.is_bulk_recipe) return 0;
    const bulkSizes = ctx.productSizes.filter((s) => s.name.toLowerCase().includes('bulk'));
    let cost = 0;
    let batchSizeOz = 0;
    for (const size of bulkSizes) {
      const sizeIngredients =
        bulkRecipe.recipe_ingredients?.filter((ri: RecipeIngredient) => ri.size_id === size.id) || [];
      if (sizeIngredients.length > 0) {
        batchSizeOz = size.size_value;
        for (const ri of sizeIngredients) {
          const ing = ctx.ingredients.find((i) => i.id === ri.ingredient_id);
          if (ing) cost += ri.quantity * getIngredientCostPerUnit(ing);
        }
        break;
      }
    }
    return batchSizeOz > 0 ? cost / batchSizeOz : 0;
  };

  const sizeIngredients = recipe.recipe_ingredients?.filter((ri) => ri.size_id === sizeId) || [];
  for (const ri of sizeIngredients) {
    if (ri.syrup_recipe_id) {
      totalCost += ri.quantity * getBulkRecipeCostPerOz(ri.syrup_recipe_id);
    } else if (ri.ingredient_id) {
      const ing = ctx.ingredients.find((i) => i.id === ri.ingredient_id);
      if (ing) totalCost += ri.quantity * getIngredientCostPerUnit(ing);
    }
  }

  return totalCost;
}

/**
 * Blended average ingredient-only cost across every non-bulk (recipe, size)
 * with a sale price set — the same "simple average across the menu"
 * methodology the Pricing Matrix's own Store Averages row already uses, so
 * this stays directly comparable to it. Used to estimate aggregate daily
 * COGS (this average x an estimated items/day) for the Overhead tab's true
 * profit figure, since no per-sale ingredient cost is tracked anywhere.
 */
export function estimateAverageIngredientCostPerItem(params: {
  recipes: Recipe[];
  ingredients: Ingredient[];
  baseTemplates: BaseTemplate[];
  recipeSizeBases: { recipe_id: string; size_id: string; base_template_id: string }[];
  productSizes: ProductSize[];
  pricingData: { recipe_id: string; size_id: string; sale_price: number }[];
}): { avgIngredientCost: number; sampleCount: number } {
  const { recipes, ingredients, baseTemplates, recipeSizeBases, productSizes, pricingData } = params;
  const nonBulkRecipes = recipes.filter((r) => !r.is_bulk_recipe);
  const ctx = { recipes, ingredients, baseTemplates, productSizes };

  const costs: number[] = [];
  for (const recipe of nonBulkRecipes) {
    for (const size of productSizes) {
      if (size.name.toLowerCase().includes('bulk')) continue;
      const pricing = pricingData.find((p) => p.recipe_id === recipe.id && p.size_id === size.id);
      if (!pricing || !(Number(pricing.sale_price) > 0)) continue;

      const hasDirectIngredients = (recipe.recipe_ingredients || []).some((ri) => ri.size_id === size.id);
      // Per-size override first, falling back to the recipe's own legacy
      // base_template_id — same precedence RecipeSettings/RecipesTab use —
      // so recipes that never got a recipe_size_bases row aren't silently
      // skipped here.
      const sizeBaseId =
        recipeSizeBases.find((rsb) => rsb.recipe_id === recipe.id && rsb.size_id === size.id)?.base_template_id ||
        recipe.base_template_id;
      const baseTemplate = sizeBaseId ? baseTemplates.find((bt) => bt.id === sizeBaseId) : null;
      const hasBaseIngredients = (baseTemplate?.ingredients || []).some((bi) => bi.size_id === size.id);
      if (!hasDirectIngredients && !hasBaseIngredients) continue;

      let cost = calculateIngredientOnlyCost(recipe, size.id, ctx);
      if (baseTemplate) {
        for (const bi of baseTemplate.ingredients || []) {
          if (bi.size_id !== size.id) continue;
          const ing = ingredients.find((i) => i.id === bi.ingredient_id);
          if (ing) cost += bi.quantity * getIngredientCostPerUnit(ing);
        }
      }
      costs.push(cost);
    }
  }

  if (costs.length === 0) return { avgIngredientCost: 0, sampleCount: 0 };
  return { avgIngredientCost: costs.reduce((a, b) => a + b, 0) / costs.length, sampleCount: costs.length };
}
