import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const colors = {
  gold: '#C9A227',
  goldLight: '#D4B84A',
  goldDark: '#B8941F',
  cream: '#F5F0E6',
  creamDark: '#EDE5D5',
  brown: '#5D4E37',
  brownLight: '#8B7355',
  white: '#FFFFFF',
  red: '#C94A4A',
  green: '#4A9C6D',
  inputBg: '#E8DFC9',
  buttonGold: '#C9A227',
};

const formatCurrency = (value: number | string) => {
  const num = parseFloat(String(value)) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
};

const formatPercent = (value: number | string) => {
  const num = parseFloat(String(value)) || 0;
  return `${num.toFixed(1)}%`;
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const TabButton = ({ active, onClick, children }: TabButtonProps) => (
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

interface Category {
  id: string;
  name: string;
  display_order?: number;
}

interface Ingredient {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  cost: number | string;
  quantity: number | string;
  unit: string;
  usage_unit?: string;
  cost_per_unit?: number | string;
  cost_per_usage_unit?: number | string;
  vendor?: string;
  manufacturer?: string;
  item_number?: string;
  updated_at?: string;
}

const isOlderThan3Months = (dateStr?: string): boolean => {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return date < threeMonthsAgo;
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const unitConversions: Record<string, Record<string, number>> = {
  oz: { g: 28.3495, grams: 28.3495, gram: 28.3495, oz: 1, ml: 29.5735 },
  lb: { oz: 16, g: 453.592, grams: 453.592, gram: 453.592, lb: 1 },
  gal: { oz: 128, ml: 3785.41, l: 3.78541, gal: 1 },
  l: { ml: 1000, oz: 33.814, l: 1 },
  kg: { g: 1000, grams: 1000, gram: 1000, oz: 35.274, lb: 2.20462, kg: 1 },
};

const calculateCostPerUsageUnit = (
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

interface Product {
  id: string;
  recipe_id: string;
  recipe_name: string;
  category_name: string;
  size_id: string;
  size_name: string;
  base_cost: number;
  ingredient_cost: number;
  total_cost?: number;
  sale_price: number;
}

interface Recipe {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  base_template_id?: string;
  base_template_name?: string;
  is_active: boolean;
  products?: Product[];
  recipe_ingredients?: RecipeIngredient[];
}

interface DrinkSize {
  id: string;
  name: string;
  size_oz: number;
  drink_type: string;
  display_order: number;
}

interface BaseTemplate {
  id: string;
  name: string;
  drink_type: string;
  description?: string;
  is_active: boolean;
  ingredients?: BaseTemplateIngredient[];
}

interface BaseTemplateIngredient {
  id: string;
  base_template_id: string;
  ingredient_id: string;
  size_id: string;
  quantity: number;
  ingredient?: Ingredient;
  size?: DrinkSize;
}

interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  size_id: string;
  quantity: number;
  unit?: string;
  ingredient?: Ingredient;
  size?: DrinkSize;
}

interface OverheadSettings {
  id: string;
  cost_per_minute: number;
  minutes_per_drink: number;
  notes?: string;
}

interface IngredientsTabProps {
  ingredients: Ingredient[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Ingredient>) => Promise<void>;
  onAdd: (ingredient: Partial<Ingredient>) => Promise<void>;
}

const IngredientsTab = ({ ingredients, categories, onUpdate, onAdd }: IngredientsTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ingredient>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    category_id: '',
    cost: '',
    quantity: '',
    unit: 'oz',
    usage_unit: '',
    vendor: '',
    manufacturer: '',
    item_number: '',
  });

  const filteredIngredients = selectedCategory === 'all'
    ? ingredients
    : ingredients.filter(i => i.category_id === selectedCategory);

  const handleEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditForm({
      name: ingredient.name,
      category_id: ingredient.category_id,
      cost: ingredient.cost,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      usage_unit: ingredient.usage_unit || '',
      vendor: ingredient.vendor || '',
      manufacturer: ingredient.manufacturer || '',
      item_number: ingredient.item_number || '',
    });
  };

  const handleSave = async (id: string) => {
    await onUpdate(id, editForm);
    setEditingId(null);
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.name || !newIngredient.category_id) {
      alert('Please fill in name and category');
      return;
    }
    await onAdd(newIngredient);
    setNewIngredient({
      name: '',
      category_id: '',
      cost: '',
      quantity: '',
      unit: 'oz',
      usage_unit: '',
      vendor: '',
      manufacturer: '',
      item_number: '',
    });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: colors.brown }}>Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 outline-none"
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="select-ingredient-category"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-add-ingredient"
        >
          + Add Ingredient
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-xl p-4 shadow-md" style={{ backgroundColor: colors.white }}>
          <h3 className="font-bold mb-3" style={{ color: colors.brown }}>New Ingredient</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={newIngredient.name}
              onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-name"
            />
            <select
              value={newIngredient.category_id}
              onChange={(e) => setNewIngredient({ ...newIngredient, category_id: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-new-ingredient-category"
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Cost ($)"
              value={newIngredient.cost}
              onChange={(e) => setNewIngredient({ ...newIngredient, cost: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-cost"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Qty"
                value={newIngredient.quantity}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                className="px-3 py-2 rounded-lg border-2 outline-none w-20"
                style={{ borderColor: colors.creamDark }}
                data-testid="input-new-ingredient-quantity"
              />
              <select
                value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                className="px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.creamDark }}
                data-testid="select-new-ingredient-unit"
              >
                <option value="oz">oz</option>
                <option value="lb">lb</option>
                <option value="gal">gal</option>
                <option value="gram">gram</option>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="each">each</option>
                <option value="count">count</option>
              </select>
            </div>
            <select
              value={newIngredient.usage_unit}
              onChange={(e) => setNewIngredient({ ...newIngredient, usage_unit: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-new-ingredient-usage-unit"
            >
              <option value="">Usage Unit (same)</option>
              <option value="gram">gram</option>
              <option value="oz">oz</option>
              <option value="ml">ml</option>
              <option value="each">each</option>
            </select>
            <input
              type="text"
              placeholder="Vendor"
              value={newIngredient.vendor}
              onChange={(e) => setNewIngredient({ ...newIngredient, vendor: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-vendor"
            />
            <input
              type="text"
              placeholder="Manufacturer"
              value={newIngredient.manufacturer}
              onChange={(e) => setNewIngredient({ ...newIngredient, manufacturer: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-manufacturer"
            />
            <input
              type="text"
              placeholder="Item Number"
              value={newIngredient.item_number}
              onChange={(e) => setNewIngredient({ ...newIngredient, item_number: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-item-number"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-save-new-ingredient"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-new-ingredient"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: colors.creamDark }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.brown }}>Ingredient</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.brown }}>Category</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.brown }}>Cost</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.brown }}>Quantity</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.brown }}>Cost/Unit</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.brown }}>Usage Unit</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.gold }}>Cost/Usage</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.brown }}>Vendor</th>
                <th className="px-4 py-3 text-center font-semibold" style={{ color: colors.brown }}>Last Updated</th>
                <th className="px-4 py-3 text-center font-semibold" style={{ color: colors.brown }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient, idx) => (
                editingId === ingredient.id ? (
                  <tr
                    key={ingredient.id}
                    style={{ backgroundColor: colors.cream, borderBottom: `2px solid ${colors.gold}` }}
                    data-testid={`row-ingredient-edit-${ingredient.id}`}
                  >
                    <td colSpan={10} className="px-4 py-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Name</label>
                            <input
                              type="text"
                              value={String(editForm.name || '')}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-name-${ingredient.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Category</label>
                            <select
                              value={String(editForm.category_id || '')}
                              onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`select-edit-category-${ingredient.id}`}
                            >
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Cost ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={String(editForm.cost || '')}
                              onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                              className="w-full px-2 py-1 rounded border text-right"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-cost-${ingredient.id}`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Quantity</label>
                              <input
                                type="number"
                                step="0.01"
                                value={String(editForm.quantity || '')}
                                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                className="w-full px-2 py-1 rounded border text-right"
                                style={{ borderColor: colors.gold }}
                                data-testid={`input-edit-quantity-${ingredient.id}`}
                              />
                            </div>
                            <div className="w-20">
                              <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Unit</label>
                              <select
                                value={String(editForm.unit || '')}
                                onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                className="w-full px-2 py-1 rounded border"
                                style={{ borderColor: colors.gold }}
                                data-testid={`select-edit-unit-${ingredient.id}`}
                              >
                                <option value="oz">oz</option>
                                <option value="lb">lb</option>
                                <option value="gal">gal</option>
                                <option value="gram">gram</option>
                                <option value="kg">kg</option>
                                <option value="l">l</option>
                                <option value="each">each</option>
                                <option value="count">count</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Usage Unit</label>
                            <select
                              value={String(editForm.usage_unit || '')}
                              onChange={(e) => setEditForm({ ...editForm, usage_unit: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`select-edit-usage-unit-${ingredient.id}`}
                            >
                              <option value="">Same as purchase</option>
                              <option value="gram">gram</option>
                              <option value="oz">oz</option>
                              <option value="ml">ml</option>
                              <option value="each">each</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Vendor</label>
                            <input
                              type="text"
                              value={String(editForm.vendor || '')}
                              onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-vendor-${ingredient.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Manufacturer</label>
                            <input
                              type="text"
                              value={String(editForm.manufacturer || '')}
                              onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-manufacturer-${ingredient.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Item Number</label>
                            <input
                              type="text"
                              value={String(editForm.item_number || '')}
                              onChange={(e) => setEditForm({ ...editForm, item_number: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-item-number-${ingredient.id}`}
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <button
                              onClick={() => handleSave(ingredient.id)}
                              className="px-4 py-1 rounded font-medium"
                              style={{ backgroundColor: colors.gold, color: colors.brown }}
                              data-testid={`button-save-${ingredient.id}`}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-1 rounded font-medium"
                              style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                              data-testid={`button-cancel-${ingredient.id}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={ingredient.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                      borderBottom: `1px solid ${colors.creamDark}`,
                    }}
                    data-testid={`row-ingredient-${ingredient.id}`}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: colors.brown }}>
                      {ingredient.name}
                    </td>
                    <td className="px-4 py-3" style={{ color: colors.brownLight }}>
                      {ingredient.category_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brown }}>
                      {formatCurrency(ingredient.cost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brown }}>
                      {ingredient.quantity} {ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brownLight }}>
                      {formatCurrency(ingredient.cost_per_unit || 0)}/{ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: colors.brownLight }}>
                      {ingredient.usage_unit || ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: colors.gold }}>
                      {(() => {
                        const usageUnit = ingredient.usage_unit || ingredient.unit;
                        const costPerUsage = calculateCostPerUsageUnit(
                          Number(ingredient.cost) || 0,
                          Number(ingredient.quantity) || 1,
                          ingredient.unit,
                          usageUnit
                        );
                        return costPerUsage !== null 
                          ? `${formatCurrency(costPerUsage)}/${usageUnit}`
                          : '-';
                      })()}
                    </td>
                    <td className="px-4 py-3" style={{ color: colors.brownLight }}>
                      {ingredient.vendor || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isOlderThan3Months(ingredient.updated_at) && (
                          <span 
                            title="Price check needed - not updated in 3+ months"
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: colors.red, color: colors.white }}
                            data-testid={`badge-needs-update-${ingredient.id}`}
                          >
                            Check
                          </span>
                        )}
                        <span className="text-xs" style={{ color: colors.brownLight }}>
                          {formatDate(ingredient.updated_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(ingredient)}
                        className="font-medium hover:underline"
                        style={{ color: colors.gold }}
                        data-testid={`button-edit-${ingredient.id}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface RecipesTabProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  productCategories: Category[];
  baseTemplates: BaseTemplate[];
  drinkSizes: DrinkSize[];
  overhead: OverheadSettings | null;
  onAddRecipe: (recipe: { name: string; category_id: string; base_template_id?: string }) => Promise<void>;
  onUpdateRecipe: (id: string, updates: { name?: string; category_id?: string; base_template_id?: string | null }) => Promise<void>;
  onAddRecipeIngredient: (ingredient: { recipe_id: string; ingredient_id: string; size_id: string; quantity: number; unit?: string }) => Promise<void>;
  onDeleteRecipeIngredient: (id: string) => Promise<void>;
}

const RecipesTab = ({ recipes, ingredients, productCategories, drinkSizes, baseTemplates, overhead, onAddRecipe, onUpdateRecipe, onAddRecipeIngredient, onDeleteRecipeIngredient }: RecipesTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [editRecipeForm, setEditRecipeForm] = useState({ name: '', category_id: '', base_template_id: '' });
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category_id: '',
    base_template_id: '',
  });
  const [addingIngredient, setAddingIngredient] = useState<{ recipeId: string; sizeId: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '1', unit: '' });

  const getIngredientCostPerUnit = (ing: Ingredient): number => {
    const cost = typeof ing.cost === 'string' ? parseFloat(ing.cost) : ing.cost;
    const quantity = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : ing.quantity;
    if (!cost || !quantity) return 0;
    const usageUnit = ing.usage_unit || ing.unit;
    const costPerUnit = calculateCostPerUsageUnit(cost, quantity, ing.unit, usageUnit);
    return costPerUnit || (cost / quantity);
  };

  const calculateSizeCost = (recipe: Recipe, sizeId: string): number => {
    let totalCost = 0;
    
    const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === sizeId) || [];
    for (const ri of sizeIngredients) {
      const ing = ingredients.find(i => i.id === ri.ingredient_id);
      if (ing) {
        totalCost += ri.quantity * getIngredientCostPerUnit(ing);
      }
    }
    
    if (recipe.base_template_id) {
      const baseTemplate = baseTemplates.find(bt => bt.id === recipe.base_template_id);
      const baseItems = baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
      for (const bi of baseItems) {
        const ing = ingredients.find(i => i.id === bi.ingredient_id);
        if (ing) {
          totalCost += bi.quantity * getIngredientCostPerUnit(ing);
        }
      }
    }
    
    if (overhead) {
      const overheadCost = (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0);
      totalCost += overheadCost;
    }
    
    return totalCost;
  };
  
  const getOverheadCost = (): number => {
    if (!overhead) return 0;
    return (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0);
  };

  const getBaseTemplateItems = (recipe: Recipe, sizeId: string): BaseTemplateIngredient[] => {
    if (!recipe.base_template_id) return [];
    const baseTemplate = baseTemplates.find(bt => bt.id === recipe.base_template_id);
    return baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe.id);
    setEditRecipeForm({
      name: recipe.name,
      category_id: recipe.category_id,
      base_template_id: recipe.base_template_id || '',
    });
  };

  const handleSaveRecipe = async (id: string) => {
    await onUpdateRecipe(id, {
      name: editRecipeForm.name,
      category_id: editRecipeForm.category_id,
      base_template_id: editRecipeForm.base_template_id || null,
    });
    setEditingRecipe(null);
  };

  const filteredRecipes = selectedCategory === 'all'
    ? recipes
    : recipes.filter(r => r.category_id === selectedCategory);

  const handleAddRecipe = async () => {
    if (!newRecipe.name || !newRecipe.category_id) {
      alert('Please fill in recipe name and category');
      return;
    }
    await onAddRecipe({
      name: newRecipe.name,
      category_id: newRecipe.category_id,
      base_template_id: newRecipe.base_template_id || undefined,
    });
    setNewRecipe({ name: '', category_id: '', base_template_id: '' });
    setShowAddForm(false);
  };

  const handleAddIngredient = async (recipeId: string, sizeId: string) => {
    if (!newIngredient.ingredient_id) {
      alert('Please select an ingredient');
      return;
    }
    const selectedIngredient = ingredients.find(i => i.id === newIngredient.ingredient_id);
    await onAddRecipeIngredient({
      recipe_id: recipeId,
      ingredient_id: newIngredient.ingredient_id,
      size_id: sizeId,
      quantity: parseFloat(newIngredient.quantity) || 1,
      unit: newIngredient.unit || selectedIngredient?.unit,
    });
    setNewIngredient({ ingredient_id: '', quantity: '1', unit: '' });
    setAddingIngredient(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: colors.brown }}>Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 outline-none"
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="select-recipe-category"
          >
            <option value="all">All Categories</option>
            {productCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-new-recipe"
        >
          + New Recipe
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-xl p-4 shadow-md" style={{ backgroundColor: colors.white }}>
          <h3 className="font-bold mb-3" style={{ color: colors.brown }}>New Recipe</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Recipe Name"
              value={newRecipe.name}
              onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-recipe-name"
            />
            <select
              value={newRecipe.category_id}
              onChange={(e) => setNewRecipe({ ...newRecipe, category_id: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-new-recipe-category"
            >
              <option value="">Select Category</option>
              {productCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddRecipe}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-save-new-recipe"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-new-recipe"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {filteredRecipes.map(recipe => (
          <div
            key={recipe.id}
            className="rounded-xl shadow-md overflow-hidden"
            style={{ backgroundColor: colors.white }}
            data-testid={`card-recipe-${recipe.id}`}
          >
            <div
              className="px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedRecipe(expandedRecipe === recipe.id ? null : recipe.id)}
              style={{ backgroundColor: colors.creamDark }}
            >
              {editingRecipe === recipe.id ? (
                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editRecipeForm.name}
                    onChange={(e) => setEditRecipeForm({ ...editRecipeForm, name: e.target.value })}
                    className="px-2 py-1 rounded border-0"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid={`input-edit-recipe-name-${recipe.id}`}
                  />
                  <select
                    value={editRecipeForm.category_id}
                    onChange={(e) => setEditRecipeForm({ ...editRecipeForm, category_id: e.target.value })}
                    className="px-2 py-1 rounded border-0"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid={`select-edit-recipe-category-${recipe.id}`}
                  >
                    {productCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSaveRecipe(recipe.id)}
                    className="px-3 py-1 rounded font-medium"
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
                    data-testid={`button-save-recipe-${recipe.id}`}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingRecipe(null)}
                    className="px-3 py-1 rounded font-medium"
                    style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                    data-testid={`button-cancel-recipe-${recipe.id}`}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-bold" style={{ color: colors.brown }}>{recipe.name}</h3>
                    <span className="text-sm" style={{ color: colors.brownLight }}>{recipe.category_name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditRecipe(recipe); }}
                    className="text-sm font-medium hover:underline"
                    style={{ color: colors.gold }}
                    data-testid={`button-edit-recipe-${recipe.id}`}
                  >
                    Edit
                  </button>
                </div>
              )}
              <span style={{ color: colors.gold }}>{expandedRecipe === recipe.id ? '▼' : '▶'}</span>
            </div>

            {expandedRecipe === recipe.id && (
              <div className="p-4 space-y-4">
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Base Template: {recipe.base_template_name || 'None'}
                </p>

                <div className="space-y-3">
                  <h4 className="font-semibold" style={{ color: colors.brown }}>Ingredients by Size</h4>
                  <div className="grid gap-3">
                    {drinkSizes.map(size => {
                      const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === size.id) || [];
                      const baseTemplateItems = getBaseTemplateItems(recipe, size.id);
                      const calculatedCost = calculateSizeCost(recipe, size.id);
                      const hasItems = sizeIngredients.length > 0 || baseTemplateItems.length > 0;
                      const isAdding = addingIngredient?.recipeId === recipe.id && addingIngredient?.sizeId === size.id;
                      
                      return (
                        <div
                          key={size.id}
                          className="rounded-lg p-3"
                          style={{ backgroundColor: colors.cream }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="font-semibold" style={{ color: colors.brown }}>
                              {size.name} ({size.size_oz}oz)
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span style={{ color: colors.brownLight }}>
                                Cost: <span className="font-mono font-bold" style={{ color: hasItems ? colors.green : colors.brownLight }}>{hasItems ? formatCurrency(calculatedCost) : '-'}</span>
                              </span>
                            </div>
                          </div>

                          {baseTemplateItems.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs font-medium" style={{ color: colors.brownLight }}>Base (Disposables):</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {baseTemplateItems.map(bi => {
                                  const ing = ingredients.find(i => i.id === bi.ingredient_id);
                                  const itemCost = ing ? bi.quantity * getIngredientCostPerUnit(ing) : 0;
                                  return (
                                    <div
                                      key={bi.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                      style={{ backgroundColor: colors.creamDark }}
                                    >
                                      <span style={{ color: colors.brown }}>{ing?.name || 'Unknown'}</span>
                                      <span style={{ color: colors.brownLight }}>x{bi.quantity}</span>
                                      <span style={{ color: colors.gold }}>({formatCurrency(itemCost)})</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {sizeIngredients.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs font-medium" style={{ color: colors.brownLight }}>Ingredients:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {sizeIngredients.map(ri => {
                                  const ing = ingredients.find(i => i.id === ri.ingredient_id);
                                  const itemCost = ing ? ri.quantity * getIngredientCostPerUnit(ing) : 0;
                                  return (
                                    <div
                                      key={ri.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                      style={{ backgroundColor: colors.white }}
                                    >
                                      <span style={{ color: colors.brown }}>{ing?.name || 'Unknown'}</span>
                                      <span style={{ color: colors.brownLight }}>({ri.quantity} {ri.unit || ing?.unit})</span>
                                      <span style={{ color: colors.gold }}>({formatCurrency(itemCost)})</span>
                                      <button
                                        onClick={() => onDeleteRecipeIngredient(ri.id)}
                                        className="ml-1 font-bold"
                                        style={{ color: colors.red }}
                                        data-testid={`button-delete-ri-${ri.id}`}
                                      >
                                        x
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {hasItems && getOverheadCost() > 0 && (
                            <div className="mb-2">
                              <span className="text-xs font-medium" style={{ color: colors.brownLight }}>Overhead:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <div
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                  style={{ backgroundColor: colors.white, border: `1px dashed ${colors.brownLight}` }}
                                >
                                  <span style={{ color: colors.brown }}>Shop Overhead</span>
                                  <span style={{ color: colors.gold }}>({formatCurrency(getOverheadCost())})</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {isAdding ? (
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                value={newIngredient.ingredient_id}
                                onChange={(e) => setNewIngredient({ ...newIngredient, ingredient_id: e.target.value })}
                                className="px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.creamDark }}
                                data-testid={`select-ri-ingredient-${size.id}`}
                              >
                                <option value="">Select Ingredient</option>
                                {ingredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>{ing.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={newIngredient.quantity}
                                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                className="w-16 px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.creamDark }}
                                placeholder="Qty"
                                data-testid={`input-ri-qty-${size.id}`}
                              />
                              <button
                                onClick={() => handleAddIngredient(recipe.id, size.id)}
                                className="px-2 py-1 rounded text-sm font-semibold"
                                style={{ backgroundColor: colors.gold, color: colors.brown }}
                                data-testid={`button-save-ri-${size.id}`}
                              >
                                Add
                              </button>
                              <button
                                onClick={() => setAddingIngredient(null)}
                                className="px-2 py-1 rounded text-sm"
                                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                                data-testid={`button-cancel-ri-${size.id}`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingIngredient({ recipeId: recipe.id, sizeId: size.id });
                                setNewIngredient({ ingredient_id: '', quantity: '1', unit: '' });
                              }}
                              className="text-sm font-medium"
                              style={{ color: colors.gold }}
                              data-testid={`button-add-ri-${size.id}`}
                            >
                              + Add Ingredient
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface RecipeSizePricing {
  id?: string;
  recipe_id: string;
  size_id: string;
  sale_price: number;
}

interface PricingTabProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  baseTemplates: BaseTemplate[];
  drinkSizes: DrinkSize[];
  overhead: OverheadSettings | null;
  pricingData: RecipeSizePricing[];
  onUpdatePricing: (recipeId: string, sizeId: string, salePrice: number) => Promise<void>;
}

const PricingTab = ({ recipes, ingredients, baseTemplates, drinkSizes, overhead, pricingData, onUpdatePricing }: PricingTabProps) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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

  const calculateSizeCost = (recipe: Recipe, sizeId: string): number => {
    let totalCost = 0;
    
    const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === sizeId) || [];
    for (const ri of sizeIngredients) {
      const ing = ingredients.find(i => i.id === ri.ingredient_id);
      if (ing) {
        totalCost += ri.quantity * getIngredientCostPerUnit(ing);
      }
    }
    
    if (recipe.base_template_id) {
      const baseTemplate = baseTemplates.find(bt => bt.id === recipe.base_template_id);
      const baseItems = baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
      for (const bi of baseItems) {
        const ing = ingredients.find(i => i.id === bi.ingredient_id);
        if (ing) {
          totalCost += bi.quantity * getIngredientCostPerUnit(ing);
        }
      }
    }
    
    if (overhead) {
      totalCost += (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0);
    }
    
    return totalCost;
  };

  const hasIngredientsForSize = (recipe: Recipe, sizeId: string): boolean => {
    const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === sizeId) || [];
    if (sizeIngredients.length > 0) return true;
    
    if (recipe.base_template_id) {
      const baseTemplate = baseTemplates.find(bt => bt.id === recipe.base_template_id);
      const baseItems = baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
      if (baseItems.length > 0) return true;
    }
    
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: colors.brown }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.white }}>Product</th>
                {drinkSizes.map(size => (
                  <th key={size.id} colSpan={4} className="px-2 py-3 text-center font-semibold" style={{ color: colors.white }}>
                    {size.name}
                  </th>
                ))}
              </tr>
              <tr style={{ backgroundColor: colors.creamDark }}>
                <th className="px-4 py-2" style={{ color: colors.brown }}></th>
                {drinkSizes.map(size => (
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
              {recipes.map((recipe, idx) => (
                <tr
                  key={recipe.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                    borderBottom: `1px solid ${colors.creamDark}`,
                  }}
                  data-testid={`row-pricing-${recipe.name}`}
                >
                  <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>
                    <div>{recipe.name}</div>
                    <div className="text-xs" style={{ color: colors.brownLight }}>{recipe.category_name}</div>
                  </td>
                  {drinkSizes.map(size => {
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
                    const marginColor = margin >= 40 ? colors.green : margin >= 25 ? colors.gold : colors.red;
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface SettingsTabProps {
  overhead: OverheadSettings | null;
  onUpdateOverhead: (updates: Partial<OverheadSettings>) => Promise<void>;
}

const SettingsTab = ({ overhead, onUpdateOverhead }: SettingsTabProps) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cost_per_minute: overhead?.cost_per_minute || 2.26,
    minutes_per_drink: overhead?.minutes_per_drink || 1,
    notes: overhead?.notes || '',
  });

  const handleSave = async () => {
    await onUpdateOverhead(form);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-6 shadow-md" style={{ backgroundColor: colors.white }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: colors.brown }}>Overhead Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Cost per Minute
            </label>
            {editing ? (
              <input
                type="number"
                step="0.01"
                value={form.cost_per_minute}
                onChange={(e) => setForm({ ...form, cost_per_minute: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-cost-per-minute"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.gold }}>
                {formatCurrency(overhead?.cost_per_minute || 0)}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>
              Minutes per Drink
            </label>
            {editing ? (
              <input
                type="number"
                step="0.5"
                value={form.minutes_per_drink}
                onChange={(e) => setForm({ ...form, minutes_per_drink: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.gold }}
                data-testid="input-minutes-per-drink"
              />
            ) : (
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {overhead?.minutes_per_drink || 1}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
          <div className="text-sm" style={{ color: colors.brownLight }}>Overhead per Drink</div>
          <div className="text-3xl font-bold" style={{ color: colors.gold }}>
            {formatCurrency((overhead?.cost_per_minute || 0) * (overhead?.minutes_per_drink || 1))}
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
    </div>
  );
};

interface BaseTemplatesTabProps {
  baseTemplates: BaseTemplate[];
  ingredients: Ingredient[];
  drinkSizes: DrinkSize[];
  onAddTemplate: (template: { name: string; drink_type: string; description?: string }) => Promise<void>;
  onAddTemplateIngredient: (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number }) => Promise<void>;
  onDeleteTemplateIngredient: (id: string) => Promise<void>;
}

const BaseTemplatesTab = ({ baseTemplates, ingredients, drinkSizes, onAddTemplate, onAddTemplateIngredient, onDeleteTemplateIngredient }: BaseTemplatesTabProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', drink_type: 'Hot', description: '' });
  const [addingIngredient, setAddingIngredient] = useState<{ templateId: string; sizeId: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '1' });

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
    await onAddTemplateIngredient({
      base_template_id: templateId,
      ingredient_id: newIngredient.ingredient_id,
      size_id: sizeId,
      quantity: parseFloat(newIngredient.quantity) || 1,
    });
    setNewIngredient({ ingredient_id: '', quantity: '1' });
    setAddingIngredient(null);
  };

  const drinkTypes = ['Hot', 'Cold'];

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
          const templateSizes = drinkSizes.filter(s => s.drink_type === template.drink_type || !s.drink_type);
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
                    {template.drink_type} drinks {template.description ? `- ${template.description}` : ''}
                  </span>
                </div>
                <span style={{ color: colors.gold }}>{expandedTemplate === template.id ? '▼' : '▶'}</span>
              </div>

              {expandedTemplate === template.id && (
                <div className="p-4">
                  <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                    Add disposables (cups, lids, sleeves, etc.) for each size:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {templateSizes.map(size => {
                      const sizeIngredients = (template.ingredients || []).filter(i => i.size_id === size.id);
                      const isAdding = addingIngredient?.templateId === template.id && addingIngredient?.sizeId === size.id;

                      return (
                        <div
                          key={size.id}
                          className="rounded-lg p-3"
                          style={{ backgroundColor: colors.cream }}
                        >
                          <div className="font-semibold mb-2" style={{ color: colors.brown }}>{size.name}</div>

                          {sizeIngredients.map(ing => {
                            const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
                            return (
                              <div key={ing.id} className="flex items-center justify-between text-sm mb-1">
                                <span style={{ color: colors.brownLight }}>
                                  {ingredient?.name || 'Unknown'} x{ing.quantity}
                                </span>
                                <button
                                  onClick={() => onDeleteTemplateIngredient(ing.id)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ color: colors.red }}
                                  data-testid={`button-delete-ing-${ing.id}`}
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}

                          {isAdding ? (
                            <div className="mt-2 space-y-2">
                              <select
                                value={newIngredient.ingredient_id}
                                onChange={(e) => setNewIngredient({ ...newIngredient, ingredient_id: e.target.value })}
                                className="w-full px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.gold }}
                                data-testid={`select-ing-${size.id}`}
                              >
                                <option value="">Select ingredient</option>
                                {ingredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>{ing.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.1"
                                value={newIngredient.quantity}
                                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                className="w-full px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.gold }}
                                placeholder="Quantity"
                                data-testid={`input-qty-${size.id}`}
                              />
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
                            <button
                              onClick={() => setAddingIngredient({ templateId: template.id, sizeId: size.id })}
                              className="mt-2 text-sm font-medium"
                              style={{ color: colors.gold }}
                              data-testid={`button-add-ing-${size.id}`}
                            >
                              + Add Item
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface VendorsTabProps {
  ingredients: Ingredient[];
}

const VendorsTab = ({ ingredients }: VendorsTabProps) => {
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

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
              style={{ backgroundColor: colors.creamDark }}
            >
              <div>
                <h3 className="font-bold" style={{ color: colors.brown }}>{vendor.name}</h3>
                <span className="text-sm" style={{ color: colors.brownLight }}>
                  {vendor.itemCount} items
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm" style={{ color: colors.brownLight }}>Total Spend</div>
                <div className="font-bold font-mono" style={{ color: colors.gold }}>
                  {formatCurrency(vendor.totalValue)}
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.creamDark}` }}>
                    <th className="py-2 text-left font-medium" style={{ color: colors.brownLight }}>Product</th>
                    <th className="py-2 text-left font-medium" style={{ color: colors.brownLight }}>Category</th>
                    <th className="py-2 text-right font-medium" style={{ color: colors.brownLight }}>Cost</th>
                    <th className="py-2 text-right font-medium" style={{ color: colors.brownLight }}>Quantity</th>
                    <th className="py-2 text-left font-medium" style={{ color: colors.brownLight }}>Item #</th>
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
                        {formatCurrency(ing.cost)}
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
          <div className="text-center py-8" style={{ color: colors.brownLight }}>
            No vendors found. Add vendor information to your ingredients to see them here.
          </div>
        )}
      </div>
    </div>
  );
};

import { Fragment } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('pricing');
  const [loading, setLoading] = useState(true);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientCategories, setIngredientCategories] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productCategories, setProductCategories] = useState<Category[]>([]);
  const [baseTemplates, setBaseTemplates] = useState<BaseTemplate[]>([]);
  const [drinkSizes, setDrinkSizes] = useState<DrinkSize[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [overhead, setOverhead] = useState<OverheadSettings | null>(null);
  const [pricingData, setPricingData] = useState<{ id?: string; recipe_id: string; size_id: string; sale_price: number }[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const { data: catData } = await supabase
        .from('ingredient_categories')
        .select('*')
        .order('display_order');
      setIngredientCategories(catData || []);

      const { data: ingData } = await supabase
        .from('v_ingredients')
        .select('*');
      setIngredients(ingData || []);

      const { data: prodCatData } = await supabase
        .from('product_categories')
        .select('*')
        .order('display_order');
      setProductCategories(prodCatData || []);

      const { data: baseData } = await supabase
        .from('base_templates')
        .select(`
          *,
          base_template_ingredients(*)
        `);
      const formattedBases = (baseData || []).map((b: any) => ({
        ...b,
        ingredients: b.base_template_ingredients || [],
      }));
      setBaseTemplates(formattedBases);

      const { data: sizeData } = await supabase
        .from('drink_sizes')
        .select('*')
        .order('display_order');
      setDrinkSizes(sizeData || []);

      const { data: recipeData } = await supabase
        .from('recipes')
        .select(`
          *,
          product_categories(name),
          base_templates(name),
          products(*),
          recipe_ingredients(*)
        `)
        .eq('is_active', true);

      const formattedRecipes = (recipeData || []).map((r: any) => ({
        ...r,
        category_name: r.product_categories?.name,
        base_template_name: r.base_templates?.name,
        recipe_ingredients: r.recipe_ingredients || [],
      }));
      setRecipes(formattedRecipes);

      const { data: pricingData } = await supabase
        .from('v_product_pricing')
        .select('*');
      setProducts(pricingData || []);

      const { data: overheadData } = await supabase
        .from('overhead_settings')
        .select('*')
        .limit(1)
        .single();
      setOverhead(overheadData);

      const { data: recipePricingData } = await supabase
        .from('recipe_size_pricing')
        .select('*');
      setPricingData(recipePricingData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    try {
      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['name', 'category_id', 'cost', 'quantity', 'unit', 'usage_unit', 'vendor', 'manufacturer', 'item_number', 'updated_at'];
      
      for (const key of allowedFields) {
        if (key in updates) {
          safeUpdates[key] = (updates as any)[key];
        }
      }
      safeUpdates.updated_at = new Date().toISOString();
      
      const { error } = await supabase
        .from('ingredients')
        .update(safeUpdates)
        .eq('id', id);

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error updating ingredient: ' + error.message);
    }
  };

  const handleAddIngredient = async (ingredient: Partial<Ingredient>) => {
    try {
      const { error } = await supabase
        .from('ingredients')
        .insert(ingredient);

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error adding ingredient: ' + error.message);
    }
  };

  const handleUpdateOverhead = async (updates: Partial<OverheadSettings>) => {
    try {
      const { error } = await supabase
        .from('overhead_settings')
        .update(updates)
        .eq('id', overhead?.id);

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error updating overhead: ' + error.message);
    }
  };

  const handleUpdatePricing = async (recipeId: string, sizeId: string, salePrice: number) => {
    try {
      const existing = pricingData.find(p => p.recipe_id === recipeId && p.size_id === sizeId);
      if (existing?.id) {
        const { error } = await supabase
          .from('recipe_size_pricing')
          .update({ sale_price: salePrice, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recipe_size_pricing')
          .insert({ recipe_id: recipeId, size_id: sizeId, sale_price: salePrice });
        if (error) throw error;
      }
      loadAllData();
    } catch (error: any) {
      alert('Error updating price: ' + error.message);
    }
  };

  const handleAddRecipe = async (recipe: { name: string; category_id: string; base_template_id?: string }) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .insert({
          name: recipe.name,
          category_id: recipe.category_id,
          base_template_id: recipe.base_template_id || null,
          is_active: true,
        });

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error adding recipe: ' + error.message);
    }
  };

  const handleUpdateRecipe = async (id: string, updates: { name?: string; category_id?: string; base_template_id?: string | null }) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error updating recipe: ' + error.message);
    }
  };

  const handleAddBaseTemplate = async (template: { name: string; drink_type: string; description?: string }) => {
    try {
      const { error } = await supabase
        .from('base_templates')
        .insert({
          name: template.name,
          drink_type: template.drink_type,
          description: template.description || null,
          is_active: true,
        });

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error adding base template: ' + error.message);
    }
  };

  const handleAddTemplateIngredient = async (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number }) => {
    try {
      const { error } = await supabase
        .from('base_template_ingredients')
        .insert(ingredient);

      if (error) throw error;
      loadAllData();
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
      loadAllData();
    } catch (error: any) {
      alert('Error deleting template ingredient: ' + error.message);
    }
  };

  const handleAddRecipeIngredient = async (ingredient: { recipe_id: string; ingredient_id: string; size_id: string; quantity: number; unit?: string }) => {
    try {
      const { error } = await supabase
        .from('recipe_ingredients')
        .insert(ingredient);

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error adding recipe ingredient: ' + error.message);
    }
  };

  const handleDeleteRecipeIngredient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadAllData();
    } catch (error: any) {
      alert('Error deleting recipe ingredient: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div style={{ color: colors.brownLight }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-6">
        <div className="max-w-7xl mx-auto text-center">
          <img
            src="/logo.png"
            alt="Erwin Mills Coffee Co."
            className="h-20 mx-auto mb-3"
            data-testid="img-logo"
          />
          <h2 className="text-xl font-semibold" style={{ color: colors.brown }}>
            Recipe Cost Manager
          </h2>
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
            <TabButton active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')}>
              Recipes
            </TabButton>
            <TabButton active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')}>
              Vendors
            </TabButton>
            <TabButton active={activeTab === 'bases'} onClick={() => setActiveTab('bases')}>
              Bases
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
          />
        )}
        {activeTab === 'vendors' && (
          <VendorsTab ingredients={ingredients} />
        )}
        {activeTab === 'bases' && (
          <BaseTemplatesTab
            baseTemplates={baseTemplates}
            ingredients={ingredients}
            drinkSizes={drinkSizes}
            onAddTemplate={handleAddBaseTemplate}
            onAddTemplateIngredient={handleAddTemplateIngredient}
            onDeleteTemplateIngredient={handleDeleteTemplateIngredient}
          />
        )}
        {activeTab === 'recipes' && (
          <RecipesTab
            recipes={recipes}
            ingredients={ingredients}
            productCategories={productCategories}
            baseTemplates={baseTemplates}
            drinkSizes={drinkSizes}
            overhead={overhead}
            onAddRecipe={handleAddRecipe}
            onUpdateRecipe={handleUpdateRecipe}
            onAddRecipeIngredient={handleAddRecipeIngredient}
            onDeleteRecipeIngredient={handleDeleteRecipeIngredient}
          />
        )}
        {activeTab === 'pricing' && (
          <PricingTab
            recipes={recipes}
            ingredients={ingredients}
            baseTemplates={baseTemplates}
            drinkSizes={drinkSizes}
            overhead={overhead}
            pricingData={pricingData}
            onUpdatePricing={handleUpdatePricing}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            overhead={overhead}
            onUpdateOverhead={handleUpdateOverhead}
          />
        )}
      </main>
    </div>
  );
}
