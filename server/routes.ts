import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Ingredients Routes
  app.get(api.ingredients.list.path, async (req, res) => {
    const ingredients = await storage.getIngredients();
    res.json(ingredients);
  });

  app.post(api.ingredients.create.path, async (req, res) => {
    try {
      const input = api.ingredients.create.input.parse(req.body);
      const ingredient = await storage.createIngredient(input);
      res.status(201).json(ingredient);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.ingredients.get.path, async (req, res) => {
    const ingredient = await storage.getIngredient(Number(req.params.id));
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    res.json(ingredient);
  });

  app.put(api.ingredients.update.path, async (req, res) => {
    try {
      const input = api.ingredients.update.input.parse(req.body);
      const ingredient = await storage.updateIngredient(Number(req.params.id), input);
      if (!ingredient) {
        return res.status(404).json({ message: 'Ingredient not found' });
      }
      res.json(ingredient);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.ingredients.delete.path, async (req, res) => {
    await storage.deleteIngredient(Number(req.params.id));
    res.status(204).end();
  });

  // Recipes Routes
  app.get(api.recipes.list.path, async (req, res) => {
    const recipes = await storage.getRecipes();
    res.json(recipes);
  });

  app.post(api.recipes.create.path, async (req, res) => {
    try {
      const input = api.recipes.create.input.parse(req.body);
      const recipe = await storage.createRecipe(input);
      res.status(201).json(recipe);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.recipes.get.path, async (req, res) => {
    const recipe = await storage.getRecipe(Number(req.params.id));
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    res.json(recipe);
  });

  app.put(api.recipes.update.path, async (req, res) => {
     try {
      const input = api.recipes.update.input.parse(req.body);
      const recipe = await storage.updateRecipe(Number(req.params.id), input);
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }
      res.json(recipe);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.recipes.delete.path, async (req, res) => {
    await storage.deleteRecipe(Number(req.params.id));
    res.status(204).end();
  });

  // Recipe Ingredients Routes
  app.post(api.recipeIngredients.create.path, async (req, res) => {
    try {
      const recipeId = Number(req.params.recipeId);
      const bodySchema = api.recipeIngredients.create.input.extend({
         recipeId: z.number().default(recipeId) // inject recipeId
      });
      
      const input = bodySchema.parse({ ...req.body, recipeId });
      
      const item = await storage.addRecipeIngredient(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.recipeIngredients.delete.path, async (req, res) => {
    await storage.deleteRecipeIngredient(Number(req.params.id));
    res.status(204).end();
  });

  return httpServer;
}

// Seed function
async function seedDatabase() {
  const existingIngredients = await storage.getIngredients();
  if (existingIngredients.length === 0) {
    const flour = await storage.createIngredient({
      name: "All-Purpose Flour",
      unit: "kg",
      price: "2.50",
      amount: "1",
    });
    
    const sugar = await storage.createIngredient({
      name: "Granulated Sugar",
      unit: "kg",
      price: "1.80",
      amount: "1",
    });

    const butter = await storage.createIngredient({
      name: "Unsalted Butter",
      unit: "g",
      price: "4.50",
      amount: "500",
    });

    const eggs = await storage.createIngredient({
      name: "Large Eggs",
      unit: "each",
      price: "3.00",
      amount: "12",
    });

    const cookieRecipe = await storage.createRecipe({
      name: "Sugar Cookies",
      servings: 24,
      instructions: "Mix ingredients. Bake at 350F for 10-12 minutes."
    });

    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: flour.id,
      quantity: "0.4" // 400g
    });

    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: sugar.id,
      quantity: "0.2" // 200g
    });

    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: butter.id,
      quantity: "225" // 225g
    });
     
    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: eggs.id,
      quantity: "1" // 1 egg
    });
  }
}

// Call seed
seedDatabase().catch(console.error);
