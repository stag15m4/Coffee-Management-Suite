import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-queries";
import { useAuth } from "@/contexts/AuthContext";

export interface Recipe {
  id: number;
  name: string;
  servings: number;
  instructions: string | null;
  tenant_id: string;
  created_at?: string;
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price: string;
  amount: string;
  tenant_id: string;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  quantity: string;
  ingredient: Ingredient;
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: RecipeIngredient[];
}

export function useRecipes() {
  const { tenant } = useAuth();
  
  return useQuery({
    queryKey: ['recipes', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');
      
      if (error) throw error;
      return data as Recipe[];
    },
    enabled: !!tenant?.id,
  });
}

export function useRecipe(id: number) {
  const { tenant } = useAuth();
  
  return useQuery({
    queryKey: ['recipes', tenant?.id, id],
    queryFn: async () => {
      if (!tenant?.id || !id) return null;
      
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .single();
      
      if (recipeError) {
        if (recipeError.code === 'PGRST116') return null;
        throw recipeError;
      }
      
      const { data: recipeIngredients, error: riError } = await supabase
        .from('recipe_ingredients')
        .select(`
          id,
          recipe_id,
          ingredient_id,
          quantity,
          ingredient:ingredients(*)
        `)
        .eq('recipe_id', id);
      
      if (riError) throw riError;
      
      return {
        ...recipe,
        ingredients: recipeIngredients || []
      } as RecipeWithIngredients;
    },
    enabled: !!tenant?.id && !!id && !isNaN(id),
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { name: string; servings: number; instructions?: string }) => {
      if (!tenant?.id) throw new Error('No tenant context');
      
      const { data: recipe, error } = await supabase
        .from('recipes')
        .insert({
          name: data.name,
          servings: data.servings,
          instructions: data.instructions || null,
          tenant_id: tenant.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', tenant?.id] });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; name?: string; servings?: number; instructions?: string }) => {
      if (!tenant?.id) throw new Error('No tenant context');
      
      const { data: recipe, error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .single();
      
      if (error) throw error;
      return recipe;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['recipes', tenant?.id, data.id] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  
  return useMutation({
    mutationFn: async (id: number) => {
      if (!tenant?.id) throw new Error('No tenant context');
      
      const { error: riError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', id);
      
      if (riError) throw riError;
      
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', tenant?.id] });
    },
  });
}

export function useAddRecipeIngredient() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  
  return useMutation({
    mutationFn: async ({ recipeId, ingredientId, quantity }: { recipeId: number; ingredientId: number; quantity: number }) => {
      if (!tenant?.id) throw new Error('No tenant context');
      
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .insert({
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          quantity: quantity.toString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', tenant?.id, variables.recipeId] });
    },
  });
}

export function useDeleteRecipeIngredient() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  return useMutation({
    mutationFn: async ({ recipeId, id }: { recipeId: number; id: number }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Add timeout to prevent hanging
      const deletePromise = supabase
        .from('recipe_ingredients')
        .delete()
        .eq('id', id)
        .eq('recipe_id', recipeId); // Ensure ingredient belongs to specified recipe

      const { error } = await Promise.race([
        deletePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Delete operation timeout')), 5000)
        )
      ]);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', tenant?.id, variables.recipeId] });
    },
  });
}
