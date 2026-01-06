import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertRecipe, type InsertRecipeIngredient } from "@shared/routes";

// Recipe CRUD
export function useRecipes() {
  return useQuery({
    queryKey: [api.recipes.list.path],
    queryFn: async () => {
      const res = await fetch(api.recipes.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recipes");
      return api.recipes.list.responses[200].parse(await res.json());
    },
  });
}

export function useRecipe(id: number) {
  return useQuery({
    queryKey: [api.recipes.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.recipes.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch recipe");
      return api.recipes.get.responses[200].parse(await res.json());
    },
    enabled: !!id && !isNaN(id),
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertRecipe) => {
      const res = await fetch(api.recipes.create.path, {
        method: api.recipes.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create recipe");
      return api.recipes.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.recipes.list.path] }),
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertRecipe>) => {
      const url = buildUrl(api.recipes.update.path, { id });
      const res = await fetch(url, {
        method: api.recipes.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update recipe");
      return api.recipes.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.recipes.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.recipes.get.path, data.id] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.recipes.delete.path, { id });
      const res = await fetch(url, {
        method: api.recipes.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete recipe");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.recipes.list.path] }),
  });
}

// Recipe Ingredients CRUD
export function useAddRecipeIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, ...data }: InsertRecipeIngredient) => {
      const url = buildUrl(api.recipeIngredients.create.path, { recipeId });
      const res = await fetch(url, {
        method: api.recipeIngredients.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add ingredient to recipe");
      return api.recipeIngredients.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.recipes.get.path, variables.recipeId] });
    },
  });
}

export function useDeleteRecipeIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, id }: { recipeId: number; id: number }) => {
      const url = buildUrl(api.recipeIngredients.delete.path, { recipeId, id });
      const res = await fetch(url, {
        method: api.recipeIngredients.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove ingredient");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.recipes.get.path, variables.recipeId] });
    },
  });
}
