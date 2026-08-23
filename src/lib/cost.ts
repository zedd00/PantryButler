/**
 * Cost Tracking Library
 * Derives per-ingredient, per-serving, and per-meal costs from pantry prices.
 * Prices on pantry items are the total paid; an optional price_size records the
 * amount that price covers (in the item's unit), so the unit price is derived as
 * price / price_size, falling back to price / amount when no size is set. For
 * unlimited items, price is the per-unit price. Recipe ingredient amounts are
 * converted into the matched pantry item's unit via the conversion
 * infrastructure before costing.
 */
import type { PantryItem, RecipeIngredient, UnitConversion } from '@/types/types';
import { convertQuantity, isMeasurableUnit, normalizeUnit } from './conversions';

export interface IngredientCost {
  cost: number | null;
  matched: boolean;
  unitPrice: number | null;
}

export interface RecipeIngredientCost {
  name: string;
  cost: number | null;
  matched: boolean;
}

export interface RecipeCost {
  perIngredient: RecipeIngredientCost[];
  total: number | null;
  perServing: number | null;
}

/**
 * Format a number as a localized currency amount.
 * Never throws: invalid/unrecognized currency codes fall back to USD.
 */
export function formatCurrency(value: number, currency?: string | null, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale ?? 'en', {
      style: 'currency',
      currency: currency ?? 'USD',
    }).format(value);
  } catch {
    return new Intl.NumberFormat(locale ?? 'en', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }
}

/**
 * Compute the cost of a single recipe ingredient based on the matching pantry item.
 *
 * Matching is a case-insensitive exact match on the ingredient name. The pantry
 * item's unit price is price / amount (or just price for unlimited items). The
 * recipe ingredient's quantity is converted into the pantry item's unit using the
 * conversion infrastructure; if the units can't be reconciled, no cost is produced.
 */
export function computeIngredientCost(input: {
  ingredient: Pick<RecipeIngredient, 'name' | 'quantity' | 'unit'>;
  pantryItems: PantryItem[];
  conversions: UnitConversion[];
}): IngredientCost {
  const { ingredient, pantryItems, conversions } = input;

  const pantry = pantryItems.find(
    (item) => item.ingredient_name.toLowerCase() === ingredient.name.toLowerCase()
  );

  if (!pantry) {
    return { cost: null, matched: false, unitPrice: null };
  }

  const price = pantry.price === null || pantry.price === undefined ? null : Number(pantry.price);
  const amount = Number(pantry.amount);
  const priceSize = pantry.price_size === null || pantry.price_size === undefined
    ? null
    : Number(pantry.price_size);

  let unitPrice: number | null;
  if (pantry.is_unlimited) {
    unitPrice = price;
  } else if (price !== null && Number.isFinite(price)) {
    // If a price_size was recorded (the size `price` covers), use it as the
    // basis; otherwise fall back to the amount on hand.
    const basis = priceSize !== null && Number.isFinite(priceSize) && priceSize > 0 ? priceSize : amount;
    if (basis > 0) {
      unitPrice = price / basis;
    } else {
      return { cost: null, matched: true, unitPrice: null };
    }
  } else {
    return { cost: null, matched: true, unitPrice: null };
  }

  if (unitPrice === null || !Number.isFinite(unitPrice)) {
    return { cost: null, matched: true, unitPrice: null };
  }

  const quantity = Number(ingredient.quantity);
  const ingredientUnit = normalizeUnit(ingredient.unit);
  const pantryUnit = normalizeUnit(pantry.unit);

  let convertedQuantity: number;
  // Same unit, or both non-measurable count units (e.g. "whole" vs "unit"):
  // quantities are directly comparable. Otherwise convert via the conversion infra.
  if (ingredientUnit === pantryUnit || (!isMeasurableUnit(ingredient.unit) && !isMeasurableUnit(pantry.unit))) {
    convertedQuantity = quantity;
  } else {
    const result = convertQuantity(quantity, ingredient.unit, pantry.unit, ingredient.name, conversions);
    if (!result.converted) {
      return { cost: null, matched: true, unitPrice };
    }
    convertedQuantity = result.quantity;
  }

  const cost = convertedQuantity * unitPrice;
  if (!Number.isFinite(cost) || cost < 0) {
    return { cost: null, matched: true, unitPrice };
  }

  return { cost, matched: true, unitPrice };
}

/**
 * Compute the total cost of a recipe and its cost per serving.
 *
 * total is the sum of the non-null per-ingredient costs. If no ingredient has a
 * price, total is null so callers can show a "no cost data" state.
 */
export function computeRecipeCost(input: {
  ingredients: RecipeIngredient[];
  pantryItems: PantryItem[];
  conversions: UnitConversion[];
  baseServings: number;
}): RecipeCost {
  const { ingredients, pantryItems, conversions, baseServings } = input;

  const perIngredient = ingredients.map((ingredient) => {
    const result = computeIngredientCost({ ingredient, pantryItems, conversions });
    return { name: ingredient.name, cost: result.cost, matched: result.matched };
  });

  let total = 0;
  for (const item of perIngredient) {
    if (item.cost === null) continue;
    total += item.cost;
  }

  let hasAnyCost = false;
  for (const item of perIngredient) {
    if (item.cost !== null) {
      hasAnyCost = true;
      break;
    }
  }

  const totalCost: number | null = hasAnyCost ? total : null;

  let perServing: number | null = null;
  if (totalCost !== null && baseServings > 0) {
    perServing = totalCost / baseServings;
  }

  return { perIngredient, total: totalCost, perServing };
}
