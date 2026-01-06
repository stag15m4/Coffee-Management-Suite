import { z } from 'zod';
import { insertIngredientSchema, insertRecipeSchema, insertRecipeIngredientSchema, ingredients, recipes, recipeIngredients } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  ingredients: {
    list: {
      method: 'GET' as const,
      path: '/api/ingredients',
      responses: {
        200: z.array(z.custom<typeof ingredients.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/ingredients',
      input: insertIngredientSchema,
      responses: {
        201: z.custom<typeof ingredients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/ingredients/:id',
      responses: {
        200: z.custom<typeof ingredients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/ingredients/:id',
      input: insertIngredientSchema.partial(),
      responses: {
        200: z.custom<typeof ingredients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/ingredients/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  recipes: {
    list: {
      method: 'GET' as const,
      path: '/api/recipes',
      responses: {
        200: z.array(z.custom<typeof recipes.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/recipes',
      input: insertRecipeSchema,
      responses: {
        201: z.custom<typeof recipes.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/recipes/:id',
      responses: {
        200: z.custom<typeof recipes.$inferSelect & { ingredients: (typeof recipeIngredients.$inferSelect & { ingredient: typeof ingredients.$inferSelect })[] }>(),
        404: errorSchemas.notFound,
      },
    },
     update: {
      method: 'PUT' as const,
      path: '/api/recipes/:id',
      input: insertRecipeSchema.partial(),
      responses: {
        200: z.custom<typeof recipes.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/recipes/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  recipeIngredients: {
    create: {
      method: 'POST' as const,
      path: '/api/recipes/:recipeId/ingredients',
      input: insertRecipeIngredientSchema.omit({ recipeId: true }),
      responses: {
        201: z.custom<typeof recipeIngredients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
     delete: {
      method: 'DELETE' as const,
      path: '/api/recipes/:recipeId/ingredients/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
