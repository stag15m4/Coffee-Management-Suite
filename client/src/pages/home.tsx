import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Home as HomeIcon, Trash2, Check, X, Pencil } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import defaultLogo from '@assets/Erwin-Mills-Logo_1767709452739.png';
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
} from '@/lib/supabase-queries';

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
    maximumFractionDigits: 2,
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
  ingredient_type?: string;
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

const INGREDIENT_TYPES = ['FOH Ingredient', 'BOH Ingredient', 'Disposable', 'Supply'] as const;

const pluralizeType = (type: string) => {
  if (type === 'Supply') return 'Supplies';
  return type + 's';
};

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
  is_bulk_recipe?: boolean;
  tenant_id: string;
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
  ingredient_id?: string | null;
  syrup_recipe_id?: string | null;
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
  operating_days_per_week?: number;
  hours_open_per_day?: number;
  owner_tips_enabled?: boolean;
}

interface OverheadItem {
  id: string;
  tenant_id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annual';
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

interface IngredientsTabProps {
  ingredients: Ingredient[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Ingredient>) => Promise<void>;
  onAdd: (ingredient: Partial<Ingredient>) => Promise<void>;
}

const IngredientsTab = ({ ingredients, categories, onUpdate, onAdd }: IngredientsTabProps) => {
  const [selectedType, setSelectedType] = useState<string>('FOH Ingredient');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ingredient>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    category_id: '',
    ingredient_type: 'FOH Ingredient',
    cost: '',
    quantity: '',
    unit: 'oz',
    usage_unit: '',
    vendor: '',
    manufacturer: '',
    item_number: '',
  });

  const normalizeType = (type: string | null | undefined) => (type || 'FOH Ingredient').toLowerCase();
  
  const filteredIngredients = ingredients
    .filter(i => normalizeType(i.ingredient_type) === selectedType.toLowerCase())
    .filter(i => selectedCategory === 'all' || i.category_id === selectedCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditForm({
      name: ingredient.name,
      category_id: ingredient.category_id,
      ingredient_type: ingredient.ingredient_type || 'FOH Ingredient',
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
    try {
      await onUpdate(id, editForm);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving ingredient:', error);
    }
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
      ingredient_type: selectedType,
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

  const toggleItemSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredIngredients.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredIngredients.map(i => i.id)));
    }
  };

  const handleBulkTransfer = async () => {
    if (!transferTarget || selectedItems.size === 0) {
      alert('Please select items and a target type');
      return;
    }
    try {
      const itemIds = Array.from(selectedItems);
      let successCount = 0;
      let failCount = 0;
      for (const id of itemIds) {
        try {
          await onUpdate(id, { ingredient_type: transferTarget });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (failCount > 0) {
        alert(`Transfer issue: ${failCount} item(s) failed. This is likely due to Supabase security policies. Please check RLS settings.`);
      } else if (successCount > 0) {
        alert(`Successfully transferred ${successCount} item(s) to ${pluralizeType(transferTarget)}`);
      }
      setSelectedItems(new Set());
      setTransferTarget('');
    } catch (error: any) {
      alert('Transfer failed: ' + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {INGREDIENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => { setSelectedType(type); setNewIngredient(prev => ({ ...prev, ingredient_type: type })); }}
            className="px-4 py-2 font-semibold rounded-lg transition-all"
            style={{
              backgroundColor: selectedType === type ? colors.gold : colors.creamDark,
              color: selectedType === type ? colors.white : colors.brown,
            }}
            data-testid={`tab-${type.toLowerCase().replace(' ', '-')}`}
          >
            {pluralizeType(type)} ({ingredients.filter(i => normalizeType(i.ingredient_type) === type.toLowerCase()).length})
          </button>
        ))}
      </div>

      {selectedItems.size > 0 && (
        <div 
          className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
          style={{ backgroundColor: colors.creamDark }}
        >
          <span className="font-medium" style={{ color: colors.brown }}>
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </span>
          <select
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            className="px-3 py-2 rounded-lg border-2 outline-none"
            style={{ borderColor: colors.gold, color: colors.brown }}
            data-testid="select-transfer-target"
          >
            <option value="">Transfer to...</option>
            {INGREDIENT_TYPES.filter(t => t !== selectedType).map(type => (
              <option key={type} value={type}>{pluralizeType(type)}</option>
            ))}
          </select>
          <button
            onClick={handleBulkTransfer}
            disabled={!transferTarget}
            className="px-4 py-2 font-semibold rounded-lg transition-all"
            style={{ 
              backgroundColor: transferTarget ? colors.gold : colors.creamDark, 
              color: transferTarget ? colors.white : colors.brownLight,
              opacity: transferTarget ? 1 : 0.6
            }}
            data-testid="button-bulk-transfer"
          >
            Transfer
          </button>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="px-4 py-2 font-semibold rounded-lg transition-all"
            style={{ backgroundColor: colors.white, color: colors.brown, border: `1px solid ${colors.creamDark}` }}
            data-testid="button-clear-selection"
          >
            Clear Selection
          </button>
        </div>
      )}

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
          + Add {selectedType}
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
                <th className="px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredIngredients.length && filteredIngredients.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: colors.gold }}
                    data-testid="checkbox-select-all"
                  />
                </th>
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
                    <td colSpan={11} className="px-4 py-4">
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
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Type</label>
                            <select
                              value={String(editForm.ingredient_type || 'FOH Ingredient')}
                              onChange={(e) => setEditForm({ ...editForm, ingredient_type: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`select-edit-type-${ingredient.id}`}
                            >
                              {INGREDIENT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
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
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(ingredient.id)}
                        onChange={() => toggleItemSelection(ingredient.id)}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: colors.gold }}
                        data-testid={`checkbox-ingredient-${ingredient.id}`}
                      />
                    </td>
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
                      {formatCurrency((Number(ingredient.cost) || 0) / (Number(ingredient.quantity) || 1))}/{ingredient.unit}
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

interface RecipeSizeBase {
  id?: string;
  recipe_id: string;
  size_id: string;
  base_template_id: string;
}

interface RecipesTabProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  productCategories: Category[];
  baseTemplates: BaseTemplate[];
  drinkSizes: DrinkSize[];
  overhead: OverheadSettings | null;
  recipeSizeBases: RecipeSizeBase[];
  onAddRecipe: (recipe: { name: string; category_id: string; base_template_id?: string; is_bulk_recipe?: boolean }) => Promise<void>;
  onUpdateRecipe: (id: string, updates: { name?: string; category_id?: string; base_template_id?: string | null; is_bulk_recipe?: boolean }) => Promise<void>;
  onAddRecipeIngredient: (ingredient: { recipe_id: string; ingredient_id?: string | null; size_id: string; quantity: number; unit?: string; syrup_recipe_id?: string | null }) => Promise<void>;
  onDeleteRecipeIngredient: (id: string) => Promise<void>;
  onUpdateRecipeSizeBase: (recipeId: string, sizeId: string, baseTemplateId: string | null) => Promise<void>;
  onDuplicateRecipe: (recipe: Recipe) => Promise<void>;
  onDeleteRecipe: (recipeId: string) => Promise<void>;
  onAddBulkSize: (name: string, oz: number) => Promise<boolean>;
  onDeleteBulkSize: (sizeId: string) => Promise<void>;
}

const RecipesTab = ({ recipes, ingredients, productCategories, drinkSizes, baseTemplates, overhead, recipeSizeBases, onAddRecipe, onUpdateRecipe, onAddRecipeIngredient, onDeleteRecipeIngredient, onUpdateRecipeSizeBase, onDuplicateRecipe, onDeleteRecipe, onAddBulkSize, onDeleteBulkSize }: RecipesTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [editRecipeForm, setEditRecipeForm] = useState({ name: '', category_id: '', base_template_id: '', is_bulk_recipe: false });
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category_id: '',
    base_template_id: '',
    is_bulk_recipe: false,
  });
  const [addingIngredient, setAddingIngredient] = useState<{ recipeId: string; sizeId: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '1', unit: '' });
  const [showAddBulkSize, setShowAddBulkSize] = useState(false);
  const [newBulkSize, setNewBulkSize] = useState({ name: '', oz: '' });

  const getIngredientCostPerUnit = (ing: Ingredient): number => {
    const cost = typeof ing.cost === 'string' ? parseFloat(ing.cost) : ing.cost;
    const quantity = typeof ing.quantity === 'string' ? parseFloat(ing.quantity) : ing.quantity;
    if (!cost || !quantity) return 0;
    const usageUnit = ing.usage_unit || ing.unit;
    const costPerUnit = calculateCostPerUsageUnit(cost, quantity, ing.unit, usageUnit);
    return costPerUnit || (cost / quantity);
  };

  // Calculate cost per oz for a bulk/additive recipe
  const getBulkRecipeCostPerOz = (bulkRecipeId: string): number => {
    const bulkRecipe = recipes.find(r => r.id === bulkRecipeId);
    if (!bulkRecipe || !bulkRecipe.is_bulk_recipe) return 0;
    
    // Find the bulk size for this recipe
    const bulkSizes = drinkSizes.filter(s => s.name.toLowerCase().includes('bulk'));
    let totalCost = 0;
    let batchSizeOz = 0;
    
    for (const size of bulkSizes) {
      const sizeIngredients = bulkRecipe.recipe_ingredients?.filter((ri: RecipeIngredient) => ri.size_id === size.id) || [];
      if (sizeIngredients.length > 0) {
        batchSizeOz = size.size_oz;
        for (const ri of sizeIngredients) {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          if (ing) {
            totalCost += ri.quantity * getIngredientCostPerUnit(ing);
          }
        }
        break; // Use first bulk size found with ingredients
      }
    }
    
    if (batchSizeOz > 0) {
      return totalCost / batchSizeOz;
    }
    return 0;
  };

  const getSizeBaseTemplateId = (recipeId: string, sizeId: string): string | null => {
    const sizeBase = recipeSizeBases.find(rsb => rsb.recipe_id === recipeId && rsb.size_id === sizeId);
    return sizeBase?.base_template_id || null;
  };

  const calculateSizeCost = (recipe: Recipe, sizeId: string, skipBaseTemplate: boolean = false): number => {
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
    
    if (!skipBaseTemplate) {
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
        // Add overhead cost to base (only for drink bases, not bulk recipes)
        if (overhead && baseTemplate) {
          const overheadCost = (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0);
          totalCost += overheadCost;
        }
      }
    }
    
    return totalCost;
  };
  
  // Overhead is now manually added to bases, not automatically calculated

  const getBaseTemplateItems = (recipe: Recipe, sizeId: string): BaseTemplateIngredient[] => {
    const sizeBaseId = getSizeBaseTemplateId(recipe.id, sizeId);
    if (!sizeBaseId) return [];
    const baseTemplate = baseTemplates.find(bt => bt.id === sizeBaseId);
    return baseTemplate?.ingredients?.filter(bi => bi.size_id === sizeId) || [];
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe.id);
    setEditRecipeForm({
      name: recipe.name,
      category_id: recipe.category_id,
      base_template_id: recipe.base_template_id || '',
      is_bulk_recipe: recipe.is_bulk_recipe || false,
    });
  };

  const handleSaveRecipe = async (id: string) => {
    await onUpdateRecipe(id, {
      name: editRecipeForm.name,
      category_id: editRecipeForm.category_id,
      base_template_id: editRecipeForm.base_template_id || null,
      is_bulk_recipe: editRecipeForm.is_bulk_recipe,
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
      is_bulk_recipe: newRecipe.is_bulk_recipe,
    });
    setNewRecipe({ name: '', category_id: '', base_template_id: '', is_bulk_recipe: false });
    setShowAddForm(false);
  };

  const handleAddIngredient = async (recipeId: string, sizeId: string) => {
    if (!newIngredient.ingredient_id) {
      alert('Please select an ingredient');
      return;
    }
    
    // Check if this is a syrup selection (prefixed with "syrup:")
    if (newIngredient.ingredient_id.startsWith('syrup:')) {
      const syrupRecipeId = newIngredient.ingredient_id.replace('syrup:', '');
      await onAddRecipeIngredient({
        recipe_id: recipeId,
        ingredient_id: null,
        syrup_recipe_id: syrupRecipeId,
        size_id: sizeId,
        quantity: parseFloat(newIngredient.quantity) || 1,
        unit: 'oz', // Bulk recipes (additives) are always measured in oz
      });
    } else {
      const selectedIngredient = ingredients.find(i => i.id === newIngredient.ingredient_id);
      const unitToUse = newIngredient.unit || selectedIngredient?.usage_unit || selectedIngredient?.unit || 'oz';
      await onAddRecipeIngredient({
        recipe_id: recipeId,
        ingredient_id: newIngredient.ingredient_id,
        size_id: sizeId,
        quantity: parseFloat(newIngredient.quantity) || 1,
        unit: unitToUse,
      });
    }
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newRecipe.is_bulk_recipe}
                onChange={(e) => setNewRecipe({ ...newRecipe, is_bulk_recipe: e.target.checked })}
                className="w-4 h-4 accent-current"
                style={{ accentColor: colors.gold }}
                data-testid="checkbox-new-recipe-bulk"
              />
              <span style={{ color: colors.brown }}>Bulk Recipe</span>
            </label>
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
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRecipeForm.is_bulk_recipe}
                      onChange={(e) => setEditRecipeForm({ ...editRecipeForm, is_bulk_recipe: e.target.checked })}
                      className="w-4 h-4"
                      style={{ accentColor: colors.gold }}
                      data-testid={`checkbox-edit-recipe-bulk-${recipe.id}`}
                    />
                    <span className="text-sm" style={{ color: colors.brown }}>Bulk</span>
                  </label>
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
                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicateRecipe(recipe); }}
                    className="text-sm font-medium hover:underline"
                    style={{ color: colors.brownLight }}
                    data-testid={`button-duplicate-recipe-${recipe.id}`}
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteRecipe(recipe.id); }}
                    className="text-sm font-medium hover:underline"
                    style={{ color: '#c53030' }}
                    data-testid={`button-delete-recipe-${recipe.id}`}
                  >
                    Delete
                  </button>
                </div>
              )}
              <span style={{ color: colors.gold }}>{expandedRecipe === recipe.id ? '▼' : '▶'}</span>
            </div>

            {expandedRecipe === recipe.id && (
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold" style={{ color: colors.brown }}>
                      {recipe.is_bulk_recipe ? 'Batch Ingredients' : 'Ingredients by Size'}
                    </h4>
                    {recipe.is_bulk_recipe && (
                      <button
                        onClick={() => setShowAddBulkSize(!showAddBulkSize)}
                        className="text-sm px-3 py-1 rounded font-medium"
                        style={{ backgroundColor: colors.gold, color: colors.white }}
                        data-testid="button-add-batch-size"
                      >
                        + Add Batch Size
                      </button>
                    )}
                  </div>
                  {showAddBulkSize && recipe.is_bulk_recipe && (
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded" style={{ backgroundColor: colors.creamDark }}>
                      <input
                        type="text"
                        placeholder="Name (e.g., Bulk 64oz)"
                        value={newBulkSize.name}
                        onChange={(e) => setNewBulkSize({ ...newBulkSize, name: e.target.value })}
                        className="px-2 py-1 rounded border-0 text-sm"
                        style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                        data-testid="input-bulk-size-name"
                      />
                      <input
                        type="number"
                        placeholder="oz"
                        value={newBulkSize.oz}
                        onChange={(e) => setNewBulkSize({ ...newBulkSize, oz: e.target.value })}
                        className="px-2 py-1 rounded border-0 text-sm w-20"
                        style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                        data-testid="input-bulk-size-oz"
                      />
                      <button
                        onClick={async () => {
                          console.log('Save clicked, oz value:', newBulkSize.oz);
                          if (newBulkSize.oz) {
                            const name = newBulkSize.name || `Bulk ${newBulkSize.oz}oz`;
                            const finalName = name.toLowerCase().includes('bulk') ? name : `Bulk ${name}`;
                            console.log('Calling onAddBulkSize with:', finalName, parseFloat(newBulkSize.oz));
                            const success = await onAddBulkSize(finalName, parseFloat(newBulkSize.oz));
                            console.log('onAddBulkSize returned:', success);
                            if (success) {
                              setNewBulkSize({ name: '', oz: '' });
                              setShowAddBulkSize(false);
                            }
                          } else {
                            alert('Please enter a size in oz');
                          }
                        }}
                        className="px-2 py-1 rounded text-sm font-medium"
                        style={{ backgroundColor: colors.gold, color: colors.brown }}
                        data-testid="button-save-batch-size"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setShowAddBulkSize(false); setNewBulkSize({ name: '', oz: '' }); }}
                        className="px-2 py-1 rounded text-sm font-medium"
                        style={{ backgroundColor: colors.creamDark, color: colors.brown, border: `1px solid ${colors.brownLight}` }}
                        data-testid="button-cancel-batch-size"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <div className="grid gap-3">
                    {(recipe.is_bulk_recipe 
                      ? drinkSizes.filter(s => s.name.toLowerCase().includes('bulk'))
                      : drinkSizes.filter(s => !s.name.toLowerCase().includes('bulk'))
                    ).map(size => {
                      const sizeIngredients = recipe.recipe_ingredients?.filter(ri => ri.size_id === size.id) || [];
                      const isBulkRecipe = recipe.is_bulk_recipe === true;
                      const currentBaseId = getSizeBaseTemplateId(recipe.id, size.id);
                      const baseTemplateItems = !isBulkRecipe ? getBaseTemplateItems(recipe, size.id) : [];
                      const calculatedCost = calculateSizeCost(recipe, size.id, isBulkRecipe);
                      const hasItems = sizeIngredients.length > 0 || baseTemplateItems.length > 0;
                      const isAdding = addingIngredient?.recipeId === recipe.id && addingIngredient?.sizeId === size.id;
                      
                      return (
                        <div
                          key={size.id}
                          className="rounded-lg p-3"
                          style={{ backgroundColor: colors.cream }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold" style={{ color: colors.brown }}>
                                {size.name} ({size.size_oz}oz)
                              </span>
                              {isBulkRecipe && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete batch size "${size.name}"? This cannot be undone.`)) {
                                      onDeleteBulkSize(size.id);
                                    }
                                  }}
                                  className="text-xs px-1"
                                  style={{ color: colors.red }}
                                  data-testid={`button-delete-bulk-size-${size.id}`}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span style={{ color: colors.brownLight }}>
                                Cost: <span className="font-mono font-bold" style={{ color: hasItems ? colors.green : colors.brownLight }}>{hasItems ? formatCurrency(calculatedCost) : '-'}</span>
                              </span>
                              {isBulkRecipe && hasItems && size.size_oz > 0 && (
                                <span style={{ color: colors.brownLight }}>
                                  Cost/oz: <span className="font-mono font-bold" style={{ color: colors.gold }}>{formatCurrency(calculatedCost / size.size_oz)}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {!isBulkRecipe && (
                            <>
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: colors.brownLight }}>Base:</span>
                                <select
                                  value={currentBaseId || ''}
                                  onChange={(e) => onUpdateRecipeSizeBase(recipe.id, size.id, e.target.value || null)}
                                  className="px-2 py-1 rounded text-xs border-0 outline-none"
                                  style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                                  data-testid={`select-base-${recipe.id}-${size.id}`}
                                >
                                  <option value="">No Base</option>
                                  {baseTemplates.map(bt => (
                                    <option key={bt.id} value={bt.id}>{bt.name}</option>
                                  ))}
                                </select>
                              </div>

                              {(baseTemplateItems.length > 0 || (currentBaseId && overhead && (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0) > 0)) && (
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
                                    {currentBaseId && overhead && (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0) > 0 && (
                                      <div
                                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                        style={{ backgroundColor: colors.white, border: `1px dashed ${colors.brownLight}` }}
                                      >
                                        <span style={{ color: colors.brown }}>Shop Overhead</span>
                                        <span style={{ color: colors.gold }}>({formatCurrency((overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0))})</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {sizeIngredients.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs font-medium" style={{ color: colors.brownLight }}>Ingredients:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {sizeIngredients.map(ri => {
                                  // Check if this is a bulk recipe ingredient (additive, syrup, etc.)
                                  if (ri.syrup_recipe_id) {
                                    const bulkRecipe = recipes.find(r => r.id === ri.syrup_recipe_id);
                                    const bulkCostPerOz = getBulkRecipeCostPerOz(ri.syrup_recipe_id);
                                    const itemCost = ri.quantity * bulkCostPerOz;
                                    return (
                                      <div
                                        key={ri.id}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                        style={{ backgroundColor: colors.gold + '20', border: `1px solid ${colors.gold}` }}
                                      >
                                        <span style={{ color: colors.brown }}>{bulkRecipe?.name || 'Unknown Additive'}</span>
                                        <span style={{ color: colors.brownLight }}>({ri.quantity} oz)</span>
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
                                  }
                                  
                                  const ing = ingredients.find(i => i.id === ri.ingredient_id);
                                  const itemCost = ing ? ri.quantity * getIngredientCostPerUnit(ing) : 0;
                                  const displayUnit = ing?.usage_unit || ri.unit || ing?.unit;
                                  return (
                                    <div
                                      key={ri.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                      style={{ backgroundColor: colors.white }}
                                    >
                                      <span style={{ color: colors.brown }}>{ing?.name || 'Unknown'}</span>
                                      <span style={{ color: colors.brownLight }}>({ri.quantity} {displayUnit})</span>
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
                                {isBulkRecipe ? (
                                  <>
                                    <optgroup label="All Ingredients">
                                      {ingredients
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(ing => (
                                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.ingredient_type || 'FOH Ingredient'})</option>
                                      ))}
                                    </optgroup>
                                    {recipes.filter(r => r.is_bulk_recipe && r.id !== recipe.id).length > 0 && (
                                      <optgroup label="Homemade Additives">
                                        {recipes
                                          .filter(r => r.is_bulk_recipe && r.id !== recipe.id)
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map(bulkRecipe => (
                                          <option key={`syrup:${bulkRecipe.id}`} value={`syrup:${bulkRecipe.id}`}>{bulkRecipe.name}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <optgroup label="Ingredients">
                                      {ingredients
                                        .filter(ing => (ing.ingredient_type || 'FOH Ingredient').toLowerCase() === 'foh ingredient')
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(ing => (
                                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                                      ))}
                                    </optgroup>
                                    {recipes.filter(r => r.is_bulk_recipe && r.id !== recipe.id).length > 0 && (
                                      <optgroup label="Homemade Additives">
                                        {recipes
                                          .filter(r => r.is_bulk_recipe && r.id !== recipe.id)
                                          .sort((a, b) => a.name.localeCompare(b.name))
                                          .map(bulkRecipe => (
                                          <option key={`syrup:${bulkRecipe.id}`} value={`syrup:${bulkRecipe.id}`}>{bulkRecipe.name}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                )}
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
                              <select
                                value={(() => {
                                  if (newIngredient.unit) return newIngredient.unit;
                                  const sel = ingredients.find(i => i.id === newIngredient.ingredient_id);
                                  return sel?.usage_unit || sel?.unit || 'oz';
                                })()}
                                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                className="px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.creamDark }}
                                data-testid={`select-ri-unit-${size.id}`}
                              >
                                {(() => {
                                  const sel = ingredients.find(i => i.id === newIngredient.ingredient_id);
                                  const defaultUnit = sel?.usage_unit || sel?.unit || 'oz';
                                  const units = ['oz', 'lb', 'gram', 'ml', 'each'];
                                  // Put the default unit first in the list
                                  const sortedUnits = [defaultUnit, ...units.filter(u => u !== defaultUnit)];
                                  return sortedUnits.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ));
                                })()}
                              </select>
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
  recipeSizeBases: { id?: string; recipe_id: string; size_id: string; base_template_id: string }[];
  onUpdatePricing: (recipeId: string, sizeId: string, salePrice: number) => Promise<void>;
}

const PricingTab = ({ recipes, ingredients, baseTemplates, drinkSizes, overhead, pricingData, recipeSizeBases, onUpdatePricing }: PricingTabProps) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Filter out bulk sizes and separate drink sizes from food sizes
  // Exclude bulk from both drink and food sizes
  const drinkTypeSizes = drinkSizes.filter(s => 
    !s.name.toLowerCase().includes('bulk') && 
    (!s.drink_type || s.drink_type.toLowerCase() !== 'food')
  );
  const foodSizes = drinkSizes.filter(s => 
    !s.name.toLowerCase().includes('bulk') &&
    s.drink_type && s.drink_type.toLowerCase() === 'food'
  );
  
  // For backward compatibility
  const standardDrinkSizes = drinkTypeSizes;
  
  // Filter out bulk recipes (they are manufacturing recipes, not for sale directly)
  const nonBulkRecipes = recipes.filter(r => !r.is_bulk_recipe);
  
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
    const bulkSizes = drinkSizes.filter(s => s.name.toLowerCase().includes('bulk'));
    let totalCost = 0;
    let batchSizeOz = 0;
    
    for (const size of bulkSizes) {
      const sizeIngredients = bulkRecipe.recipe_ingredients?.filter((ri: RecipeIngredient) => ri.size_id === size.id) || [];
      if (sizeIngredients.length > 0) {
        batchSizeOz = size.size_oz;
        for (const ri of sizeIngredients) {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          if (ing) {
            totalCost += ri.quantity * getIngredientCostPerUnit(ing);
          }
        }
        break; // Use first bulk size found with ingredients
      }
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
        const overheadCost = (overhead.cost_per_minute || 0) * (overhead.minutes_per_drink || 0);
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

  const overallAverage = (() => {
    const allCosts: number[] = [];
    const allSales: number[] = [];
    const allProfits: number[] = [];
    const allMargins: number[] = [];
    for (const avg of sizeAverages) {
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
              <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.white }}>Mixed Drinks</th>
              <th colSpan={standardDrinkSizes.length + 1} className="px-4 py-3 text-center font-semibold" style={{ color: colors.white }}>Averages</th>
            </tr>
            <tr style={{ backgroundColor: colors.creamDark }}>
              <th className="px-4 py-2" style={{ color: colors.brown }}></th>
              {standardDrinkSizes.map(size => (
                <th key={size.id} className="px-4 py-2 text-right text-sm font-semibold" style={{ color: colors.brown }}>{size.name}</th>
              ))}
              <th className="px-4 py-2 text-right text-sm font-semibold" style={{ color: colors.gold }}>Overall</th>
            </tr>
          </thead>
          <tbody>
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
              {drinkRecipesWithDefaults.map((recipe, idx) => (
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
              ))}
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
                  foodRecipes.map((recipe, idx) => (
                    <tr
                      key={recipe.id}
                      style={{
                        backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                        borderBottom: `1px solid ${colors.creamDark}`,
                      }}
                      data-testid={`row-pricing-food-${recipe.name}`}
                    >
                      <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>
                        <div>{recipe.name}</div>
                        <div className="text-xs" style={{ color: colors.brownLight }}>{recipe.category_name}</div>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface SettingsTabProps {
  overhead: OverheadSettings | null;
  onUpdateOverhead: (updates: Partial<OverheadSettings>) => Promise<void>;
  ingredients: Ingredient[];
  recipes: Recipe[];
  drinkSizes: DrinkSize[];
  baseTemplates: BaseTemplate[];
  recipeSizeBases: RecipeSizeBase[];
  recipePricing: RecipeSizePricing[];
  overheadItems: OverheadItem[];
  onAddOverheadItem: (item: { name: string; amount: number; frequency: string }) => Promise<void>;
  onUpdateOverheadItem: (id: string, updates: { name?: string; amount?: number; frequency?: string }) => Promise<void>;
  onDeleteOverheadItem: (id: string) => Promise<void>;
}

const SettingsTab = ({ overhead, onUpdateOverhead, ingredients, recipes, drinkSizes, baseTemplates, recipeSizeBases, recipePricing, overheadItems, onAddOverheadItem, onUpdateOverheadItem, onDeleteOverheadItem }: SettingsTabProps) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cost_per_minute: overhead?.cost_per_minute || 2.26,
    minutes_per_drink: overhead?.minutes_per_drink || 1,
    notes: overhead?.notes || '',
    operating_days_per_week: overhead?.operating_days_per_week || 7,
    hours_open_per_day: overhead?.hours_open_per_day || 8,
  });
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

  const handleSave = async () => {
    await onUpdateOverhead(form);
    setEditing(false);
  };

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
              {formatCurrency(minutesPerMonth > 0 ? totals.monthly / minutesPerMonth : 0)}
            </div>
            <div className="text-xs" style={{ color: colors.brownLight }}>
              From overhead calculator
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
          <div className="text-sm" style={{ color: colors.brownLight }}>Overhead per Drink</div>
          <div className="text-3xl font-bold" style={{ color: colors.gold }}>
            {formatCurrency((minutesPerMonth > 0 ? totals.monthly / minutesPerMonth : 0) * (overhead?.minutes_per_drink || 1))}
          </div>
          <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
            Cost/min ({formatCurrency(minutesPerMonth > 0 ? totals.monthly / minutesPerMonth : 0)}) x Minutes/drink ({overhead?.minutes_per_drink || 1})
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
              <tr style={{ backgroundColor: colors.cream }}>
                <th
                  className="text-left p-2 font-semibold cursor-pointer hover:opacity-70 select-none"
                  style={{ color: colors.brown, width: '20%' }}
                  onClick={() => handleSort('name')}
                >
                  Item {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right p-2 font-semibold cursor-pointer hover:opacity-70 select-none"
                  style={{ color: colors.brown, width: '12%' }}
                  onClick={() => handleSort('amount')}
                >
                  Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-center p-2 font-semibold cursor-pointer hover:opacity-70 select-none"
                  style={{ color: colors.brown, width: '12%' }}
                  onClick={() => handleSort('frequency')}
                >
                  Frequency {sortColumn === 'frequency' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right p-2 font-semibold" style={{ color: colors.brownLight, width: '11%' }}>Daily</th>
                <th className="text-right p-2 font-semibold" style={{ color: colors.brownLight, width: '11%' }}>Weekly</th>
                <th
                  className="text-right p-2 font-semibold cursor-pointer hover:opacity-70 select-none"
                  style={{ color: colors.brownLight, width: '11%' }}
                  onClick={() => handleSort('monthly')}
                >
                  Monthly {sortColumn === 'monthly' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right p-2 font-semibold" style={{ color: colors.brownLight, width: '11%' }}>Quarterly</th>
                <th className="text-right p-2 font-semibold" style={{ color: colors.brownLight, width: '11%' }}>Annual</th>
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
                          <button
                            onClick={() => onDeleteOverheadItem(item.id)}
                            className="p-1 rounded"
                            style={{ color: colors.brownLight }}
                            data-testid={`button-delete-item-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
              const overheadCost = (overhead?.cost_per_minute || 0) * (overhead?.minutes_per_drink || 1);
              
              recipes.forEach(recipe => {
                const category = recipe.category_name || '';
                
                drinkSizes.forEach(size => {
                  const sizeBase = recipeSizeBases.find(rsb => rsb.recipe_id === recipe.id && rsb.size_id === size.id);
                  const baseTemplate = sizeBase ? baseTemplates.find(bt => bt.id === sizeBase.base_template_id) : 
                    (recipe.base_template_id ? baseTemplates.find(bt => bt.id === recipe.base_template_id) : null);
                  
                  // Calculate ingredient cost from recipe ingredients for this size
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
                  
                  // Add base template costs
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

interface BaseTemplatesTabProps {
  baseTemplates: BaseTemplate[];
  ingredients: Ingredient[];
  drinkSizes: DrinkSize[];
  onAddTemplate: (template: { name: string; drink_type: string; description?: string }) => Promise<void>;
  onAddTemplateIngredient: (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number }) => Promise<void>;
  onDeleteTemplateIngredient: (id: string) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
}

const BaseTemplatesTab = ({ baseTemplates, ingredients, drinkSizes, onAddTemplate, onAddTemplateIngredient, onDeleteTemplateIngredient, onDeleteTemplate }: BaseTemplatesTabProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', drink_type: 'Hot', description: '' });
  const [addingIngredient, setAddingIngredient] = useState<{ templateId: string; sizeId: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '1' });
  const [copying, setCopying] = useState(false);

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
    await onAddTemplateIngredient({
      base_template_id: templateId,
      ingredient_id: newIngredient.ingredient_id,
      size_id: sizeId,
      quantity: parseFloat(newIngredient.quantity) || 1,
    });
    setNewIngredient({ ingredient_id: '', quantity: '1' });
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
          const templateSizes = drinkSizes.filter(s => 
            (s.drink_type || '').toLowerCase() === (template.drink_type || '').toLowerCase() || 
            !s.drink_type
          );
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
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="font-semibold" style={{ color: colors.brown }}>{size.name}</div>
                            {templateSizes.filter(s => s.id !== size.id && (template.ingredients || []).some(i => i.size_id === s.id)).length > 0 && (
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
                                {ingredients
                                  .filter(ing => (ing.ingredient_type || '').toLowerCase() === 'disposable')
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(ing => (
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
  onUpdateIngredientCost: (id: string, cost: number) => Promise<void>;
}

const VendorsTab = ({ ingredients, onUpdateIngredientCost }: VendorsTabProps) => {
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState<string>('');

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
  const queryClient = useQueryClient();
  const { profile, tenant, branding, primaryTenant } = useAuth();
  
  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const logoUrl = branding?.logo_url || defaultLogo;

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
    if (!confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
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

  const handleUpdateRecipe = async (id: string, updates: { name?: string; category_id?: string; base_template_id?: string | null; is_bulk_recipe?: boolean }) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
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
    } catch (error: any) {
      console.error('Error in handleDeleteBulkSize:', error);
      alert('Error deleting bulk size: ' + error.message);
    }
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

  const handleAddTemplateIngredient = async (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number }) => {
    try {
      const { error } = await supabase
        .from('base_template_ingredients')
        .insert(ingredient);

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
    if (!confirm('Are you sure you want to delete this base template? This will also remove all its ingredients.')) {
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
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full mx-auto mb-4 animate-spin border-4"
            style={{ 
              borderColor: colors.creamDark, 
              borderTopColor: colors.gold 
            }}
          />
          <p style={{ color: colors.brownLight }}>Loading Recipe Cost Manager...</p>
        </div>
      </div>
    );
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
      <header className="px-6 py-6 relative">
        <Link
          href="/"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="link-dashboard"
        >
          <HomeIcon className="w-4 h-4" />
          Main Dashboard
        </Link>
        <div className="max-w-7xl mx-auto text-center pt-10">
          <img
            src={logoUrl}
            alt={displayName}
            className="h-20 mx-auto mb-3"
            data-testid="img-logo"
          />
          <h2 className="text-xl font-semibold" style={{ color: colors.brown }}>
            Recipe Cost Manager
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • Part of {orgName}
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
          <VendorsTab ingredients={ingredients} onUpdateIngredientCost={handleUpdateIngredientCost} />
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
          />
        )}
        {activeTab === 'recipes' && (
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
            overheadItems={overheadItems as OverheadItem[]}
            onAddOverheadItem={handleAddOverheadItem}
            onUpdateOverheadItem={handleUpdateOverheadItem}
            onDeleteOverheadItem={handleDeleteOverheadItem}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
