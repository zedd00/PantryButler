import { query } from '../db/pool';

export interface IngredientInput {
  name: string;
  quantity: number | null;
  unit: string | null;
  nutrition_food_id?: string | null;
}

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

interface RecipeNutrition {
  total: NutritionTotals;
  per_serving: NutritionTotals;
  ingredients: IngredientNutrition[];
  matched_count: number;
  total_count: number;
}

function convertToGrams(quantity: number | null, unit: string | null, food: any): number {
  if (!quantity || !unit) return 0;
  const u = unit.toLowerCase().trim();
  if (u === 'g' || u === 'gram' || u === 'grams') return quantity;
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return quantity * 1000;
  if (u === 'cup' || u === 'cups' || u === 'c') return quantity * (food.cup_to_g || 0);
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons' || u === 'tbs') return quantity * (food.tbsp_to_g || 0);
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return quantity * (food.tsp_to_g || 0);
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return quantity * (food.oz_to_g || 0);
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') {
    const ozToG = food.oz_to_g || 28.35;
    return quantity * ozToG * 16;
  }
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return quantity;
  if (u === 'l' || u === 'liter' || u === 'liters') return quantity * 1000;
  // US customary liquid volume → ml (density treated as water, matching ml handling above)
  if (u === 'fl oz' || u === 'fluid ounce' || u === 'fluid ounces' || u === 'fl. oz.' || u === 'fl. oz') return quantity * 29.5735295625;
  if (u === 'pint' || u === 'pints' || u === 'pt') return quantity * 473.176473;
  if (u === 'quart' || u === 'quarts' || u === 'qt') return quantity * 946.352946;
  if (u === 'gallon' || u === 'gallons' || u === 'gal') return quantity * 3785.411784;
  if (food.serving_grams) return quantity * food.serving_grams;
  return 0;
}

// Batch lookup for all ingredients at once. Explicit nutrition_food_id matches
// are resolved in one query; any ingredient whose id did not resolve (or that
// had no id) falls back to a single name-based lookup. Order is preserved so
// the caller can pair each ingredient with its food.
async function lookupNutritionFoods(ingredients: IngredientInput[]): Promise<(any | null)[]> {
  const foods: (any | null)[] = new Array(ingredients.length).fill(null);

  // 1) Resolve explicit nutrition_food_id matches in one query.
  const idToFood = new Map<string, any>();
  const ids = new Set<string>();
  for (const ing of ingredients) {
    if (ing.nutrition_food_id) ids.add(ing.nutrition_food_id);
  }
  if (ids.size) {
    const result = await query('SELECT * FROM nutrition_foods WHERE id = ANY($1::text[])', [[...ids]]);
    for (const row of result.rows) idToFood.set(row.id, row);
  }

  // 2) Name-based fallback for anything still unresolved, in one query.
  const nameToIndices = new Map<string, number[]>();
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    const byId = ing.nutrition_food_id ? idToFood.get(ing.nutrition_food_id) : undefined;
    if (byId) {
      foods[i] = byId;
    } else {
      const key = ing.name.toLowerCase();
      if (!nameToIndices.has(key)) nameToIndices.set(key, []);
      nameToIndices.get(key)!.push(i);
    }
  }

  if (nameToIndices.size) {
    const names = [...nameToIndices.keys()];
    const result = await query(
      'SELECT * FROM nutrition_foods WHERE name ILIKE ANY($1::text[])',
      [names]
    );
    // First match per requested name, mirroring the original LIMIT 1 semantics.
    const nameToFood = new Map<string, any>();
    for (const row of result.rows) {
      const key = row.name.toLowerCase();
      if (!nameToFood.has(key)) nameToFood.set(key, row);
    }
    for (const [key, indices] of nameToIndices) {
      const food = nameToFood.get(key) || null;
      for (const i of indices) foods[i] = food;
    }
  }

  return foods;
}

function calcIngredient(ingredient: IngredientInput, food: any): IngredientNutrition {
  const result: IngredientNutrition = {
    ingredient_name: ingredient.name,
    matched_food_id: food?.id || null,
    matched_food_name: food?.name || null,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    grams: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    fiber_g: 0, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0,
  };

  if (!food) return result;

  const grams = convertToGrams(ingredient.quantity, ingredient.unit, food);
  result.grams = grams;
  if (grams === 0) return result;

  const m = grams / 100;
  result.calories = +(food.calories * m).toFixed(1);
  result.protein_g = +(food.protein_g * m).toFixed(1);
  result.carbs_g = +(food.carbs_g * m).toFixed(1);
  result.fat_g = +(food.fat_g * m).toFixed(1);
  result.fiber_g = food.fiber_g ? +(food.fiber_g * m).toFixed(1) : 0;
  result.sugar_g = food.sugar_g ? +(food.sugar_g * m).toFixed(1) : 0;
  result.sodium_mg = food.sodium_mg ? +(food.sodium_mg * m).toFixed(1) : 0;
  result.cholesterol_mg = food.cholesterol_mg ? +(food.cholesterol_mg * m).toFixed(1) : 0;

  if (food.nutrition_data) {
    const d = food.nutrition_data;
    if (d.calcium) result.calcium_mg = +(d.calcium * m).toFixed(1);
    if (d.iron) result.iron_mg = +(d.iron * m).toFixed(2);
    if (d.magnesium) result.magnesium_mg = +(d.magnesium * m).toFixed(1);
    if (d.phosphorus) result.phosphorus_mg = +(d.phosphorus * m).toFixed(1);
    if (d.potassium) result.potassium_mg = +(d.potassium * m).toFixed(1);
    if (d.zinc) result.zinc_mg = +(d.zinc * m).toFixed(2);
    if (d.copper) result.copper_mg = +(d.copper * m).toFixed(3);
    if (d.manganese) result.manganese_mg = +(d.manganese * m).toFixed(3);
    if (d.selenium) result.selenium_mcg = +(d.selenium * m).toFixed(1);
    if (d.vitamin_a) result.vitamin_a_mcg = +(d.vitamin_a * m).toFixed(1);
    if (d.vitamin_c) result.vitamin_c_mg = +(d.vitamin_c * m).toFixed(1);
    if (d.vitamin_d) result.vitamin_d_mcg = +(d.vitamin_d * m).toFixed(1);
    if (d.vitamin_e) result.vitamin_e_mg = +(d.vitamin_e * m).toFixed(1);
    if (d.vitamin_k) result.vitamin_k_mcg = +(d.vitamin_k * m).toFixed(1);
    if (d.thiamin) result.thiamin_mg = +(d.thiamin * m).toFixed(3);
    if (d.riboflavin) result.riboflavin_mg = +(d.riboflavin * m).toFixed(3);
    if (d.niacin) result.niacin_mg = +(d.niacin * m).toFixed(2);
    if (d.vitamin_b6) result.vitamin_b6_mg = +(d.vitamin_b6 * m).toFixed(3);
    if (d.folate_dfe) result.folate_mcg = +(d.folate_dfe * m).toFixed(1);
    if (d.vitamin_b12) result.vitamin_b12_mcg = +(d.vitamin_b12 * m).toFixed(1);
    if (d.pantothenic_acid) result.pantothenic_acid_mg = +(d.pantothenic_acid * m).toFixed(2);
    if (d.choline) result.choline_mg = +(d.choline * m).toFixed(1);
  }

  return result;
}

function sumTotals(ingredients: IngredientNutrition[]): NutritionTotals {
  const zero: NutritionTotals = {
    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    fiber_g: 0, sugar_g: 0, sodium_mg: 0, cholesterol_mg: 0,
  };

  const total = ingredients.reduce((acc, ing) => ({
    calories: acc.calories + ing.calories,
    protein_g: acc.protein_g + ing.protein_g,
    carbs_g: acc.carbs_g + ing.carbs_g,
    fat_g: acc.fat_g + ing.fat_g,
    fiber_g: acc.fiber_g + ing.fiber_g,
    sugar_g: acc.sugar_g + ing.sugar_g,
    sodium_mg: acc.sodium_mg + ing.sodium_mg,
    cholesterol_mg: acc.cholesterol_mg + ing.cholesterol_mg,
    calcium_mg: (acc.calcium_mg || 0) + (ing.calcium_mg || 0),
    iron_mg: (acc.iron_mg || 0) + (ing.iron_mg || 0),
    magnesium_mg: (acc.magnesium_mg || 0) + (ing.magnesium_mg || 0),
    phosphorus_mg: (acc.phosphorus_mg || 0) + (ing.phosphorus_mg || 0),
    potassium_mg: (acc.potassium_mg || 0) + (ing.potassium_mg || 0),
    zinc_mg: (acc.zinc_mg || 0) + (ing.zinc_mg || 0),
    copper_mg: (acc.copper_mg || 0) + (ing.copper_mg || 0),
    manganese_mg: (acc.manganese_mg || 0) + (ing.manganese_mg || 0),
    selenium_mcg: (acc.selenium_mcg || 0) + (ing.selenium_mcg || 0),
    vitamin_a_mcg: (acc.vitamin_a_mcg || 0) + (ing.vitamin_a_mcg || 0),
    vitamin_c_mg: (acc.vitamin_c_mg || 0) + (ing.vitamin_c_mg || 0),
    vitamin_d_mcg: (acc.vitamin_d_mcg || 0) + (ing.vitamin_d_mcg || 0),
    vitamin_e_mg: (acc.vitamin_e_mg || 0) + (ing.vitamin_e_mg || 0),
    vitamin_k_mcg: (acc.vitamin_k_mcg || 0) + (ing.vitamin_k_mcg || 0),
    thiamin_mg: (acc.thiamin_mg || 0) + (ing.thiamin_mg || 0),
    riboflavin_mg: (acc.riboflavin_mg || 0) + (ing.riboflavin_mg || 0),
    niacin_mg: (acc.niacin_mg || 0) + (ing.niacin_mg || 0),
    vitamin_b6_mg: (acc.vitamin_b6_mg || 0) + (ing.vitamin_b6_mg || 0),
    folate_mcg: (acc.folate_mcg || 0) + (ing.folate_mcg || 0),
    vitamin_b12_mcg: (acc.vitamin_b12_mcg || 0) + (ing.vitamin_b12_mcg || 0),
    pantothenic_acid_mg: (acc.pantothenic_acid_mg || 0) + (ing.pantothenic_acid_mg || 0),
    choline_mg: (acc.choline_mg || 0) + (ing.choline_mg || 0),
  }), zero);

  Object.keys(total).forEach(k => {
    const key = k as keyof NutritionTotals;
    if (typeof total[key] === 'number') {
      (total as any)[key] = Math.round((total[key] as number) * 100) / 100;
    }
  });

  return total;
}

function perServing(totals: NutritionTotals, servings: number): NutritionTotals {
  const s = servings > 0 ? servings : 1;
  const result: NutritionTotals = { ...totals };
  Object.keys(result).forEach(k => {
    const key = k as keyof NutritionTotals;
    if (typeof result[key] === 'number') {
      (result as any)[key] = Math.round(((result[key] as number) / s) * 100) / 100;
    }
  });
  return result;
}

export async function calculateRecipeNutrition(
  ingredients: IngredientInput[],
  servings: number = 1
): Promise<RecipeNutrition | null> {
  if (!ingredients || ingredients.length === 0) return null;

  const foods = await lookupNutritionFoods(ingredients);

  const ingredientNutrition: IngredientNutrition[] = ingredients.map((ing, i) =>
    calcIngredient(ing, foods[i])
  );

  const matchedCount = ingredientNutrition.filter(ing => ing.matched_food_id !== null).length;
  const total = sumTotals(ingredientNutrition);
  const serving = perServing(total, servings);

  // Only include micronutrients that have values in totals
  const cleanTotal: NutritionTotals = { ...total };
  const cleanServing: NutritionTotals = { ...serving };

  return {
    total: cleanTotal,
    per_serving: cleanServing,
    ingredients: ingredientNutrition,
    matched_count: matchedCount,
    total_count: ingredients.length,
  };
}
