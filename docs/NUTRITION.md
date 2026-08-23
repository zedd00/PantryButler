# Nutrition Feature Documentation

## Overview

PantryButler includes comprehensive nutrition tracking powered by the OpenNutrition database. The system automatically calculates nutritional information for recipes based on matched ingredients, displaying macronutrients, micronutrients, and daily value percentages.

## Features

### 1. Ingredient Nutrition Matching

**Location**: Ingredients page → Edit ingredient

- **Auto-Suggestion**: System automatically suggests nutrition matches based on ingredient name
- **Manual Search**: Search the database with real-time results
- **Alternate Names**: Matches against common alternate names
- **Visual Feedback**: Shows matched food category and serving information

### 2. Recipe Nutrition Calculation

**Location**: Recipe detail page (when nutrition is enabled)

- **Automatic Calculation**: Calculates nutrition for all matched ingredients
- **Unit Conversion**: Converts recipe quantities to grams using conversion factors
- **Scaling**: Scales per-100g values to actual ingredient amounts
- **Aggregation**: Sums all ingredients and divides by servings

### 3. Nutrition Label Display

**Format**: FDA-style nutrition facts label

**Macronutrients**:
- Calories
- Total Fat, Cholesterol, Sodium
- Total Carbohydrate, Dietary Fiber, Total Sugars
- Protein

**Micronutrients** (when available):
- **Vitamins**: A, C, D, E, K, B1 (Thiamin), B2 (Riboflavin), B3 (Niacin), B5 (Pantothenic Acid), B6, B12, Folate
- **Minerals**: Calcium, Iron, Magnesium, Phosphorus, Potassium, Zinc

Each nutrient shows:
- Amount per serving
- % Daily Value (based on FDA recommendations)

## Database

### Source

- **Provider**: OpenNutrition (https://www.opennutrition.app)
- **License**: ODbL + DbCL
- **Items**: 5,302 "everyday" ingredients
- **Coverage**: 
  - 100% have alternate names for better matching
  - 70.1% have weight/volume conversion factors
  - 100% have comprehensive micronutrient data

### Schema

**nutrition_foods table**:
- Core nutrients stored as columns (calories, protein, carbs, fat, etc.)
- Micronutrients stored in `nutrition_data` JSONB field
- Conversion factors for common units (cup, tbsp, tsp, oz)
- Alternate names array for fuzzy matching

**pantry_items table**:
- `nutrition_food_id` links to matched nutrition food

**recipe_ingredients table**:
- `nutrition_food_id` links to matched nutrition food

## How It Works

### Ingredient Matching

1. **Direct Match**: If ingredient has `nutrition_food_id`, use that
2. **Auto-Search**: Search database by ingredient name
3. **Alternate Names**: Match against alternate names
4. **Fuzzy Match**: Partial text search if no exact match

### Unit Conversion

Supported units with conversion factors:
- **Weight**: gram, kilogram, ounce, pound
- **Volume**: cup, tablespoon, teaspoon, milliliter, liter
- **Fluid**: fluid ounce, pint, quart, gallon

Example: 2 cups rice → 2 × 160g (cup_to_g) = 320g

### Nutrition Calculation

All nutrition values in the database are **per 100g**.

Formula:
```
grams = convertToGrams(quantity, unit, nutritionFood)
multiplier = grams / 100
nutrient_amount = nutrient_per_100g × multiplier
```

Example:
- Ingredient: 320g cooked rice
- Calories per 100g: 130
- Calculation: 320 × (130/100) = 416 calories

### Aggregation

1. Calculate nutrition for each ingredient
2. Sum all ingredient values
3. Divide by recipe servings for per-serving values
4. Round appropriately (calories to whole, macros to 1 decimal)

## User Workflow

### Matching Ingredients

1. Navigate to **Ingredients** page
2. Click **Edit** on any ingredient
3. Review auto-suggested match or search manually
4. Click **Accept** to save the match
5. Match is used for all recipes containing that ingredient

### Viewing Recipe Nutrition

1. Open any recipe detail page
2. Nutrition section appears automatically (if enabled)
3. Shows match status (X of Y ingredients matched)
4. Displays nutrition label with all available data
5. Adjusts automatically when changing servings

### Enabling/Disabling

1. Go to **Settings** page
2. Toggle **Nutrition Information** (admins only)
3. Default: **Enabled** for all new users

## Accuracy & Limitations

### Factors Affecting Accuracy

- **Generic Matches**: Database uses average values, not brand-specific
- **Preparation Methods**: "Cooked" vs "Raw" have different values
- **Portion Estimates**: Based on standard serving sizes
- **Conversion Factors**: Volume-to-weight varies by ingredient density

### Best Practices

1. **Match Carefully**: Review suggested matches before accepting
2. **Use Specific Names**: "Chicken breast, cooked" vs "Chicken"
3. **Check Preparation**: Match cooking method (raw, cooked, fried)
4. **Verify Conversions**: Ensure conversion factors available

### Important Notes

- **Estimates Only**: Not for medical/dietary requirements
- **Incomplete Matches**: Only matched ingredients contribute to totals
- **Cooking Losses**: Doesn't account for fat/water loss during cooking
- **Not FDA Approved**: For informational purposes only

## API Reference

### calculateRecipeNutrition(ingredients, servings)

**Location**: `src/api/nutrition-calculator.ts` (frontend client) → `server/src/utils/nutrition-calculator.ts` (server-side calculation) via `POST /api/nutrition/calculate`

**Returns**: `RecipeNutrition` object with total, per_serving, ingredients, and match counts

**Example**:
```typescript
const nutrition = await calculateRecipeNutrition(
  [{ name: 'Rice', quantity: 2, unit: 'cup' }],
  4
);
console.log(`${nutrition?.matched_count} of ${nutrition?.total_count} matched`);
console.log(`Per serving: ${nutrition?.per_serving.calories} calories`);
```

### searchNutritionFoods(query, limit)

**Location**: `src/api/nutrition.ts` (frontend client) → `GET /api/nutrition/search`

**Returns**: Array of matching `NutritionFood` objects. Search prioritizes exact name matches, then starts-with, contains, and alternate-name matches.

### getSuggestedNutritionMatch(ingredientName)

**Location**: `src/api/nutrition.ts`

**Returns**: Best matching `NutritionFood` or null

### getNutritionFoodById(id)

**Location**: `src/api/nutrition.ts`

**Returns**: `NutritionFood` or null

### Server Routes

- `GET /api/nutrition/search?q=...&limit=...` — search foods
- `POST /api/nutrition/calculate` — calculate recipe nutrition from an ingredients array
- `GET /api/nutrition/foods` — lightweight food list for ingredient search
- `GET /api/nutrition/:id` — single food by id
- `GET /api/nutrition/export` — superadmin: export all foods
- `POST /api/nutrition/import-batch` — superadmin: bulk import foods (used by the setup wizard)

## Components

### NutritionFoodSearch

**Location**: `src/components/nutrition/NutritionFoodSearch.tsx`

**Props**:
- `ingredientName`: Name to auto-suggest match
- `selectedFoodId`: Currently selected food id
- `onSelect`: Callback when food is selected
- `onCustomNutrition`: Optional callback to set custom nutrition values manually

### NutritionLabel

**Location**: `src/components/recipe/NutritionLabel.tsx`

**Props**:
- `nutrition`: Nutrition data object with servings and all nutrient values

## Future Enhancements

- Recipe-level ingredient matching (match directly in recipe editor)
- Confidence scores for matches
- Manual nutrition value override
- Daily nutrition tracking from calendar meals
- Export nutrition facts as PDF
- Recipe filtering by nutrient criteria
- Custom daily value targets
- Nutrient density scoring

---

**Status**: ✅ Fully Implemented  
**Version**: v1.1 (Self-Hosted)  
**Last Updated**: 2026-08-01
