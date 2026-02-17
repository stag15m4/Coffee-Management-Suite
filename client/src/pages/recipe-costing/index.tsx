import { useState, useMemo, useCallback } from 'react';
import { useSearch, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { showDeleteUndoToast } from '@/hooks/use-delete-with-undo';
import { useAuth } from '@/contexts/AuthContext';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { IngredientsTab } from './IngredientsTab';
import { RecipesTab } from './RecipesTab';
import { PricingTab } from './PricingTab';
import { OverheadTab } from './OverheadTab';
import { RecipeSettings } from './RecipeSettings';
import { BaseTemplatesTab } from './BaseTemplatesTab';
import { VendorsTab } from './VendorsTab';
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
} from '@/lib/supabase-queries';
import { colors } from '@/lib/colors';
import { calculateCostPerUsageUnit } from './utils';
import type {
  Ingredient,
  Recipe,
  OverheadSettings,
  OverheadItem,
  RecipeSizeBase,
  RecipeIngredient,
} from './types';

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Settings drawer sub-tabs
// ---------------------------------------------------------------------------

type SettingsSection = 'overhead' | 'bases' | 'vendors' | 'settings';

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'overhead', label: 'Overhead Calculator' },
  { id: 'bases', label: 'Recipe Bases' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'settings', label: 'Settings & Export' },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RecipeCostingPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const activeTab = new URLSearchParams(searchString).get('tab') || 'pricing';
  const setActiveTab = useCallback((tab: string) => {
    setLocation(`/recipe-costing?tab=${tab}`);
  }, [setLocation]);
  const queryClient = useQueryClient();
  const { profile, tenant, branding, primaryTenant, adminViewingTenant } = useAuth();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Settings drawer
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('overhead');

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Recipe Costing');
  const orgName = primaryTenant?.name || branding?.company_name || '';

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------

  const { data: ingredientCategories = [], isLoading: loadingCategories, isError: errorCategories } = useIngredientCategories();
  const { data: ingredients = [], isLoading: loadingIngredients, isError: errorIngredients } = useIngredients();
  const { data: productCategories = [], isLoading: loadingProductCategories, isError: errorProductCategories } = useProductCategories();
  const { data: baseTemplates = [], isLoading: loadingBaseTemplates, isError: errorBaseTemplates } = useBaseTemplates();
  const { data: drinkSizes = [], isLoading: loadingDrinkSizes, isError: errorDrinkSizes } = useDrinkSizes();
  const { data: recipes = [], isLoading: loadingRecipes, isError: errorRecipes } = useRecipes();
  const { data: overhead, isLoading: loadingOverhead, isError: errorOverhead } = useOverhead();
  const { data: overheadItems = [], isLoading: loadingOverheadItems } = useOverheadItems();
  const { data: pricingData = [], isLoading: loadingPricing, isError: errorPricing } = useRecipePricing();
  const { data: recipeSizeBases = [], isLoading: loadingRecipeSizeBases, isError: errorRecipeSizeBases } = useRecipeSizeBases();
  const { data: cashActivity = [] } = useCashActivityRevenue();
  const { data: recipeVendors = [] } = useRecipeVendors();
  const addVendorMutation = useAddRecipeVendor();
  const updateVendorMutation = useUpdateRecipeVendor();
  const deleteVendorMutation = useDeleteRecipeVendor();

  // Mutation hooks
  const updateIngredientMutation = useUpdateIngredient();
  const addIngredientMutation = useAddIngredient();
  const updateOverheadMutation = useUpdateOverhead();
  const addOverheadItemMutation = useAddOverheadItem();
  const updateOverheadItemMutation = useUpdateOverheadItem();
  const deleteOverheadItemMutation = useDeleteOverheadItem();
  const updateRecipePricingMutation = useUpdateRecipePricing();
  const updateRecipeSizeBaseMutation = useUpdateRecipeSizeBase();

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const calculatedCostPerMinute = useMemo(() => {
    const operatingDays = Math.max(1, overhead?.operating_days_per_week || 7);
    const hoursPerDay = Math.max(1, overhead?.hours_open_per_day || 8);
    const weeksPerMonth = 4.33;
    const daysPerMonth = operatingDays * weeksPerMonth;
    const minutesPerMonth = hoursPerDay * 60 * daysPerMonth;

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

  const enhancedOverhead = useMemo(() => {
    if (!overhead) return overhead;
    return { ...overhead, cost_per_minute: calculatedCostPerMinute };
  }, [overhead, calculatedCostPerMinute]);

  const includedCashDays = useMemo(() => cashActivity.filter((e: any) => !e.excluded_from_average), [cashActivity]);
  const avgDailyRevenue = useMemo(() => {
    if (includedCashDays.length === 0) return 0;
    const total = includedCashDays.reduce((sum: number, entry: any) => sum + (Number(entry.gross_revenue) || 0), 0);
    return total / includedCashDays.length;
  }, [includedCashDays]);

  // ---------------------------------------------------------------------------
  // Loading / error
  // ---------------------------------------------------------------------------

  const loading = loadingCategories || loadingIngredients || loadingProductCategories ||
                  loadingBaseTemplates || loadingDrinkSizes || loadingRecipes ||
                  loadingOverhead || loadingPricing || loadingRecipeSizeBases;

  const hasError = errorCategories || errorIngredients || errorProductCategories ||
                   errorBaseTemplates || errorDrinkSizes || errorRecipes ||
                   errorOverhead || errorPricing || errorRecipeSizeBases;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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
      const { error: ingError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      if (ingError) throw ingError;

      const { error: syrupIngError } = await supabase.from('recipe_ingredients').delete().eq('syrup_recipe_id', recipeId);
      if (syrupIngError) throw syrupIngError;

      const { error: baseError } = await supabase.from('recipe_size_bases').delete().eq('recipe_id', recipeId);
      if (baseError) throw baseError;

      const { error: pricingError } = await supabase.from('recipe_size_pricing').delete().eq('recipe_id', recipeId);
      if (pricingError) throw pricingError;

      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (error) throw error;
      invalidateRecipeData();
      showDeleteUndoToast({ itemName: name, undo: { type: 'none' } });
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
        .from('product_sizes')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
      const nextOrder = (maxOrder?.[0]?.display_order || 0) + 1;

      const { error } = await supabase
        .from('product_sizes')
        .insert({ name, size_oz: oz, display_order: nextOrder, drink_type: 'bulk', tenant_id: profile?.tenant_id });

      if (error) {
        console.error('Supabase error adding bulk size:', error);
        alert('Error adding bulk size: ' + error.message + '\n\nMake sure your Supabase RLS policies allow inserts on the product_sizes table.');
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
        .from('product_sizes')
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
      .from('product_sizes')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    const nextOrder = (maxOrder?.[0]?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('product_sizes')
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

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return <CoffeeLoader fullScreen />;
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center p-8 rounded-lg max-w-md" style={{ backgroundColor: colors.white }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: colors.brown }}>Connection Issue</h2>
          <p className="mb-4" style={{ color: colors.brownLight }}>
            Unable to load Menu Cost Manager data. This could be:
          </p>
          <ul className="text-left mb-4 text-sm space-y-1" style={{ color: colors.brownLight }}>
            <li>• Menu costing tables may not exist in database</li>
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
              Menu Cost Manager
            </h2>
            {isChildLocation && orgName && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {displayName} &bull; {orgName}
              </p>
            )}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: colors.brownLight }}
            title="Settings"
            data-testid="button-settings-gear"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1 border-b-2 flex-wrap" style={{ borderColor: colors.creamDark }}>
            <TabButton active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')}>
              Menu Pricing
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
        {activeTab === 'ingredients' && (
          <IngredientsTab
            ingredients={ingredients}
            categories={ingredientCategories}
            onUpdate={handleUpdateIngredient}
            onAdd={handleAddIngredient}
            onDelete={handleDeleteIngredient}
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
            onAddTemplate={handleAddBaseTemplate}
            onAddTemplateIngredient={handleAddTemplateIngredient}
            onDeleteTemplateIngredient={handleDeleteTemplateIngredient}
            onDeleteTemplate={handleDeleteBaseTemplate}
            onAddDrinkSize={handleAddDrinkSize}
            onRemoveTemplateSize={handleRemoveTemplateSize}
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
          <RecipeSettings
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

      {/* Settings Drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:w-[600px] md:w-[700px] lg:w-[800px] p-0 overflow-y-auto">
          <div className="p-4 border-b" style={{ borderColor: colors.creamDark }}>
            <SheetTitle className="text-lg font-bold" style={{ color: colors.brown }}>
              Settings
            </SheetTitle>
            <div className="flex gap-1 mt-3 flex-wrap">
              {SETTINGS_SECTIONS.map(section => (
                <button
                  key={section.id}
                  onClick={() => setSettingsSection(section.id)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: settingsSection === section.id ? colors.gold : colors.cream,
                    color: settingsSection === section.id ? colors.white : colors.brownLight,
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {settingsSection === 'overhead' && (
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
            {settingsSection === 'bases' && (
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
            {settingsSection === 'vendors' && (
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
            {settingsSection === 'settings' && (
              <RecipeSettings
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
          </div>
        </SheetContent>
      </Sheet>

      {ConfirmDialog}
    </div>
  );
}
