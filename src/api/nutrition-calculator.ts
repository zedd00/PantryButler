import { api } from '@/lib/api-client';

interface IngredientNutrition {
  ingredient_name: string;
  matched_food_id: string | null;
  matched_food_name: string | null;
  quantity: number | null;
  unit: string | null;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  calcium_mg?: number;
  iron_mg?: number;
  magnesium_mg?: number;
  phosphorus_mg?: number;
  potassium_mg?: number;
  zinc_mg?: number;
  copper_mg?: number;
  manganese_mg?: number;
  selenium_mcg?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  thiamin_mg?: number;
  riboflavin_mg?: number;
  niacin_mg?: number;
  vitamin_b6_mg?: number;
  folate_mcg?: number;
  vitamin_b12_mcg?: number;
  pantothenic_acid_mg?: number;
  choline_mg?: number;
}

interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  calcium_mg?: number;
  iron_mg?: number;
  magnesium_mg?: number;
  phosphorus_mg?: number;
  potassium_mg?: number;
  zinc_mg?: number;
  copper_mg?: number;
  manganese_mg?: number;
  selenium_mcg?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  thiamin_mg?: number;
  riboflavin_mg?: number;
  niacin_mg?: number;
  vitamin_b6_mg?: number;
  folate_mcg?: number;
  vitamin_b12_mcg?: number;
  pantothenic_acid_mg?: number;
  choline_mg?: number;
}

export interface RecipeNutrition {
  total: NutritionTotals;
  per_serving: NutritionTotals;
  ingredients: IngredientNutrition[];
  matched_count: number;
  total_count: number;
}

export async function calculateRecipeNutrition(
  ingredients: Array<{ name: string; quantity: number | null; unit: string | null; nutrition_food_id?: string | null }>,
  servings: number = 1
): Promise<RecipeNutrition | null> {
  try {
    return await api.post<RecipeNutrition>('/api/nutrition/calculate', { ingredients, servings });
  } catch {
    return null;
  }
}
