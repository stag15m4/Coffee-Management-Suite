import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { formatCurrency, calculateCostPerUsageUnit, getNetSalePrice } from './utils';
import { Switch } from '@/components/ui/switch';
import type {
  Ingredient,
  Recipe,
  ProductSize,
  BaseTemplate,
  OverheadSettings,
  RecipeSizeBase,
  RecipeSizePricing,
  RecipeIngredient,
  ActualVolumeOverhead,
} from './types';

interface RecipeSettingsProps {
  overhead: OverheadSettings | null;
  onUpdateOverhead: (updates: Partial<OverheadSettings>) => Promise<void>;
  ingredients: Ingredient[];
  recipes: Recipe[];
  productSizes: ProductSize[];
  baseTemplates: BaseTemplate[];
  recipeSizeBases: RecipeSizeBase[];
  recipePricing: RecipeSizePricing[];
  autoHours: { daysPerWeek: number; avgHoursPerDay: number };
  hasStoreHours: boolean;
  actualVolumeOverhead: ActualVolumeOverhead | null;
}

export const RecipeSettings = ({
  overhead,
  onUpdateOverhead,
  ingredients,
  recipes,
  productSizes,
  baseTemplates,
  recipeSizeBases,
  recipePricing,
  autoHours,
  hasStoreHours,
  actualVolumeOverhead,
}: RecipeSettingsProps) => {
  const { tenant } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cost_per_minute: overhead?.cost_per_minute || 2.26,
    minutes_per_drink: overhead?.minutes_per_drink || 1,
    notes: overhead?.notes || '',
    operating_days_per_week: overhead?.operating_days_per_week || 7,
    hours_open_per_day: overhead?.hours_open_per_day || 8,
  });
  const [editingItemsPerTxn, setEditingItemsPerTxn] = useState(false);
  const [itemsPerTxnInput, setItemsPerTxnInput] = useState(String(overhead?.items_per_transaction ?? 1));
  const [editingTaxRate, setEditingTaxRate] = useState(false);
  const [taxRateInput, setTaxRateInput] = useState(String((Number(overhead?.sales_tax_rate) || 0) * 100));

  const useStoreHours = overhead?.use_store_hours ?? false;
  const displayDays = useStoreHours ? autoHours.daysPerWeek : overhead?.operating_days_per_week || 7;
  const displayHours = useStoreHours ? autoHours.avgHoursPerDay : overhead?.hours_open_per_day || 8;

  const costPerMinute = overhead?.cost_per_minute || 0;
  const overheadPerDrink = costPerMinute * (overhead?.minutes_per_drink || 1);

  const handleToggleAutoHours = async (checked: boolean) => {
    if (checked && !hasStoreHours) return;
    // When switching from auto to manual, pre-fill with the auto values
    if (!checked && useStoreHours) {
      setForm((f) => ({
        ...f,
        operating_days_per_week: autoHours.daysPerWeek,
        hours_open_per_day: autoHours.avgHoursPerDay,
      }));
    }
    await onUpdateOverhead({ use_store_hours: checked });
  };

  const handleSave = async () => {
    await onUpdateOverhead(form);
    setEditing(false);
  };

  const handleSaveItemsPerTxn = async () => {
    const parsed = parseFloat(itemsPerTxnInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    await onUpdateOverhead({ items_per_transaction: parsed });
    setEditingItemsPerTxn(false);
  };

  const handleToggleTaxInclusive = async (checked: boolean) => {
    await onUpdateOverhead({ prices_include_tax: checked });
  };

  const handleSaveTaxRate = async () => {
    const parsedPercent = parseFloat(taxRateInput);
    if (!Number.isFinite(parsedPercent) || parsedPercent < 0) return;
    await onUpdateOverhead({ sales_tax_rate: parsedPercent / 100 });
    setEditingTaxRate(false);
  };

  return (
    <div className="space-y-6">
      {/* Overhead Settings */}
      <div className="rounded-xl p-6 shadow-md" style={{ backgroundColor: colors.white }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: colors.brown }}>
          Overhead Settings
        </h3>

        {/* Auto-calculate toggle */}
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 mb-4"
          style={{ backgroundColor: colors.cream, border: `1px solid ${colors.creamDark}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: colors.brown }}>
              Auto-calculate from store profile
            </div>
            <div className="text-xs mt-0.5" style={{ color: colors.brownLight }}>
              {hasStoreHours ? (
                'Uses your store operating hours to derive days/week and hours/day'
              ) : (
                <>
                  Set your{' '}
                  <a href={`/store/${tenant?.id || ''}`} className="underline" style={{ color: colors.gold }}>
                    store hours
                  </a>{' '}
                  to enable auto-calculation
                </>
              )}
            </div>
          </div>
          <Switch checked={useStoreHours} onCheckedChange={handleToggleAutoHours} disabled={!hasStoreHours} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Prep Minutes
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
            {useStoreHours ? (
              <div>
                <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                  {displayDays} days
                </div>
                <div className="text-xs" style={{ color: colors.brownLight }}>
                  From store profile
                </div>
              </div>
            ) : editing ? (
              <input
                type="number"
                min="1"
                max="7"
                value={form.operating_days_per_week}
                onChange={(e) =>
                  setForm({ ...form, operating_days_per_week: Math.min(7, Math.max(1, parseInt(e.target.value) || 7)) })
                }
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-operating-days"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {displayDays} days
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Hours Open Per Day
            </label>
            {useStoreHours ? (
              <div>
                <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                  {displayHours} hours
                </div>
                <div className="text-xs" style={{ color: colors.brownLight }}>
                  Average from store profile
                </div>
              </div>
            ) : editing ? (
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={form.hours_open_per_day}
                onChange={(e) =>
                  setForm({ ...form, hours_open_per_day: Math.min(24, Math.max(1, parseFloat(e.target.value) || 8)) })
                }
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-hours-open"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {displayHours} hours
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
          <div className="text-sm" style={{ color: colors.brownLight }}>
            Overhead per Item
          </div>
          <div className="text-3xl font-bold" style={{ color: colors.gold }}>
            {formatCurrency(overheadPerDrink)}
          </div>
          <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
            Cost/min ({formatCurrency(costPerMinute)}) x Prep min ({overhead?.minutes_per_drink || 1})
          </div>
          <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
            Assumes the shop is making an item every {overhead?.minutes_per_drink || 1} min, nonstop, for the whole time
            it's open.
          </div>
        </div>

        <div
          className="mt-4 p-4 rounded-lg border-2"
          style={{ backgroundColor: colors.white, borderColor: colors.gold }}
          data-testid="box-actual-volume-overhead"
        >
          <div className="text-sm font-medium" style={{ color: colors.brownLight }}>
            Overhead per Item — Actual Volume
          </div>
          {actualVolumeOverhead ? (
            <>
              <div className="text-3xl font-bold" style={{ color: colors.gold }}>
                {formatCurrency(actualVolumeOverhead.trueOverheadPerItem)}
              </div>
              <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
                Cost/min ({formatCurrency(costPerMinute)}) x True min/item (
                {actualVolumeOverhead.trueMinutesPerItem.toFixed(2)}), from{' '}
                {actualVolumeOverhead.avgDailyTransactions.toFixed(1)} avg daily transactions over{' '}
                {actualVolumeOverhead.transactionDayCount}{' '}
                {actualVolumeOverhead.transactionDayCount === 1 ? 'day' : 'days'} logged
              </div>
              {overheadPerDrink > 0 && (
                <div
                  className="text-xs mt-2 font-semibold"
                  style={{
                    color: actualVolumeOverhead.trueOverheadPerItem > overheadPerDrink * 1.1 ? '#dc2626' : colors.brown,
                  }}
                >
                  {actualVolumeOverhead.trueOverheadPerItem > overheadPerDrink
                    ? `${formatCurrency(actualVolumeOverhead.trueOverheadPerItem - overheadPerDrink)} higher than the theoretical Overhead per Item above — your real sales volume is below what that figure assumes.`
                    : `${formatCurrency(overheadPerDrink - actualVolumeOverhead.trueOverheadPerItem)} lower than the theoretical Overhead per Item above — your real sales volume is above what that figure assumes.`}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: colors.brown }}>
                  Items per transaction:
                </label>
                {editingItemsPerTxn ? (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={itemsPerTxnInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) setItemsPerTxnInput(val);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-16 px-2 py-1 text-sm rounded border-2 outline-none"
                      style={{ borderColor: colors.gold }}
                      data-testid="input-items-per-transaction"
                    />
                    <button
                      onClick={handleSaveItemsPerTxn}
                      className="text-xs px-2 py-1 font-semibold rounded"
                      style={{ backgroundColor: colors.gold, color: colors.white }}
                      data-testid="button-save-items-per-transaction"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setItemsPerTxnInput(String(overhead?.items_per_transaction ?? 1));
                        setEditingItemsPerTxn(false);
                      }}
                      className="text-xs px-2 py-1 font-semibold rounded"
                      style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setItemsPerTxnInput(String(overhead?.items_per_transaction ?? 1));
                      setEditingItemsPerTxn(true);
                    }}
                    className="text-sm font-semibold underline"
                    style={{ color: colors.brown }}
                    data-testid="button-edit-items-per-transaction"
                  >
                    {overhead?.items_per_transaction ?? 1}
                  </button>
                )}
              </div>
              <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
                Leave at 1 for the most conservative estimate (treats every transaction as a single item). Raise it if
                your average ticket usually includes more than one item.
              </div>
            </>
          ) : (
            <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
              Log a transaction count alongside your daily numbers on the Cash Deposits page to see your real
              overhead-per-item, based on actual sales volume instead of an assumed full-capacity rate.
            </p>
          )}
        </div>

        <div
          className="mt-4 p-4 rounded-lg border-2"
          style={{ backgroundColor: colors.white, borderColor: colors.gold }}
          data-testid="box-sales-tax"
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="text-sm font-medium" style={{ color: colors.brown }}>
              Menu prices include sales tax
            </div>
            <Switch
              checked={overhead?.prices_include_tax ?? false}
              onCheckedChange={handleToggleTaxInclusive}
              data-testid="toggle-prices-include-tax"
            />
          </div>
          <div className="text-xs" style={{ color: colors.brownLight }}>
            Turn this on if the Sale Price you type into Menu Pricing is a round, tax-inclusive menu-board price (e.g. a
            flat $5.00) rather than a pre-tax price. CMS will back the tax out before computing margin and profit — that
            tax is owed to the state, not real revenue.
          </div>
          {overhead?.prices_include_tax && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: colors.brown }}>
                  Sales tax rate:
                </label>
                {editingTaxRate ? (
                  <>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={taxRateInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) setTaxRateInput(val);
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-16 px-2 py-1 text-sm rounded border-2 outline-none"
                      style={{ borderColor: colors.gold }}
                      data-testid="input-sales-tax-rate"
                    />
                    <span className="text-xs" style={{ color: colors.brownLight }}>
                      %
                    </span>
                    <button
                      onClick={handleSaveTaxRate}
                      className="text-xs px-2 py-1 font-semibold rounded"
                      style={{ backgroundColor: colors.gold, color: colors.white }}
                      data-testid="button-save-sales-tax-rate"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setTaxRateInput(String((Number(overhead?.sales_tax_rate) || 0) * 100));
                        setEditingTaxRate(false);
                      }}
                      className="text-xs px-2 py-1 font-semibold rounded"
                      style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setTaxRateInput(String((Number(overhead?.sales_tax_rate) || 0) * 100));
                      setEditingTaxRate(true);
                    }}
                    className="text-sm font-semibold underline"
                    style={{ color: colors.brown }}
                    data-testid="button-edit-sales-tax-rate"
                  >
                    {((Number(overhead?.sales_tax_rate) || 0) * 100).toFixed(2)}%
                  </button>
                )}
              </div>
              <div className="text-xs mt-2" style={{ color: colors.brownLight }}>
                To compare against Square, use Square's <strong>Net Sales</strong> report, not Gross — Net Sales is
                already tax-excluded, matching what the Pricing Matrix now shows.
              </div>
            </>
          )}
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
                style={{ backgroundColor: colors.gold, color: colors.white }}
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
        <h3 className="text-lg font-bold mb-4" style={{ color: colors.brown }}>
          Export Data
        </h3>
        <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
          Export your recipe costing data for backup, reporting, or sharing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              let csv =
                'Name,Category,Type,Cost,Quantity,Unit,Cost Per Unit,Usage Unit,Cost Per Usage,Vendor,Manufacturer,Item Number,Last Updated\n';
              ingredients.forEach((ing) => {
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
              let csv =
                'Recipe Name,Category,Size,Base Template,Ingredient Cost,Overhead,Total Cost,Sale Price,Margin %,Profit\n';

              recipes.forEach((recipe) => {
                const recipeMinutes = recipe.minutes_per_drink ?? overhead?.minutes_per_drink ?? 1;
                const overheadCost = (overhead?.cost_per_minute || 0) * recipeMinutes;
                const category = recipe.category_name || '';

                productSizes.forEach((size) => {
                  const sizeBase = recipeSizeBases.find(
                    (rsb) => rsb.recipe_id === recipe.id && rsb.size_id === size.id
                  );
                  const baseTemplate = sizeBase
                    ? baseTemplates.find((bt) => bt.id === sizeBase.base_template_id)
                    : recipe.base_template_id
                      ? baseTemplates.find((bt) => bt.id === recipe.base_template_id)
                      : null;

                  const recipeIngredients = (recipe.recipe_ingredients || []).filter(
                    (ri: RecipeIngredient) => ri.size_id === size.id
                  );
                  let ingredientCost = 0;

                  recipeIngredients.forEach((ri: RecipeIngredient) => {
                    if (ri.ingredient_id) {
                      const ing = ingredients.find((i) => i.id === ri.ingredient_id);
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
                    const baseIngredients = (baseTemplate.ingredients || []).filter(
                      (bi: any) => bi.size_id === size.id
                    );
                    baseIngredients.forEach((bi: any) => {
                      const ing = ingredients.find((i) => i.id === bi.ingredient_id);
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
                  const pricing = recipePricing.find((rp) => rp.recipe_id === recipe.id && rp.size_id === size.id);
                  const salePrice = pricing ? Number(pricing.sale_price) || 0 : 0;
                  const netSalePrice = getNetSalePrice(salePrice, overhead);
                  const margin = netSalePrice > 0 ? ((netSalePrice - totalCost) / netSalePrice) * 100 : 0;
                  const profit = netSalePrice - totalCost;

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
