import { useState } from 'react';
import { colors } from '@/lib/colors';
import { formatCurrency, calculateCostPerUsageUnit } from './utils';
import type {
  Ingredient,
  Recipe,
  DrinkSize,
  BaseTemplate,
  OverheadSettings,
  RecipeSizeBase,
  RecipeSizePricing,
  RecipeIngredient,
} from './types';

interface RecipeSettingsProps {
  overhead: OverheadSettings | null;
  onUpdateOverhead: (updates: Partial<OverheadSettings>) => Promise<void>;
  ingredients: Ingredient[];
  recipes: Recipe[];
  drinkSizes: DrinkSize[];
  baseTemplates: BaseTemplate[];
  recipeSizeBases: RecipeSizeBase[];
  recipePricing: RecipeSizePricing[];
}

export const RecipeSettings = ({ overhead, onUpdateOverhead, ingredients, recipes, drinkSizes, baseTemplates, recipeSizeBases, recipePricing }: RecipeSettingsProps) => {
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
                csv += `"${ing.name}","${ing.category_name || ''}","${ing.ingredient_type || ''}",${Number(ing.cost) || 0},${Number(ing.quantity) || 0},"${ing.unit}",${costPerUnit.toFixed(4)},"${usageUnit}",${costPerUsage?.toFixed(4) || ''},`;
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
