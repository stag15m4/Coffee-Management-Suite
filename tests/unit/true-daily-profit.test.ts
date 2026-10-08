import { describe, it, expect } from 'vitest';
import { estimateAverageIngredientCostPerItem } from '../../client/src/pages/recipe-costing/utils';
import type { Recipe, Ingredient, BaseTemplate, ProductSize } from '../../client/src/pages/recipe-costing/types';

// Regression coverage for the Overhead tab's "True Daily Profit": Revenue
// minus Overhead alone ignores ingredient cost and can show a healthy
// green number on a day that's actually underwater once COGS is counted.
// estimateAverageIngredientCostPerItem supplies the missing piece: a
// blended average ingredient-only (no overhead) cost per item, used
// upstream as avgIngredientCost x estimated items/day.

const size: ProductSize = { id: 'size-12oz', name: '12oz', size_value: 12, product_type: 'drink', display_order: 1 };
const bulkSize: ProductSize = { id: 'size-bulk', name: 'Bulk', size_value: 32, product_type: 'bulk', display_order: 0 };

function ingredient(id: string, name: string, cost: number, quantity: number, unit = 'oz'): Ingredient {
  return { id, name, category_id: 'cat-1', cost, quantity, unit };
}

describe('estimateAverageIngredientCostPerItem', () => {
  it('returns 0 with no priced recipes', () => {
    const result = estimateAverageIngredientCostPerItem({
      recipes: [],
      ingredients: [],
      baseTemplates: [],
      recipeSizeBases: [],
      productSizes: [size],
      pricingData: [],
    });
    expect(result).toEqual({ avgIngredientCost: 0, sampleCount: 0 });
  });

  it('averages direct-ingredient cost across priced (recipe, size) pairs', () => {
    const milk = ingredient('ing-milk', 'Milk', 4, 128); // $4/128oz = $0.03125/oz
    const recipeA: Recipe = {
      id: 'r1',
      name: 'Latte',
      category_id: 'c1',
      is_active: true,
      tenant_id: 't1',
      recipe_ingredients: [
        { id: 'ri1', recipe_id: 'r1', size_id: size.id, quantity: 8, unit: 'oz', ingredient_id: milk.id },
      ],
    };
    const recipeB: Recipe = {
      id: 'r2',
      name: 'Cappuccino',
      category_id: 'c1',
      is_active: true,
      tenant_id: 't1',
      recipe_ingredients: [
        { id: 'ri2', recipe_id: 'r2', size_id: size.id, quantity: 16, unit: 'oz', ingredient_id: milk.id },
      ],
    };

    const result = estimateAverageIngredientCostPerItem({
      recipes: [recipeA, recipeB],
      ingredients: [milk],
      baseTemplates: [],
      recipeSizeBases: [],
      productSizes: [size],
      pricingData: [
        { recipe_id: 'r1', size_id: size.id, sale_price: 5 },
        { recipe_id: 'r2', size_id: size.id, sale_price: 5 },
      ],
    });

    // r1: 8oz x $0.03125 = $0.25; r2: 16oz x $0.03125 = $0.50 -> avg $0.375
    expect(result.sampleCount).toBe(2);
    expect(result.avgIngredientCost).toBeCloseTo(0.375, 4);
  });

  it('excludes bulk recipes and unpriced (recipe, size) pairs', () => {
    const milk = ingredient('ing-milk', 'Milk', 4, 128);
    const bulkRecipe: Recipe = {
      id: 'bulk1',
      name: 'Simple Syrup Batch',
      category_id: 'c1',
      is_active: true,
      is_bulk_recipe: true,
      tenant_id: 't1',
      recipe_ingredients: [
        { id: 'ri-bulk', recipe_id: 'bulk1', size_id: bulkSize.id, quantity: 32, unit: 'oz', ingredient_id: milk.id },
      ],
    };
    const unpriced: Recipe = {
      id: 'r3',
      name: 'Unpriced Drink',
      category_id: 'c1',
      is_active: true,
      tenant_id: 't1',
      recipe_ingredients: [
        { id: 'ri3', recipe_id: 'r3', size_id: size.id, quantity: 8, unit: 'oz', ingredient_id: milk.id },
      ],
    };

    const result = estimateAverageIngredientCostPerItem({
      recipes: [bulkRecipe, unpriced],
      ingredients: [milk],
      baseTemplates: [],
      recipeSizeBases: [],
      productSizes: [size, bulkSize],
      pricingData: [], // nothing priced
    });

    expect(result).toEqual({ avgIngredientCost: 0, sampleCount: 0 });
  });

  it("includes a base template's ingredients for the matching size", () => {
    const espresso = ingredient('ing-espresso', 'Espresso Beans', 20, 16); // $1.25/oz
    const baseTemplate: BaseTemplate = {
      id: 'base1',
      name: 'Espresso Base',
      drink_type: 'espresso',
      is_active: true,
      ingredients: [
        {
          id: 'bi1',
          base_template_id: 'base1',
          ingredient_id: espresso.id,
          size_id: size.id,
          quantity: 2,
        },
      ],
    };
    const recipe: Recipe = {
      id: 'r4',
      name: 'Americano',
      category_id: 'c1',
      is_active: true,
      tenant_id: 't1',
      recipe_ingredients: [],
    };

    const result = estimateAverageIngredientCostPerItem({
      recipes: [recipe],
      ingredients: [espresso],
      baseTemplates: [baseTemplate],
      recipeSizeBases: [{ recipe_id: 'r4', size_id: size.id, base_template_id: 'base1' }],
      productSizes: [size],
      pricingData: [{ recipe_id: 'r4', size_id: size.id, sale_price: 4 }],
    });

    // 2oz x $1.25/oz = $2.50
    expect(result.sampleCount).toBe(1);
    expect(result.avgIngredientCost).toBeCloseTo(2.5, 4);
  });

  it("falls back to the recipe's legacy base_template_id when no recipe_size_bases row exists", () => {
    const espresso = ingredient('ing-espresso', 'Espresso Beans', 20, 16); // $1.25/oz
    const baseTemplate: BaseTemplate = {
      id: 'base1',
      name: 'Espresso Base',
      drink_type: 'espresso',
      is_active: true,
      ingredients: [
        {
          id: 'bi1',
          base_template_id: 'base1',
          ingredient_id: espresso.id,
          size_id: size.id,
          quantity: 2,
        },
      ],
    };
    const recipe: Recipe = {
      id: 'r5',
      name: 'Legacy Americano',
      category_id: 'c1',
      is_active: true,
      tenant_id: 't1',
      base_template_id: 'base1',
      recipe_ingredients: [],
    };

    const result = estimateAverageIngredientCostPerItem({
      recipes: [recipe],
      ingredients: [espresso],
      baseTemplates: [baseTemplate],
      recipeSizeBases: [], // no per-size override row — only the legacy field
      productSizes: [size],
      pricingData: [{ recipe_id: 'r5', size_id: size.id, sale_price: 4 }],
    });

    // 2oz x $1.25/oz = $2.50
    expect(result.sampleCount).toBe(1);
    expect(result.avgIngredientCost).toBeCloseTo(2.5, 4);
  });
});
