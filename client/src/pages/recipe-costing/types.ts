export interface Category {
  id: string;
  name: string;
  display_order?: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  ingredient_type?: string;
  cost: number | string;
  quantity: number | string;
  unit: string;
  usage_unit?: string;
  cost_per_unit?: number | string;
  cost_per_usage_unit?: number | string;
  vendor?: string;
  manufacturer?: string;
  item_number?: string;
  updated_at?: string;
}

export const INGREDIENT_TYPES = ['FOH Ingredient', 'BOH Ingredient', 'Disposable', 'Supply'] as const;

export interface Product {
  id: string;
  recipe_id: string;
  recipe_name: string;
  category_name: string;
  size_id: string;
  size_name: string;
  base_cost: number;
  ingredient_cost: number;
  total_cost?: number;
  sale_price: number;
}

export interface Recipe {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  base_template_id?: string;
  base_template_name?: string;
  is_active: boolean;
  is_bulk_recipe?: boolean;
  minutes_per_drink?: number | null;
  tenant_id: string;
  products?: Product[];
  recipe_ingredients?: RecipeIngredient[];
}

export interface DrinkSize {
  id: string;
  name: string;
  size_oz: number;
  drink_type: string;
  display_order: number;
}

export interface BaseTemplate {
  id: string;
  name: string;
  drink_type: string;
  description?: string;
  is_active: boolean;
  ingredients?: BaseTemplateIngredient[];
}

export interface BaseTemplateIngredient {
  id: string;
  base_template_id: string;
  ingredient_id: string;
  size_id: string;
  quantity: number;
  unit?: string;
  ingredient?: Ingredient;
  size?: DrinkSize;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id?: string | null;
  syrup_recipe_id?: string | null;
  size_id: string;
  quantity: number;
  unit?: string;
  ingredient?: Ingredient;
  size?: DrinkSize;
}

export interface OverheadSettings {
  id: string;
  cost_per_minute: number;
  minutes_per_drink: number;
  notes?: string;
  operating_days_per_week?: number;
  hours_open_per_day?: number;
  owner_tips_enabled?: boolean;
}

export interface OverheadItem {
  id: string;
  tenant_id: string;
  name: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annual';
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeSizeBase {
  id?: string;
  recipe_id: string;
  size_id: string;
  base_template_id: string;
}

export interface RecipeSizePricing {
  id?: string;
  recipe_id: string;
  size_id: string;
  sale_price: number;
}

export interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
