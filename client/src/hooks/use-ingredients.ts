import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertIngredient } from "@shared/routes";

export function useIngredients() {
  return useQuery({
    queryKey: [api.ingredients.list.path],
    queryFn: async () => {
      const res = await fetch(api.ingredients.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ingredients");
      return api.ingredients.list.responses[200].parse(await res.json());
    },
  });
}

export function useIngredient(id: number) {
  return useQuery({
    queryKey: [api.ingredients.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.ingredients.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch ingredient");
      return api.ingredients.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertIngredient) => {
      const res = await fetch(api.ingredients.create.path, {
        method: api.ingredients.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.ingredients.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create ingredient");
      }
      return api.ingredients.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.ingredients.list.path] }),
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertIngredient>) => {
      const url = buildUrl(api.ingredients.update.path, { id });
      const res = await fetch(url, {
        method: api.ingredients.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update ingredient");
      return api.ingredients.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.ingredients.list.path] }),
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.ingredients.delete.path, { id });
      const res = await fetch(url, {
        method: api.ingredients.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete ingredient");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.ingredients.list.path] }),
  });
}
