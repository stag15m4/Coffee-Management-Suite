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
  equipment: ['equipment'] as const,
  maintenanceTasks: ['maintenance-tasks'] as const,
  maintenanceLogs: ['maintenance-logs'] as const,
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

// =====================================================
// EQUIPMENT MAINTENANCE HOOKS
// =====================================================

export interface Equipment {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTask {
  id: string;
  tenant_id: string;
  equipment_id: string;
  name: string;
  description: string | null;
  interval_type: 'time' | 'usage';
  interval_days: number | null;
  interval_units: number | null;
  usage_unit_label: string | null;
  current_usage: number;
  last_completed_at: string | null;
  next_due_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  equipment?: Equipment;
}

export interface MaintenanceLog {
  id: string;
  tenant_id: string;
  task_id: string;
  completed_at: string;
  completed_by: string | null;
  notes: string | null;
  usage_at_completion: number | null;
  created_at: string;
}

export function useEquipment() {
  return useQuery({
    queryKey: queryKeys.equipment,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Equipment[];
    },
    staleTime: 30 * 1000,
  });
}

export function useMaintenanceTasks() {
  return useQuery({
    queryKey: queryKeys.maintenanceTasks,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .select(`
          *,
          equipment(*)
        `)
        .eq('is_active', true)
        .order('next_due_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as MaintenanceTask[];
    },
    staleTime: 30 * 1000,
  });
}

export function useMaintenanceLogs(taskId?: string) {
  return useQuery({
    queryKey: [...queryKeys.maintenanceLogs, taskId],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_logs')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(50);
      
      if (taskId) {
        query = query.eq('task_id', taskId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MaintenanceLog[];
    },
    staleTime: 30 * 1000,
  });
}

export function useAddEquipment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (equipment: { tenant_id: string; name: string; category?: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('equipment')
        .insert(equipment)
        .select();
      if (error) throw error;
      return data?.[0] as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Equipment> }) => {
      const { data, error } = await supabase
        .from('equipment')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0] as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks });
    },
  });
}

export function useAddMaintenanceTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (task: {
      tenant_id: string;
      equipment_id: string;
      name: string;
      description?: string;
      interval_type: 'time' | 'usage';
      interval_days?: number;
      interval_units?: number;
      usage_unit_label?: string;
      current_usage?: number;
    }) => {
      const now = new Date();
      let next_due_at: string | null = null;
      
      if (task.interval_type === 'time' && task.interval_days) {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + task.interval_days);
        next_due_at = dueDate.toISOString();
      }
      
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .insert({
          ...task,
          next_due_at,
          last_completed_at: now.toISOString(),
        })
        .select();
      if (error) throw error;
      return data?.[0] as MaintenanceTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks });
    },
  });
}

export function useUpdateMaintenanceTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MaintenanceTask> }) => {
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0] as MaintenanceTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks });
    },
  });
}

export function useDeleteMaintenanceTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_tasks')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks });
    },
  });
}

export function useLogMaintenance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ tenantId, taskId, completedBy, notes, usageAtCompletion }: {
      tenantId: string;
      taskId: string;
      completedBy?: string;
      notes?: string;
      usageAtCompletion?: number;
    }) => {
      const now = new Date();
      
      const { data: logData, error: logError } = await supabase
        .from('maintenance_logs')
        .insert({
          tenant_id: tenantId,
          task_id: taskId,
          completed_at: now.toISOString(),
          completed_by: completedBy,
          notes,
          usage_at_completion: usageAtCompletion,
        })
        .select();
      if (logError) throw logError;
      
      const { data: taskData } = await supabase
        .from('maintenance_tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (taskData) {
        let next_due_at: string | null = null;
        let current_usage = taskData.current_usage || 0;
        
        if (taskData.interval_type === 'time' && taskData.interval_days) {
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + taskData.interval_days);
          next_due_at = dueDate.toISOString();
        } else if (taskData.interval_type === 'usage' && taskData.interval_units && usageAtCompletion !== undefined) {
          current_usage = usageAtCompletion;
        }
        
        await supabase
          .from('maintenance_tasks')
          .update({
            last_completed_at: now.toISOString(),
            next_due_at,
            current_usage,
            updated_at: now.toISOString(),
          })
          .eq('id', taskId);
      }
      
      return logData?.[0] as MaintenanceLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceLogs });
    },
  });
}

export function useUpdateUsage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ taskId, currentUsage }: { taskId: string; currentUsage: number }) => {
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .update({
          current_usage: currentUsage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select();
      if (error) throw error;
      return data?.[0] as MaintenanceTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks });
    },
  });
}
