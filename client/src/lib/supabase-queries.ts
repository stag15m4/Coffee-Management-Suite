import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';

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
  overheadItems: ['overhead-items'] as const,
  recipePricing: ['recipe-pricing'] as const,
  recipeSizeBases: ['recipe-size-bases'] as const,
  equipment: ['equipment'] as const,
  maintenanceTasks: ['maintenance-tasks'] as const,
  maintenanceLogs: ['maintenance-logs'] as const,
  equipmentAttachments: ['equipment-attachments'] as const,
  taskAttachments: ['task-attachments'] as const,
  cashActivity: ['cash-activity'] as const,
  recipeVendors: ['recipe-vendors'] as const,
};

export function useIngredientCategories() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.ingredientCategories, tenant?.id],
    queryFn: async () => {
      let query = supabase.from('ingredient_categories').select('*');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useIngredients() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.ingredients, tenant?.id],
    queryFn: async () => {
      // Query ingredients table directly (not v_ingredients view) so we can filter by tenant_id
      let query = supabase
        .from('ingredients')
        .select('*, ingredient_categories(name)')
        .eq('is_active', true);
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        category_name: row.ingredient_categories?.name ?? null,
      }));
    },
    staleTime: 30 * 1000,
  });
}

export function useProductCategories() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.productCategories, tenant?.id],
    queryFn: async () => {
      let query = supabase.from('product_categories').select('*');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBaseTemplates() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.baseTemplates, tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('base_templates')
        .select(`
          *,
          base_template_ingredients(*)
        `);
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query;
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
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.drinkSizes, tenant?.id],
    queryFn: async () => {
      let query = supabase.from('product_sizes').select('*');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('display_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecipes() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.recipes, tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select(`
          *,
          product_categories(name),
          base_templates(name),
          products(*),
          recipe_ingredients!recipe_ingredients_recipe_id_fkey(*)
        `)
        .eq('is_active', true);
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query;
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
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.overhead, tenant?.id],
    queryFn: async () => {
      let query = supabase.from('overhead_settings').select('*');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.limit(1).maybeSingle();
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
      // recipe_size_pricing has no tenant_id column — tenant isolation via recipe_id + RLS
      const { data, error } = await supabase.from('recipe_size_pricing').select('*');
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
      // recipe_size_bases has no tenant_id column — tenant isolation via recipe_id + RLS
      const { data, error } = await supabase.from('recipe_size_bases').select('*');
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

export function useOverheadItems() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.overheadItems, tenant?.id],
    queryFn: async () => {
      let query = supabase.from('overhead_items').select('*');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useCashActivityRevenue() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.cashActivity, tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('cash_activity')
        .select('drawer_date, gross_revenue, excluded_from_average')
        .or('archived.is.null,archived.eq.false');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('drawer_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface RecipeVendor {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useRecipeVendors() {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.recipeVendors, tenant?.id],
    queryFn: async () => {
      let query = supabase.from('recipe_vendors').select('*');
      if (tenant?.id) query = query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as RecipeVendor[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddRecipeVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vendor: { tenant_id: string; name: string; phone?: string; email?: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('recipe_vendors')
        .insert(vendor)
        .select()
        .single();
      if (error) throw error;
      return data as RecipeVendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipeVendors });
    },
  });
}

export function useUpdateRecipeVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RecipeVendor> }) => {
      const { data, error } = await supabase
        .from('recipe_vendors')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RecipeVendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipeVendors });
    },
  });
}

export function useDeleteRecipeVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recipe_vendors')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipeVendors });
      queryClient.invalidateQueries({ queryKey: queryKeys.ingredients });
    },
  });
}

export function useAddOverheadItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: { tenant_id: string; name: string; amount: number; frequency: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from('overhead_items')
        .insert(item)
        .select();
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overheadItems });
    },
  });
}

export function useUpdateOverheadItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; amount?: number; frequency?: string; sort_order?: number } }) => {
      const { data, error } = await supabase
        .from('overhead_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overheadItems });
    },
  });
}

export function useDeleteOverheadItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('overhead_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overheadItems });
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
  has_warranty: boolean;
  purchase_date: string | null;
  warranty_duration_months: number | null;
  warranty_notes: string | null;
  document_url: string | null;
  document_name: string | null;
  in_service_date: string | null;
  photo_url: string | null;
  license_state: string | null;
  license_plate: string | null;
  vin: string | null;
  model: string | null;
  serial_number: string | null;
}

export interface MaintenanceTask {
  id: string;
  tenant_id: string;
  equipment_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  interval_type: 'time' | 'usage';
  interval_days: number | null;
  interval_units: number | null;
  usage_unit_label: string | null;
  current_usage: number;
  last_completed_at: string | null;
  next_due_at: string | null;
  estimated_cost: number | null;
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
  cost: number | null;
  created_at: string;
}

export function useEquipment(tenantId?: string) {
  return useQuery({
    queryKey: [...queryKeys.equipment, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as Equipment[];
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    retry: 2,
  });
}

export function useMaintenanceTasks(tenantId?: string) {
  return useQuery({
    queryKey: [...queryKeys.maintenanceTasks, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .select(`
          *,
          equipment(*)
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('next_due_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as MaintenanceTask[];
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    retry: 2,
  });
}

export function useMaintenanceLogs(tenantId?: string, taskId?: string) {
  return useQuery({
    queryKey: [...queryKeys.maintenanceLogs, tenantId, taskId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from('maintenance_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MaintenanceLog[];
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });
}

export function useAddEquipment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (equipment: { 
      tenant_id: string; 
      name: string; 
      category?: string; 
      notes?: string;
      has_warranty?: boolean;
      purchase_date?: string;
      warranty_duration_months?: number;
      warranty_notes?: string;
      document_url?: string;
      document_name?: string;
      in_service_date?: string;
      photo_url?: string;
      license_state?: string;
      license_plate?: string;
      vin?: string;
      model?: string;
      serial_number?: string;
    }) => {
      const { data, error } = await supabase
        .from('equipment')
        .insert(equipment)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Insert failed - check RLS policies in Supabase.');
      }
      return data[0] as Equipment;
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

// =====================================================
// EQUIPMENT ATTACHMENTS
// =====================================================

export interface EquipmentAttachment {
  id: string;
  tenant_id: string;
  equipment_id: string;
  attachment_type: 'file' | 'link';
  name: string;
  url: string;
  file_type: string | null;
  created_at: string;
}

export function useEquipmentAttachments(equipmentId?: string) {
  return useQuery({
    queryKey: [...queryKeys.equipmentAttachments, equipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_attachments')
        .select('*')
        .eq('equipment_id', equipmentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EquipmentAttachment[];
    },
    enabled: !!equipmentId,
    staleTime: 30 * 1000,
  });
}

export function useAddEquipmentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: {
      tenant_id: string;
      equipment_id: string;
      attachment_type: 'file' | 'link';
      name: string;
      url: string;
      file_type?: string;
    }) => {
      const { data, error } = await supabase
        .from('equipment_attachments')
        .insert(attachment)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Insert failed - check RLS policies.');
      return data[0] as EquipmentAttachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipmentAttachments });
    },
  });
}

export function useDeleteEquipmentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment_attachments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipmentAttachments });
    },
  });
}

// =====================================================
// TASK ATTACHMENTS
// =====================================================

export interface TaskAttachment {
  id: string;
  tenant_id: string;
  task_id: string;
  attachment_type: 'file' | 'link' | 'video';
  name: string;
  url: string;
  file_type: string | null;
  created_at: string;
}

export function useTaskAttachments(taskId?: string) {
  return useQuery({
    queryKey: [...queryKeys.taskAttachments, taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_task_attachments')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TaskAttachment[];
    },
    enabled: !!taskId,
    staleTime: 30 * 1000,
  });
}

export function useAddTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: {
      tenant_id: string;
      task_id: string;
      attachment_type: 'file' | 'link' | 'video';
      name: string;
      url: string;
      file_type?: string;
    }) => {
      const { data, error } = await supabase
        .from('maintenance_task_attachments')
        .insert(attachment)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Insert failed - check RLS policies.');
      return data[0] as TaskAttachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments });
    },
  });
}

export function useDeleteTaskAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_task_attachments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments });
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
      image_url?: string;
      interval_type: 'time' | 'usage';
      interval_days?: number;
      interval_units?: number;
      usage_unit_label?: string;
      current_usage?: number;
      last_completed_at?: string;
      next_due_at?: string;
      estimated_cost?: number;
    }) => {
      // Only auto-calculate if last_completed_at not provided
      let next_due_at: string | null = task.next_due_at || null;
      let last_completed_at: string | null = task.last_completed_at || null;
      
      // If no last serviced date provided, don't set one (task has never been done)
      // If time-based and no next_due_at calculated yet, leave it null until first service
      
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .insert({
          tenant_id: task.tenant_id,
          equipment_id: task.equipment_id,
          name: task.name,
          description: task.description,
          image_url: task.image_url,
          interval_type: task.interval_type,
          interval_days: task.interval_days,
          interval_units: task.interval_units,
          usage_unit_label: task.usage_unit_label,
          current_usage: task.current_usage,
          next_due_at,
          last_completed_at,
          estimated_cost: task.estimated_cost,
        })
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Insert failed - check RLS policies in Supabase.');
      }
      return data[0] as MaintenanceTask;
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
    mutationFn: async ({ tenantId, taskId, completedBy, notes, usageAtCompletion, cost, completedAt }: {
      tenantId: string;
      taskId: string;
      completedBy?: string;
      notes?: string;
      usageAtCompletion?: number;
      cost?: number;
      completedAt?: string;
    }) => {
      const completionDate = completedAt || new Date().toISOString();
      
      const { data: logData, error: logError } = await supabase
        .from('maintenance_logs')
        .insert({
          tenant_id: tenantId,
          task_id: taskId,
          completed_at: completionDate,
          completed_by: completedBy,
          notes,
          usage_at_completion: usageAtCompletion,
          cost: cost || null,
        })
        .select();
      if (logError) throw logError;
      
      const { data: taskData } = await supabase
        .from('maintenance_tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (taskData) {
        const existingLastCompleted = taskData.last_completed_at ? new Date(taskData.last_completed_at) : null;
        const newCompletionDate = new Date(completionDate);
        
        const isNewerThanExisting = !existingLastCompleted || newCompletionDate > existingLastCompleted;
        
        if (isNewerThanExisting) {
          let next_due_at: string | null = null;
          let current_usage = taskData.current_usage || 0;
          
          if (taskData.interval_type === 'time' && taskData.interval_days) {
            const dueDate = new Date(completionDate);
            dueDate.setDate(dueDate.getDate() + taskData.interval_days);
            next_due_at = dueDate.toISOString();
          } else if (taskData.interval_type === 'usage' && taskData.interval_units && usageAtCompletion !== undefined) {
            current_usage = usageAtCompletion;
          }
          
          await supabase
            .from('maintenance_tasks')
            .update({
              last_completed_at: completionDate,
              next_due_at,
              current_usage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', taskId);
        }
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
