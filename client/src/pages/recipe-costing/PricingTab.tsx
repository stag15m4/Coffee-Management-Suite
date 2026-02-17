import { useState, Fragment } from 'react';
import { colors } from '@/lib/colors';
import { formatCurrency, formatPercent, calculateCostPerUsageUnit } from './utils';
import type {
  Recipe,
  Ingredient,
  BaseTemplate,
  ProductSize,
  OverheadSettings,
  RecipeSizePricing,
  RecipeIngredient,
} from './types';

interface PricingTabProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  baseTemplates: BaseTemplate[];
  productSizes: ProductSize[];
  overhead: OverheadSettings | null;
  pricingData: RecipeSizePricing[];
  recipeSizeBases: { id?: string; recipe_id: string; size_id: string; base_template_id: string }[];
  onUpdatePricing: (recipeId: string, sizeId: string, salePrice: number) => Promise<void>;
}

export const PricingTab = ({ recipes, ingredients, baseTemplates, productSizes, overhead, pricingData, recipeSizeBases, onUpdatePricing }: PricingTabProps) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Filter out bulk sizes and separate drink sizes from food sizes
  // Exclude bulk from both drink and food sizes
  const allDrinkTypeSizes = productSizes.filter(s =>
    !s.name.toLowerCase().includes('bulk') &&
    (!s.product_type || s.product_type.toLowerCase() !== 'food')
  );
  const allFoodSizes = productSizes.filter(s =>
    !s.name.toLowerCase().includes('bulk') &&
    s.product_type && s.product_type.toLowerCase() === 'food'
  );

  // Filter out bulk recipes (they are manufacturing recipes, not for sale directly)
  const nonBulkRecipes = recipes.filter(r => !r.is_bulk_recipe);

  // Only show sizes that have at least one recipe ingredient or pricing entry
  const sizeHasData = (sizeId: string): boolean => {
    const hasIngredients = nonBulkRecipes.some(r =>
      r.recipe_ingredients?.some(ri => ri.size_id === sizeId)
    );
    if (hasIngredients) return true;
    const hasPricing = pricingData.some(p => p.size_id === sizeId && p.sale_price > 0);
    return hasPricing;
  };
  const drinkTypeSizes = allDrinkTypeSizes.filter(s => sizeHasData(s.id));
  const foodSizes = allFoodSizes.filter(s => sizeHasData(s.id));

  // For backward compatibility
  const standardDrinkSizes = drinkTypeSizes;

  // Get all food size IDs for classification
  const foodSizeIds = foodSizes.map(s => s.id);
  const drinkSizeIds = drinkTypeSizes.map(s => s.id);

  // Helper to check if a recipe has ingredients for any given size IDs
  const hasIngredientsForSizeIds = (recipe: Recipe, sizeIds: string[]): boolean => {
    return recipe.recipe_ingredients?.some(ri => sizeIds.includes(ri.size_id)) || false;
  };

  // Recipes that have ingredients for food sizes go in the food section
  const foodRecipes = nonBulkRecipes.filter(r =>
    hasIngredientsForSizeIds(r, foodSizeIds)
  );

  // Recipes that have ingredients for drink sizes go in the drink section
  // (a recipe can appear in both if it has ingredients for both)
  const drinkRecipes = nonBulkRecipes.filter(r =>
    hasIngredientsForSizeIds(r, drinkSizeIds)
  );

  // Also include recipes with NO ingredients yet in the drink section as default
  const recipesWithNoIngredients = nonBulkRecipes.filter(r =>
    !hasIngredientsForSizeIds(r, foodSizeIds) && !hasIngredientsForSizeIds(r, drinkSizeIds)
  );
  const drinkRecipesWithDefaults = [...drinkRecipes, ...recipesWithNoIngredients];

  const getSizeBaseTemplateId = (recipeId: string, sizeId: string): string | null => {
    const rsb = recipeSizeBases.find(r => r.recipe_id === recipeId && r.size_id === sizeId);
    return rsb?.base_template_id || null;
  };

  const getSalePrice = (recipeId: string, sizeId: string): number => {
    const pricing = pricingData.find(p => p.recipe_id === recipeId && p.size_id === sizeId);
    return pricing?.sale_price || 0;
  };

  const handleSaveSalePrice = async (recipeId: string, sizeId: string) => {
    const price = parseFloat(editValue) || 0;
    await onUpdatePricing(recipeId, sizeId, price);
    setEditingCell(null);
    setEditValue('');
  };

  const getIngredientCostPerUnit = (ing: Ingredient): number => {
    const cost = typeof ing.cost === 'string' ? parseFloat(ing.cost) : ing.cost;
    const quantity = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : ing.quantity;
    if (!cost || !quantity) return 0;
    const usageUnit = ing.usage_unit || ing.unit;
    const costPerUnit = calculateCostPerUsageUnit(cost, quantity, ing.unit, usageUnit);
    return costPerUnit || (cost / quantity);
  };

  // Calculate cost per oz for a bulk/additive recipe (syrups, etc.)
  const getBulkRecipeCostPerOz = (bulkRecipeId: string): number => {
    const bulkRecipe = recipes.find(r => r.id === bulkRecipeId);
    if (!bulkRecipe || !bulkRecipe.is_bulk_recipe) return 0;

    // Find the bulk size for this recipe
    const bulkSizes = productSizes.filter(s => s.name.toLowerCase().includes('bulk'));
    let totalCost = 0;
    let batchSizeOz = 0;

    for (const size of bulkSizes) {
      const sizeIngredients = bulkRecipe.recipe_ingredients?.filter((ri: RecipeIngredient) => ri.size_id === size.id) || [];
      if (sizeIngredients.length > 0) {
        batchSizeOz = size.size_value;
        for (const ri of sizeIngredients) {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          if (ing) {
            totalCost += ri.quantity * getIngredientCostPerUnit(ing);
          }
        }
        break; // Use first bulk size found with ingredients
      }
    }

    // Add overhead time cost for making the batch
    if (overhead && bulkRecipe.minutes_per_drink != null) {
      totalCost += (overhead.cost_per_minute || 0) * bulkRecipe.minutes_per_drink;
    }

    if (batchSizeOz > 0) {
      return totalCost / batchSizeOz;
    }
    return 0;
  };

  const calculateSizeCost = (recipe: Recipe, sizeId: string): number => {
    let totalCost = 0;

    const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === sizeId) || [];
    for (const ri of sizeIngredients) {
      // Check if this is a bulk recipe ingredient (syrup, etc.)
      if (ri.syrup_recipe_id) {
        const bulkCostPerOz = getBulkRecipeCostPerOz(ri.syrup_recipe_id);
        totalCost += ri.quantity * bulkCostPerOz;
      } else if (ri.ingredient_id) {
        const ing = ingredients.find(i => i.id === ri.ingredient_id);
        if (ing) {
          totalCost += ri.quantity * getIngredientCostPerUnit(ing);
        }
      }
    }

    const sizeBaseId = getSizeBaseTemplateId(recipe.id, sizeId);
    if (sizeBaseId) {
      const baseTemplate = baseTemplates.find(bt => bt.id === sizeBaseId);
      const baseItems = baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
      for (const bi of baseItems) {
        const ing = ingredients.find(i => i.id === bi.ingredient_id);
        if (ing) {
          totalCost += bi.quantity * getIngredientCostPerUnit(ing);
        }
      }
      // Add overhead cost to base
      if (overhead && baseTemplate) {
        const recipeMinutes = recipe.minutes_per_drink ?? overhead.minutes_per_drink ?? 1;
        const overheadCost = (overhead.cost_per_minute || 0) * recipeMinutes;
        totalCost += overheadCost;
      }
    }

    return totalCost;
  };

  const hasIngredientsForSize = (recipe: Recipe, sizeId: string): boolean => {
    const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === sizeId) || [];
    if (sizeIngredients.length > 0) return true;

    // Check per-size base template
    const sizeBaseId = getSizeBaseTemplateId(recipe.id, sizeId);
    if (sizeBaseId) {
      const baseTemplate = baseTemplates.find(bt => bt.id === sizeBaseId);
      const baseItems = baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
      if (baseItems.length > 0) return true;
    }

    // Also check legacy base_template_id
    if (recipe.base_template_id) {
      const baseTemplate = baseTemplates.find(bt => bt.id === recipe.base_template_id);
      const baseItems = baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
      if (baseItems.length > 0) return true;
    }

    return false;
  };

  const calculateAverages = () => {
    const averages: { [sizeId: string]: { costs: number[], sales: number[], profits: number[], margins: number[] } } = {};

    for (const size of standardDrinkSizes) {
      averages[size.id] = { costs: [], sales: [], profits: [], margins: [] };
    }

    for (const recipe of drinkRecipes) {
      for (const size of standardDrinkSizes) {
        const hasItems = hasIngredientsForSize(recipe, size.id);
        if (!hasItems) continue;

        const cost = calculateSizeCost(recipe, size.id);
        const salePrice = getSalePrice(recipe.id, size.id);
        if (salePrice > 0) {
          const profit = salePrice - cost;
          const margin = (profit / salePrice) * 100;
          averages[size.id].costs.push(cost);
          averages[size.id].sales.push(salePrice);
          averages[size.id].profits.push(profit);
          averages[size.id].margins.push(margin);
        }
      }
    }

    return standardDrinkSizes.map(size => {
      const data = averages[size.id];
      const count = data.costs.length;
      return {
        sizeId: size.id,
        sizeName: size.name,
        avgCost: count > 0 ? data.costs.reduce((a, b) => a + b, 0) / count : 0,
        avgSale: count > 0 ? data.sales.reduce((a, b) => a + b, 0) / count : 0,
        avgProfit: count > 0 ? data.profits.reduce((a, b) => a + b, 0) / count : 0,
        avgMargin: count > 0 ? data.margins.reduce((a, b) => a + b, 0) / count : 0,
        count
      };
    });
  };

  const sizeAverages = calculateAverages();

  const calculateFoodAverages = () => {
    const averages: { [sizeId: string]: { costs: number[], sales: number[], profits: number[], margins: number[] } } = {};

    for (const size of foodSizes) {
      averages[size.id] = { costs: [], sales: [], profits: [], margins: [] };
    }

    for (const recipe of foodRecipes) {
      for (const size of foodSizes) {
        const hasItems = hasIngredientsForSize(recipe, size.id);
        if (!hasItems) continue;

        const cost = calculateSizeCost(recipe, size.id);
        const salePrice = getSalePrice(recipe.id, size.id);
        if (salePrice > 0) {
          const profit = salePrice - cost;
          const margin = (profit / salePrice) * 100;
          averages[size.id].costs.push(cost);
          averages[size.id].sales.push(salePrice);
          averages[size.id].profits.push(profit);
          averages[size.id].margins.push(margin);
        }
      }
    }

    return foodSizes.map(size => {
      const data = averages[size.id];
      const count = data.costs.length;
      return {
        sizeId: size.id,
        sizeName: size.name,
        avgCost: count > 0 ? data.costs.reduce((a, b) => a + b, 0) / count : 0,
        avgSale: count > 0 ? data.sales.reduce((a, b) => a + b, 0) / count : 0,
        avgProfit: count > 0 ? data.profits.reduce((a, b) => a + b, 0) / count : 0,
        avgMargin: count > 0 ? data.margins.reduce((a, b) => a + b, 0) / count : 0,
        count
      };
    });
  };

  const foodAverages = calculateFoodAverages();

  const overallAverage = (() => {
    const allCosts: number[] = [];
    const allSales: number[] = [];
    const allProfits: number[] = [];
    const allMargins: number[] = [];
    for (const avg of [...sizeAverages, ...foodAverages]) {
      if (avg.count > 0) {
        allCosts.push(avg.avgCost);
        allSales.push(avg.avgSale);
        allProfits.push(avg.avgProfit);
        allMargins.push(avg.avgMargin);
      }
    }
    const count = allCosts.length;
    return {
      avgCost: count > 0 ? allCosts.reduce((a, b) => a + b, 0) / count : 0,
      avgSale: count > 0 ? allSales.reduce((a, b) => a + b, 0) / count : 0,
      avgProfit: count > 0 ? allProfits.reduce((a, b) => a + b, 0) / count : 0,
      avgMargin: count > 0 ? allMargins.reduce((a, b) => a + b, 0) / count : 0,
      count
    };
  })();

  const foodOverallAverage = (() => {
    const allCosts: number[] = [];
    const allSales: number[] = [];
    const allProfits: number[] = [];
    const allMargins: number[] = [];
    for (const avg of foodAverages) {
      if (avg.count > 0) {
        allCosts.push(avg.avgCost);
        allSales.push(avg.avgSale);
        allProfits.push(avg.avgProfit);
        allMargins.push(avg.avgMargin);
      }
    }
    const count = allCosts.length;
    return {
      avgCost: count > 0 ? allCosts.reduce((a, b) => a + b, 0) / count : 0,
      avgSale: count > 0 ? allSales.reduce((a, b) => a + b, 0) / count : 0,
      avgProfit: count > 0 ? allProfits.reduce((a, b) => a + b, 0) / count : 0,
      avgMargin: count > 0 ? allMargins.reduce((a, b) => a + b, 0) / count : 0,
      count
    };
  })();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: colors.brown }}>
              <th colSpan={Math.max(standardDrinkSizes.length, foodSizes.length) + 2} className="px-4 py-3 text-left font-semibold" style={{ color: colors.white }}>Store Averages</th>
            </tr>
          </thead>
          <tbody>
            {/* Drink Averages */}
            <tr style={{ backgroundColor: colors.creamDark }}>
              <td className="px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: colors.brown }}>Items</td>
              {standardDrinkSizes.map(size => (
                <td key={size.id} className="px-4 py-2 text-right text-sm font-semibold" style={{ color: colors.brown }}>{size.name}</td>
              ))}
              <td className="px-4 py-2 text-right text-sm font-semibold" style={{ color: colors.gold }}>Overall</td>
            </tr>
            <tr style={{ backgroundColor: colors.white }}>
              <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>Cost</td>
              {sizeAverages.map(avg => (
                <td key={avg.sizeId} className="px-4 py-2 text-right font-mono" style={{ color: colors.brown }}>
                  {avg.count > 0 ? formatCurrency(avg.avgCost) : '-'}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: colors.brown }}>
                {overallAverage.count > 0 ? formatCurrency(overallAverage.avgCost) : '-'}
              </td>
            </tr>
            <tr style={{ backgroundColor: colors.cream }}>
              <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>Sale</td>
              {sizeAverages.map(avg => (
                <td key={avg.sizeId} className="px-4 py-2 text-right font-mono" style={{ color: colors.brown }}>
                  {avg.count > 0 ? formatCurrency(avg.avgSale) : '-'}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: colors.brown }}>
                {overallAverage.count > 0 ? formatCurrency(overallAverage.avgSale) : '-'}
              </td>
            </tr>
            <tr style={{ backgroundColor: colors.white }}>
              <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>Profit</td>
              {sizeAverages.map(avg => (
                <td key={avg.sizeId} className="px-4 py-2 text-right font-mono" style={{ color: avg.avgProfit >= 0 ? colors.green : colors.red }}>
                  {avg.count > 0 ? formatCurrency(avg.avgProfit) : '-'}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: overallAverage.avgProfit >= 0 ? colors.green : colors.red }}>
                {overallAverage.count > 0 ? formatCurrency(overallAverage.avgProfit) : '-'}
              </td>
            </tr>
            <tr style={{ backgroundColor: colors.creamDark }}>
              <td className="px-4 py-2 font-semibold" style={{ color: colors.brown }}>Margin</td>
              {sizeAverages.map(avg => {
                const marginColor = avg.avgMargin > 31 ? colors.green : avg.avgMargin > 25 ? colors.gold : colors.red;
                return (
                  <td key={avg.sizeId} className="px-4 py-2 text-right font-mono font-semibold" style={{ color: avg.count > 0 ? marginColor : colors.brownLight }}>
                    {avg.count > 0 ? formatPercent(avg.avgMargin) : '-'}
                  </td>
                );
              })}
              <td className="px-4 py-2 text-right font-mono font-bold" style={{
                color: overallAverage.count > 0
                  ? (overallAverage.avgMargin > 31 ? colors.green : overallAverage.avgMargin > 25 ? colors.gold : colors.red)
                  : colors.brownLight
              }}>
                {overallAverage.count > 0 ? formatPercent(overallAverage.avgMargin) : '-'}
              </td>
            </tr>

            {/* Food Item Averages */}
            {foodSizes.length > 0 && (
              <>
                <tr style={{ backgroundColor: colors.creamDark }}>
                  <td className="px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: colors.brown }}>Food Items</td>
                  {foodAverages.map(avg => (
                    <td key={avg.sizeId} className="px-4 py-2 text-right text-sm font-semibold" style={{ color: colors.brown }}>{avg.sizeName}</td>
                  ))}
                  <td className="px-4 py-2 text-right text-sm font-semibold" style={{ color: colors.gold }}>Overall</td>
                </tr>
                <tr style={{ backgroundColor: colors.white }}>
                  <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>Cost</td>
                  {foodAverages.map(avg => (
                    <td key={avg.sizeId} className="px-4 py-2 text-right font-mono" style={{ color: colors.brown }}>
                      {avg.count > 0 ? formatCurrency(avg.avgCost) : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: colors.brown }}>
                    {foodOverallAverage.count > 0 ? formatCurrency(foodOverallAverage.avgCost) : '-'}
                  </td>
                </tr>
                <tr style={{ backgroundColor: colors.cream }}>
                  <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>Sale</td>
                  {foodAverages.map(avg => (
                    <td key={avg.sizeId} className="px-4 py-2 text-right font-mono" style={{ color: colors.brown }}>
                      {avg.count > 0 ? formatCurrency(avg.avgSale) : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: colors.brown }}>
                    {foodOverallAverage.count > 0 ? formatCurrency(foodOverallAverage.avgSale) : '-'}
                  </td>
                </tr>
                <tr style={{ backgroundColor: colors.white }}>
                  <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>Profit</td>
                  {foodAverages.map(avg => (
                    <td key={avg.sizeId} className="px-4 py-2 text-right font-mono" style={{ color: avg.avgProfit >= 0 ? colors.green : colors.red }}>
                      {avg.count > 0 ? formatCurrency(avg.avgProfit) : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: foodOverallAverage.avgProfit >= 0 ? colors.green : colors.red }}>
                    {foodOverallAverage.count > 0 ? formatCurrency(foodOverallAverage.avgProfit) : '-'}
                  </td>
                </tr>
                <tr style={{ backgroundColor: colors.creamDark }}>
                  <td className="px-4 py-2 font-semibold" style={{ color: colors.brown }}>Margin</td>
                  {foodAverages.map(avg => {
                    const marginColor = avg.avgMargin > 31 ? colors.green : avg.avgMargin > 25 ? colors.gold : colors.red;
                    return (
                      <td key={avg.sizeId} className="px-4 py-2 text-right font-mono font-semibold" style={{ color: avg.count > 0 ? marginColor : colors.brownLight }}>
                        {avg.count > 0 ? formatPercent(avg.avgMargin) : '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right font-mono font-bold" style={{
                    color: foodOverallAverage.count > 0
                      ? (foodOverallAverage.avgMargin > 31 ? colors.green : foodOverallAverage.avgMargin > 25 ? colors.gold : colors.red)
                      : colors.brownLight
                  }}>
                    {foodOverallAverage.count > 0 ? formatPercent(foodOverallAverage.avgMargin) : '-'}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: colors.brown }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.white }}>Product</th>
                {standardDrinkSizes.map(size => (
                  <th key={size.id} colSpan={4} className="px-2 py-3 text-center font-semibold" style={{ color: colors.white }}>
                    {size.name}
                  </th>
                ))}
              </tr>
              <tr style={{ backgroundColor: colors.creamDark }}>
                <th className="px-4 py-2" style={{ color: colors.brown }}></th>
                {standardDrinkSizes.map(size => (
                  <Fragment key={size.id}>
                    <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Cost</th>
                    <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Sale</th>
                    <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Margin</th>
                    <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Profit</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...drinkRecipesWithDefaults]
                .sort((a, b) => {
                  const categoryOrder = ['Drinks', 'Food Items', 'Grab-N-Go', 'House-Made'];
                  const aOrder = categoryOrder.indexOf(a.category_name || '');
                  const bOrder = categoryOrder.indexOf(b.category_name || '');
                  const aPriority = aOrder >= 0 ? aOrder : categoryOrder.length;
                  const bPriority = bOrder >= 0 ? bOrder : categoryOrder.length;
                  if (aPriority !== bPriority) return aPriority - bPriority;
                  return a.name.localeCompare(b.name);
                })
                .map((recipe, idx, sorted) => {
                  const prevCategory = idx > 0 ? sorted[idx - 1].category_name : null;
                  const showCategoryHeader = recipe.category_name !== prevCategory;
                  return (
                    <Fragment key={recipe.id}>
                      {showCategoryHeader && (
                        <tr style={{ backgroundColor: colors.creamDark }}>
                          <td
                            colSpan={1 + standardDrinkSizes.length * 4}
                            className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                            style={{ color: colors.brown }}
                          >
                            {recipe.category_name || 'Uncategorized'}
                          </td>
                        </tr>
                      )}
                      <tr
                        style={{
                          backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                          borderBottom: `1px solid ${colors.creamDark}`,
                        }}
                        data-testid={`row-pricing-${recipe.name}`}
                      >
                        <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>
                          <div>{recipe.name}</div>
                        </td>
                  {standardDrinkSizes.map(size => {
                    const hasItems = hasIngredientsForSize(recipe, size.id);
                    if (!hasItems) {
                      return (
                        <Fragment key={size.id}>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                        </Fragment>
                      );
                    }
                    const cost = calculateSizeCost(recipe, size.id);
                    const cellKey = `${recipe.id}-${size.id}`;
                    const salePrice = getSalePrice(recipe.id, size.id);
                    const profit = salePrice - cost;
                    const margin = salePrice > 0 ? (profit / salePrice * 100) : 0;
                    const marginColor = margin > 31 ? colors.green : margin > 25 ? colors.gold : colors.red;
                    const isEditing = editingCell === cellKey;

                    return (
                      <Fragment key={size.id}>
                        <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: colors.brown }}>
                          {formatCurrency(cost)}
                        </td>
                        <td className="px-1 py-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveSalePrice(recipe.id, size.id);
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="w-16 px-1 py-0.5 text-right text-xs rounded border"
                                style={{ borderColor: colors.gold }}
                                autoFocus
                                data-testid={`input-sale-price-${recipe.id}-${size.id}`}
                              />
                              <button
                                onClick={() => handleSaveSalePrice(recipe.id, size.id)}
                                className="text-xs px-1"
                                style={{ color: colors.green }}
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCell(cellKey);
                                setEditValue(salePrice.toString());
                              }}
                              className="w-full text-right font-mono text-xs font-semibold px-1 py-0.5 rounded hover:bg-opacity-80"
                              style={{ color: salePrice > 0 ? colors.brown : colors.brownLight }}
                              data-testid={`button-edit-sale-${recipe.id}-${size.id}`}
                            >
                              {salePrice > 0 ? formatCurrency(salePrice) : 'Set'}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-semibold" style={{ color: salePrice > 0 ? marginColor : colors.brownLight }}>
                          {salePrice > 0 ? formatPercent(margin) : '-'}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: salePrice > 0 ? (profit >= 0 ? colors.green : colors.red) : colors.brownLight }}>
                          {salePrice > 0 ? formatCurrency(profit) : '-'}
                        </td>
                      </Fragment>
                    );
                  })}
                      </tr>
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Food Items Section */}
      {foodSizes.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: colors.brown }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.white }}>Food Items</th>
                  {foodSizes.map(size => (
                    <th key={size.id} colSpan={4} className="px-2 py-3 text-center font-semibold" style={{ color: colors.white }}>
                      {size.name}
                    </th>
                  ))}
                </tr>
                <tr style={{ backgroundColor: colors.creamDark }}>
                  <th className="px-4 py-2" style={{ color: colors.brown }}></th>
                  {foodSizes.map(size => (
                    <Fragment key={size.id}>
                      <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Cost</th>
                      <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Sale</th>
                      <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Margin</th>
                      <th className="px-2 py-2 text-right text-xs" style={{ color: colors.brown }}>Profit</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foodRecipes.length === 0 ? (
                  <tr style={{ backgroundColor: colors.white }}>
                    <td colSpan={1 + foodSizes.length * 4} className="px-4 py-6 text-center" style={{ color: colors.brownLight }}>
                      No food items yet. Create a recipe with a Food base template.
                    </td>
                  </tr>
                ) : (
                  [...foodRecipes]
                    .sort((a, b) => {
                      const categoryOrder = ['Food Items', 'Grab-N-Go'];
                      const aOrder = categoryOrder.indexOf(a.category_name || '');
                      const bOrder = categoryOrder.indexOf(b.category_name || '');
                      const aPriority = aOrder >= 0 ? aOrder : categoryOrder.length;
                      const bPriority = bOrder >= 0 ? bOrder : categoryOrder.length;
                      if (aPriority !== bPriority) return aPriority - bPriority;
                      return a.name.localeCompare(b.name);
                    })
                    .map((recipe, idx, sorted) => {
                      const prevCategory = idx > 0 ? sorted[idx - 1].category_name : null;
                      const showCategoryHeader = recipe.category_name !== prevCategory;
                      return (
                        <Fragment key={recipe.id}>
                          {showCategoryHeader && (
                            <tr style={{ backgroundColor: colors.creamDark }}>
                              <td
                                colSpan={1 + foodSizes.length * 4}
                                className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                                style={{ color: colors.brown }}
                              >
                                {recipe.category_name || 'Uncategorized'}
                              </td>
                            </tr>
                          )}
                          <tr
                            style={{
                              backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                              borderBottom: `1px solid ${colors.creamDark}`,
                            }}
                            data-testid={`row-pricing-food-${recipe.name}`}
                          >
                            <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>
                              <div>{recipe.name}</div>
                            </td>
                      {foodSizes.map(size => {
                        const hasItems = hasIngredientsForSize(recipe, size.id);
                        if (!hasItems) {
                          return (
                            <Fragment key={size.id}>
                              <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                              <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                              <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                              <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                            </Fragment>
                          );
                        }
                        const cost = calculateSizeCost(recipe, size.id);
                        const cellKey = `${recipe.id}-${size.id}`;
                        const salePrice = getSalePrice(recipe.id, size.id);
                        const profit = salePrice - cost;
                        const margin = salePrice > 0 ? (profit / salePrice * 100) : 0;
                        const marginColor = margin > 31 ? colors.green : margin > 25 ? colors.gold : colors.red;
                        const isEditing = editingCell === cellKey;

                        return (
                          <Fragment key={size.id}>
                            <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: colors.brown }}>
                              {formatCurrency(cost)}
                            </td>
                            <td className="px-1 py-1">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveSalePrice(recipe.id, size.id);
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    className="w-16 px-1 py-0.5 text-right text-xs rounded border"
                                    style={{ borderColor: colors.gold }}
                                    autoFocus
                                    data-testid={`input-sale-price-food-${recipe.id}-${size.id}`}
                                  />
                                  <button
                                    onClick={() => handleSaveSalePrice(recipe.id, size.id)}
                                    className="text-xs px-1"
                                    style={{ color: colors.green }}
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingCell(cellKey);
                                    setEditValue(salePrice.toString());
                                  }}
                                  className="w-full text-right font-mono text-xs font-semibold px-1 py-0.5 rounded hover:bg-opacity-80"
                                  style={{ color: salePrice > 0 ? colors.brown : colors.brownLight }}
                                  data-testid={`button-edit-sale-food-${recipe.id}-${size.id}`}
                                >
                                  {salePrice > 0 ? formatCurrency(salePrice) : 'Set'}
                                </button>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs font-semibold" style={{ color: salePrice > 0 ? marginColor : colors.brownLight }}>
                              {salePrice > 0 ? formatPercent(margin) : '-'}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: profit >= 0 ? colors.green : colors.red }}>
                              {salePrice > 0 ? formatCurrency(profit) : '-'}
                            </td>
                          </Fragment>
                        );
                      })}
                          </tr>
                        </Fragment>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
