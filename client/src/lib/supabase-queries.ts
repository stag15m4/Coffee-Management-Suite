import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

export const queryKeys = {
  ingredientCategories: ['ingredient-categories'] as const,
  ingredients: ['ingredients'] as const,
  productCategories: ['product-categories'] as const,
  baseTemplates: ['base-templates'] as const,
  drinkSizes: ['drink-sizes'] as const,
  recipes: ['recipes'] as const,
  products: ['products'] as const,
  overhead: ['overhead'] as const,
  recipePricing: ['recipe-pricing'] as const,
  recipeSizeBases: ['recipe-size-bases'] as const,
};

export function useIngredientCategories() {
  return useQuery({
    queryKey: queryKeys.ingredientCategories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredient_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useIngredients() {
  return useQuery({
    queryKey: queryKeys.ingredients,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_ingredients')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBaseTemplates() {
  return useQuery({
    queryKey: queryKeys.baseTemplates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('base_templates')
        .select(`
          *,
          base_template_ingredients(*)
        `);
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        ingredients: b.base_template_ingredients || [],
      }));
    },
    staleTime: 60 * 1000,
  });
}

export function useDrinkSizes() {
  return useQuery({
    queryKey: queryKeys.drinkSizes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_sizes')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          product_categories(name),
          base_templates(name),
          products(*),
          recipe_ingredients!recipe_ingredients_recipe_id_fkey(*)
        `)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        category_name: r.product_categories?.name,
        base_template_name: r.base_templates?.name,
        recipe_ingredients: r.recipe_ingredients || [],
      }));
    },
    staleTime: 30 * 1000,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_product_pricing')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useOverhead() {
  return useQuery({
    queryKey: queryKeys.overhead,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overhead_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecipePricing() {
  return useQuery({
    queryKey: queryKeys.recipePricing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_size_pricing')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useRecipeSizeBases() {
  return useQuery({
    queryKey: queryKeys.recipeSizeBases,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_size_bases')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const safeUpdates: Record<string, any> = {};
      const allowedFields = ['name', 'category_id', 'ingredient_type', 'cost', 'quantity', 'unit', 'usage_unit', 'vendor', 'manufacturer', 'item_number', 'updated_at'];
      
      for (const key of allowedFields) {
        if (key in updates) {
          safeUpdates[key] = updates[key];
        }
      }
      safeUpdates.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('ingredients')
        .update(safeUpdates)
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Update returned no data - check RLS policies in Supabase');
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredients });
    },
  });
}

export function useAddIngredient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ingredient: Record<string, any>) => {
      const { data, error } = await supabase
        .from('ingredients')
        .insert(ingredient)
        .select();
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredients });
    },
  });
}

export function useUpdateOverhead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('overhead_settings')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overhead });
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

export function useUpdateRecipePricing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ recipeId, sizeId, salePrice, existingId }: { recipeId: string; sizeId: string; salePrice: number; existingId?: string }) => {
      if (existingId) {
        const { error } = await supabase
          .from('recipe_size_pricing')
          .update({ sale_price: salePrice, updated_at: new Date().toISOString() })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('recipe_size_pricing')
          .insert({ recipe_id: recipeId, size_id: sizeId, sale_price: salePrice });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipePricing });
    },
  });
}

export function useUpdateRecipeSizeBase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ recipeId, sizeId, baseTemplateId, existingId }: { recipeId: string; sizeId: string; baseTemplateId: string | null; existingId?: string }) => {
      if (baseTemplateId) {
        if (existingId) {
          const { error } = await supabase
            .from('recipe_size_bases')
            .update({ base_template_id: baseTemplateId })
            .eq('id', existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recipe_size_bases')
            .insert({ recipe_id: recipeId, size_id: sizeId, base_template_id: baseTemplateId });
          if (error) throw error;
        }
      } else if (existingId) {
        const { error } = await supabase
          .from('recipe_size_bases')
          .delete()
          .eq('id', existingId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipeSizeBases });
    },
  });
}
