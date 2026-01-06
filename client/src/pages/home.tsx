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
  cost_per_unit?: number | string;
  vendor?: string;
  manufacturer?: string;
  item_number?: string;
}

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
}

interface DrinkSize {
  id: string;
  name: string;
  display_order: number;
}

interface BaseTemplate {
  id: string;
  name: string;
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
      cost: ingredient.cost,
      quantity: ingredient.quantity,
      vendor: ingredient.vendor || '',
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
              className="px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark }}
              data-testid="input-new-ingredient-name"
            />
            <select
              value={newIngredient.category_id}
              onChange={(e) => setNewIngredient({ ...newIngredient, category_id: e.target.value })}
              className="px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark }}
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
              className="px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark }}
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
                <option value="gram">gram</option>
                <option value="each">each</option>
                <option value="count">count</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Vendor"
              value={newIngredient.vendor}
              onChange={(e) => setNewIngredient({ ...newIngredient, vendor: e.target.value })}
              className="px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark }}
              data-testid="input-new-ingredient-vendor"
            />
            <input
              type="text"
              placeholder="Manufacturer"
              value={newIngredient.manufacturer}
              onChange={(e) => setNewIngredient({ ...newIngredient, manufacturer: e.target.value })}
              className="px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark }}
              data-testid="input-new-ingredient-manufacturer"
            />
            <input
              type="text"
              placeholder="Item Number"
              value={newIngredient.item_number}
              onChange={(e) => setNewIngredient({ ...newIngredient, item_number: e.target.value })}
              className="px-3 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark }}
              data-testid="input-new-ingredient-item-number"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.green, color: colors.white }}
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
                <th className="px-4 py-3 text-left font-semibold" style={{ color: colors.brown }}>Vendor</th>
                <th className="px-4 py-3 text-center font-semibold" style={{ color: colors.brown }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient, idx) => (
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
                    {editingId === ingredient.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={String(editForm.cost || '')}
                        onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                        className="w-24 px-2 py-1 rounded border text-right"
                        style={{ borderColor: colors.gold }}
                        data-testid={`input-edit-cost-${ingredient.id}`}
                      />
                    ) : (
                      formatCurrency(ingredient.cost)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brown }}>
                    {editingId === ingredient.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={String(editForm.quantity || '')}
                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                        className="w-20 px-2 py-1 rounded border text-right"
                        style={{ borderColor: colors.gold }}
                        data-testid={`input-edit-quantity-${ingredient.id}`}
                      />
                    ) : (
                      `${ingredient.quantity} ${ingredient.unit}`
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: colors.gold }}>
                    {formatCurrency(ingredient.cost_per_unit || 0)}/{ingredient.unit}
                  </td>
                  <td className="px-4 py-3" style={{ color: colors.brownLight }}>
                    {editingId === ingredient.id ? (
                      <input
                        type="text"
                        value={String(editForm.vendor || '')}
                        onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                        className="w-24 px-2 py-1 rounded border"
                        style={{ borderColor: colors.gold }}
                        data-testid={`input-edit-vendor-${ingredient.id}`}
                      />
                    ) : (
                      ingredient.vendor || '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === ingredient.id ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleSave(ingredient.id)}
                          className="px-3 py-1 rounded font-medium"
                          style={{ backgroundColor: colors.green, color: colors.white }}
                          data-testid={`button-save-${ingredient.id}`}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded font-medium"
                          style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                          data-testid={`button-cancel-${ingredient.id}`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(ingredient)}
                        className="font-medium hover:underline"
                        style={{ color: colors.gold }}
                        data-testid={`button-edit-${ingredient.id}`}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
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
}

const RecipesTab = ({ recipes, productCategories, drinkSizes }: RecipesTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  const filteredRecipes = selectedCategory === 'all'
    ? recipes
    : recipes.filter(r => r.category_id === selectedCategory);

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
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-new-recipe"
        >
          + New Recipe
        </button>
      </div>

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
              <div>
                <h3 className="font-bold" style={{ color: colors.brown }}>{recipe.name}</h3>
                <span className="text-sm" style={{ color: colors.brownLight }}>{recipe.category_name}</span>
              </div>
              <span style={{ color: colors.gold }}>{expandedRecipe === recipe.id ? '▼' : '▶'}</span>
            </div>

            {expandedRecipe === recipe.id && (
              <div className="p-4">
                <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                  Base: {recipe.base_template_name || 'None'}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {drinkSizes.map(size => {
                    const product = recipe.products?.find(p => p.size_id === size.id);
                    return (
                      <div
                        key={size.id}
                        className="rounded-lg p-3 text-center"
                        style={{ backgroundColor: colors.cream }}
                      >
                        <div className="font-semibold mb-2" style={{ color: colors.brown }}>{size.name}</div>
                        <div className="text-xs" style={{ color: colors.brownLight }}>Cost</div>
                        <div className="font-mono" style={{ color: colors.brown }}>
                          {product ? formatCurrency(product.total_cost || 0) : '-'}
                        </div>
                        <div className="text-xs mt-2" style={{ color: colors.brownLight }}>Sale</div>
                        <div className="font-mono font-bold" style={{ color: colors.gold }}>
                          {product ? formatCurrency(product.sale_price || 0) : '-'}
                        </div>
                        {product && product.sale_price > 0 && (
                          <>
                            <div className="text-xs mt-2" style={{ color: colors.brownLight }}>Margin</div>
                            <div
                              className="font-semibold"
                              style={{
                                color: ((product.sale_price - (product.total_cost || 0)) / product.sale_price * 100) >= 30
                                  ? colors.green
                                  : colors.red
                              }}
                            >
                              {formatPercent((product.sale_price - (product.total_cost || 0)) / product.sale_price * 100)}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface PricingTabProps {
  products: Product[];
  drinkSizes: DrinkSize[];
}

const PricingTab = ({ products, drinkSizes }: PricingTabProps) => {
  const productsByRecipe = products.reduce((acc, product) => {
    if (!acc[product.recipe_name]) {
      acc[product.recipe_name] = {
        name: product.recipe_name,
        category: product.category_name,
        sizes: {} as Record<string, Product>,
      };
    }
    acc[product.recipe_name].sizes[product.size_name] = product;
    return acc;
  }, {} as Record<string, { name: string; category: string; sizes: Record<string, Product> }>);

  const recipeList = Object.values(productsByRecipe);

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
              {recipeList.map((recipe, idx) => (
                <tr
                  key={recipe.name}
                  style={{
                    backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                    borderBottom: `1px solid ${colors.creamDark}`,
                  }}
                  data-testid={`row-pricing-${recipe.name}`}
                >
                  <td className="px-4 py-2 font-medium" style={{ color: colors.brown }}>
                    {recipe.name}
                  </td>
                  {drinkSizes.map(size => {
                    const product = recipe.sizes[size.name];
                    if (!product) {
                      return (
                        <Fragment key={size.id}>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                          <td className="px-2 py-2 text-right text-xs" style={{ color: colors.brownLight }}>-</td>
                        </Fragment>
                      );
                    }
                    const cost = product.base_cost + product.ingredient_cost;
                    const profit = product.sale_price - cost;
                    const margin = product.sale_price > 0 ? (profit / product.sale_price * 100) : 0;
                    const marginColor = margin >= 40 ? colors.green : margin >= 25 ? colors.gold : colors.red;

                    return (
                      <Fragment key={size.id}>
                        <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: colors.brown }}>
                          {formatCurrency(cost)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-semibold" style={{ color: colors.brown }}>
                          {formatCurrency(product.sale_price)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs font-semibold" style={{ color: marginColor }}>
                          {formatPercent(margin)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: profit >= 0 ? colors.green : colors.red }}>
                          {formatCurrency(profit)}
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
                style={{ backgroundColor: colors.green, color: colors.white }}
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

import { Fragment } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('ingredients');
  const [loading, setLoading] = useState(true);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientCategories, setIngredientCategories] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productCategories, setProductCategories] = useState<Category[]>([]);
  const [baseTemplates, setBaseTemplates] = useState<BaseTemplate[]>([]);
  const [drinkSizes, setDrinkSizes] = useState<DrinkSize[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [overhead, setOverhead] = useState<OverheadSettings | null>(null);

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
        .select('*');
      setBaseTemplates(baseData || []);

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
          products(*)
        `)
        .eq('is_active', true);

      const formattedRecipes = (recipeData || []).map((r: any) => ({
        ...r,
        category_name: r.product_categories?.name,
        base_template_name: r.base_templates?.name,
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

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIngredient = async (id: string, updates: Partial<Ingredient>) => {
    try {
      const { error } = await supabase
        .from('ingredients')
        .update(updates)
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
            <TabButton active={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')}>
              Ingredients
            </TabButton>
            <TabButton active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')}>
              Recipes
            </TabButton>
            <TabButton active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')}>
              Pricing Matrix
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
        {activeTab === 'recipes' && (
          <RecipesTab
            recipes={recipes}
            ingredients={ingredients}
            productCategories={productCategories}
            baseTemplates={baseTemplates}
            drinkSizes={drinkSizes}
          />
        )}
        {activeTab === 'pricing' && (
          <PricingTab
            products={products}
            drinkSizes={drinkSizes}
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
