import { useState } from 'react';
import { Trash2, Pencil, Copy, BookOpen } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { colors } from '@/lib/colors';
import { formatCurrency, calculateCostPerUsageUnit } from './utils';
import type {
  Recipe,
  Ingredient,
  Category,
  BaseTemplate,
  BaseTemplateIngredient,
  DrinkSize,
  OverheadSettings,
  RecipeSizeBase,
  RecipeIngredient,
} from './types';

interface RecipesTabProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  productCategories: Category[];
  baseTemplates: BaseTemplate[];
  drinkSizes: DrinkSize[];
  overhead: OverheadSettings | null;
  recipeSizeBases: RecipeSizeBase[];
  onAddRecipe: (recipe: { name: string; category_id: string; base_template_id?: string; is_bulk_recipe?: boolean }) => Promise<void>;
  onUpdateRecipe: (id: string, updates: { name?: string; category_id?: string; base_template_id?: string | null; is_bulk_recipe?: boolean; minutes_per_drink?: number | null }) => Promise<void>;
  onAddRecipeIngredient: (ingredient: { recipe_id: string; ingredient_id?: string | null; size_id: string; quantity: number; unit?: string; syrup_recipe_id?: string | null }) => Promise<void>;
  onDeleteRecipeIngredient: (id: string) => Promise<void>;
  onUpdateRecipeSizeBase: (recipeId: string, sizeId: string, baseTemplateId: string | null) => Promise<void>;
  onDuplicateRecipe: (recipe: Recipe) => Promise<void>;
  onDeleteRecipe: (recipeId: string) => Promise<void>;
  onAddBulkSize: (name: string, oz: number) => Promise<boolean>;
  onDeleteBulkSize: (sizeId: string) => Promise<void>;
}

export const RecipesTab = ({ recipes, ingredients, productCategories, drinkSizes, baseTemplates, overhead, recipeSizeBases, onAddRecipe, onUpdateRecipe, onAddRecipeIngredient, onDeleteRecipeIngredient, onUpdateRecipeSizeBase, onDuplicateRecipe, onDeleteRecipe, onAddBulkSize, onDeleteBulkSize }: RecipesTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
  const [editRecipeForm, setEditRecipeForm] = useState({ name: '', category_id: '', base_template_id: '', is_bulk_recipe: false, minutes_per_drink: '' });
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

    // Add overhead time cost for making the batch
    if (overhead && bulkRecipe.minutes_per_drink != null) {
      totalCost += (overhead.cost_per_minute || 0) * bulkRecipe.minutes_per_drink;
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
        // Add overhead cost to base
        if (overhead && baseTemplate) {
          const recipeMinutes = recipe.minutes_per_drink ?? overhead.minutes_per_drink ?? 1;
          const overheadCost = (overhead.cost_per_minute || 0) * recipeMinutes;
          totalCost += overheadCost;
        }
      }
    } else if (overhead && recipe.minutes_per_drink != null) {
      // Bulk recipes: add overhead time cost for making the batch
      totalCost += (overhead.cost_per_minute || 0) * recipe.minutes_per_drink;
    }

    return totalCost;
  };

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
      minutes_per_drink: recipe.minutes_per_drink != null ? String(recipe.minutes_per_drink) : '',
    });
  };

  const handleSaveRecipe = async (id: string) => {
    await onUpdateRecipe(id, {
      name: editRecipeForm.name,
      category_id: editRecipeForm.category_id,
      base_template_id: editRecipeForm.base_template_id || null,
      is_bulk_recipe: editRecipeForm.is_bulk_recipe,
      minutes_per_drink: editRecipeForm.minutes_per_drink !== '' ? parseFloat(editRecipeForm.minutes_per_drink) : null,
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
                style={{ backgroundColor: colors.gold, color: colors.white }}
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
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editRecipeForm.minutes_per_drink}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setEditRecipeForm({ ...editRecipeForm, minutes_per_drink: val });
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder={String(overhead?.minutes_per_drink ?? 1)}
                      className="w-16 px-2 py-1 rounded border-0 text-right"
                      style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                      data-testid={`input-edit-recipe-minutes-${recipe.id}`}
                    />
                    <span className="text-xs" style={{ color: colors.brownLight }}>min</span>
                  </div>
                  <button
                    onClick={() => handleSaveRecipe(recipe.id)}
                    className="px-3 py-1 rounded font-medium"
                    style={{ backgroundColor: colors.gold, color: colors.white }}
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold" style={{ color: colors.brown }}>{recipe.name}</h3>
                      {recipe.minutes_per_drink != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.cream, color: colors.brownLight }}>
                          {recipe.minutes_per_drink}m
                        </span>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: colors.brownLight }}>{recipe.category_name}</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditRecipe(recipe); }}
                          className="p-1 rounded"
                          style={{ color: colors.brownLight }}
                          data-testid={`button-edit-recipe-${recipe.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDuplicateRecipe(recipe); }}
                          className="p-1 rounded"
                          style={{ color: colors.brownLight }}
                          data-testid={`button-duplicate-recipe-${recipe.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicate</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteRecipe(recipe.id); }}
                          className="p-1 rounded"
                          style={{ color: colors.brownLight }}
                          data-testid={`button-delete-recipe-${recipe.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                        style={{ backgroundColor: colors.gold, color: colors.white }}
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
                      : (() => {
                          const foodSizes = drinkSizes.filter(s => !s.name.toLowerCase().includes('bulk') && s.drink_type?.toLowerCase() === 'food');
                          const drinkTypeSizes = drinkSizes.filter(s => !s.name.toLowerCase().includes('bulk') && s.drink_type?.toLowerCase() !== 'food');
                          const foodSizeIds = foodSizes.map(s => s.id);
                          const hasFoodIngredients = recipe.recipe_ingredients?.some(ri => foodSizeIds.includes(ri.size_id)) || false;
                          return hasFoodIngredients ? foodSizes : drinkTypeSizes;
                        })()
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
                                  onClick={() => onDeleteBulkSize(size.id)}
                                  className="p-1 rounded"
                                  style={{ color: colors.brownLight }}
                                  data-testid={`button-delete-bulk-size-${size.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
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

                              {(() => {
                                const ohMinutes = recipe.minutes_per_drink ?? overhead?.minutes_per_drink ?? 1;
                                const ohCost = (overhead?.cost_per_minute || 0) * ohMinutes;
                                return (baseTemplateItems.length > 0 || (currentBaseId && ohCost > 0)) ? (
                                <div className="mb-2">
                                  <span className="text-xs font-medium" style={{ color: colors.brownLight }}>Base (Disposables):</span>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {baseTemplateItems.map(bi => {
                                      const ing = ingredients.find(i => i.id === bi.ingredient_id);
                                      const itemCost = ing ? bi.quantity * getIngredientCostPerUnit(ing) : 0;
                                      const displayUnit = bi.unit || ing?.usage_unit || ing?.unit || 'each';
                                      return (
                                        <div
                                          key={bi.id}
                                          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                          style={{ backgroundColor: colors.creamDark }}
                                        >
                                          <span style={{ color: colors.brown }}>{ing?.name || 'Unknown'}</span>
                                          <span style={{ color: colors.brownLight }}>({bi.quantity} {displayUnit})</span>
                                          <span style={{ color: colors.gold }}>({formatCurrency(itemCost)})</span>
                                        </div>
                                      );
                                    })}
                                    {currentBaseId && overhead && ohCost > 0 && (
                                      <div
                                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                        style={{ backgroundColor: colors.white, border: `1px dashed ${colors.brownLight}` }}
                                      >
                                        <span style={{ color: colors.brown }}>Shop Overhead</span>
                                        <span style={{ color: colors.gold }}>({formatCurrency(ohCost)}{recipe.minutes_per_drink != null ? ` · ${ohMinutes}m` : ''})</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null; })()}
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
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                onClick={() => onDeleteRecipeIngredient(ri.id)}
                                                className="ml-1 p-0.5 rounded"
                                                style={{ color: colors.brownLight }}
                                                data-testid={`button-delete-ri-${ri.id}`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent>Remove</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
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
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => onDeleteRecipeIngredient(ri.id)}
                                              className="ml-1 p-0.5 rounded"
                                              style={{ color: colors.brownLight }}
                                              data-testid={`button-delete-ri-${ri.id}`}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>Remove</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
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
                                style={{ backgroundColor: colors.gold, color: colors.white }}
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
                              className="text-sm px-3 py-1 rounded font-medium"
                              style={{ color: colors.gold, border: `1px solid ${colors.gold}` }}
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
        {filteredRecipes.length === 0 && (
          <div className="text-center py-10">
            <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No recipes yet</h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Add ingredients first, then create recipes to calculate your costs and margins.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
