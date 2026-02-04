import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-queries";
import { useAuth } from "@/contexts/AuthContext";

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price: string;
  amount: string;
  tenant_id: string;
}

export type InsertIngredient = Omit<Ingredient, 'id' | 'tenant_id'>;

export function useIngredients() {
  const { tenant } = useAuth();
  
  return useQuery({
    queryKey: ['ingredients', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');
      
      if (error) throw error;
      return data as Ingredient[];
    },
    enabled: !!tenant?.id,
  });
}

export function useIngredient(id: number) {
  const { tenant } = useAuth();
  
  return useQuery({
    queryKey: ['ingredients', tenant?.id, id],
    queryFn: async () => {
      if (!tenant?.id || !id) return null;
      
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as Ingredient;
    },
    enabled: !!tenant?.id && !!id,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  
  return useMutation({
    mutationFn: async (data: InsertIngredient) => {
      if (!tenant?.id) throw new Error('No tenant context');
      
      const { data: ingredient, error } = await supabase
        .from('ingredients')
        .insert({
          ...data,
          tenant_id: tenant.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return ingredient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', tenant?.id] });
    },
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertIngredient>) => {
      if (!tenant?.id) throw new Error('No tenant context');
      
      const { data: ingredient, error } = await supabase
        .from('ingredients')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .single();
      
      if (error) throw error;
      return ingredient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', tenant?.id] });
    },
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  return useMutation({
    mutationFn: async (id: number) => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Add timeout to prevent hanging
      const deletePromise = supabase
        .from('ingredients')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      const { error } = await Promise.race([
        deletePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Delete operation timeout')), 5000)
        )
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients', tenant?.id] });
    },
  });
}
