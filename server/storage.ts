import { db } from "./db";
import {
  ingredients,
  recipes,
  recipeIngredients,
  type InsertIngredient,
  type InsertRecipe,
  type InsertRecipeIngredient,
  type Ingredient,
  type Recipe,
  type RecipeIngredient
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // Ingredients
  getIngredients(): Promise<Ingredient[]>;
  getIngredient(id: string): Promise<Ingredient | undefined>;
  createIngredient(ingredient: InsertIngredient): Promise<Ingredient>;
  updateIngredient(id: string, ingredient: Partial<InsertIngredient>): Promise<Ingredient | undefined>;
  deleteIngredient(id: string): Promise<void>;

  // Recipes
  getRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<(Recipe & { ingredients: (RecipeIngredient & { ingredient: Ingredient })[] }) | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: string): Promise<void>;

  // Recipe Ingredients
  addRecipeIngredient(recipeIngredient: InsertRecipeIngredient): Promise<RecipeIngredient>;
  deleteRecipeIngredient(id: string): Promise<void>;

  // Tenants (Stripe)
  getTenant(tenantId: string): Promise<{ id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null } | null>;
  updateTenantStripeInfo(tenantId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Ingredients
  async getIngredients(): Promise<Ingredient[]> {
    return await db.select().from(ingredients);
  }

  async getIngredient(id: string): Promise<Ingredient | undefined> {
    const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, id));
    return ingredient;
  }

  async createIngredient(insertIngredient: InsertIngredient): Promise<Ingredient> {
    const [ingredient] = await db.insert(ingredients).values(insertIngredient).returning();
    return ingredient;
  }

  async updateIngredient(id: string, updates: Partial<InsertIngredient>): Promise<Ingredient | undefined> {
    const [updated] = await db.update(ingredients)
      .set(updates)
      .where(eq(ingredients.id, id))
      .returning();
    return updated;
  }

  async deleteIngredient(id: string): Promise<void> {
    await db.delete(ingredients).where(eq(ingredients.id, id));
  }

  // Recipes
  async getRecipes(): Promise<Recipe[]> {
    return await db.select().from(recipes);
  }

  async getRecipe(id: string): Promise<(Recipe & { ingredients: (RecipeIngredient & { ingredient: Ingredient })[] }) | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));

    if (!recipe) return undefined;

    const items = await db.query.recipeIngredients.findMany({
      where: eq(recipeIngredients.recipeId, id),
      with: {
        ingredient: true
      }
    });

    return { ...recipe, ingredients: items };
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const [recipe] = await db.insert(recipes).values(insertRecipe).returning();
    return recipe;
  }

  async updateRecipe(id: string, updates: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const [updated] = await db.update(recipes)
      .set(updates)
      .where(eq(recipes.id, id))
      .returning();
    return updated;
  }

  async deleteRecipe(id: string): Promise<void> {
    await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
    await db.delete(recipes).where(eq(recipes.id, id));
  }

  // Recipe Ingredients
  async addRecipeIngredient(insertRecipeIngredient: InsertRecipeIngredient): Promise<RecipeIngredient> {
    const [item] = await db.insert(recipeIngredients).values(insertRecipeIngredient).returning();
    return item;
  }

  async deleteRecipeIngredient(id: string): Promise<void> {
    await db.delete(recipeIngredients).where(eq(recipeIngredients.id, id));
  }

  async getTenant(tenantId: string): Promise<{ id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null } | null> {
    const result = await db.execute(
      sql`SELECT id, stripe_customer_id, stripe_subscription_id FROM tenants WHERE id = ${tenantId}`
    );
    return result.rows[0] as any || null;
  }

  async updateTenantStripeInfo(tenantId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string }): Promise<void> {
    if (info.stripeCustomerId) {
      await db.execute(
        sql`UPDATE tenants SET stripe_customer_id = ${info.stripeCustomerId} WHERE id = ${tenantId}`
      );
    }
    if (info.stripeSubscriptionId) {
      await db.execute(
        sql`UPDATE tenants SET stripe_subscription_id = ${info.stripeSubscriptionId} WHERE id = ${tenantId}`
      );
    }
    if (info.stripeSubscriptionStatus) {
      await db.execute(
        sql`UPDATE tenants SET stripe_subscription_status = ${info.stripeSubscriptionStatus} WHERE id = ${tenantId}`
      );
    }
  }
}

export const storage = new DatabaseStorage();
