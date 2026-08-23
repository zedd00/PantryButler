/**
 * Unit Conversion Library - Restructured Version
 *
 * All conversion math is derived from two single sources of truth:
 *
 *   VOLUME_ML  - ml per unit (US customary volume units)
 *   WEIGHT_G   - grams per unit (metric + avoirdupois weight units)
 *
 * Volume↔volume and weight↔weight conversions use only these fixed tables,
 * so every pair in a system is convertible and internally consistent.
 *
 * Volume↔weight conversions depend on the ingredient's density, which is
 * anchored by the ingredient-specific fields in unit_conversions / nutrition
 * foods (tsp_to_g, tbsp_to_g, cup_to_g). Once any one anchor is known, grams
 * per unit are derived for every volume unit (tsp, tbsp, fl oz, cup, pint,
 * quart, gallon, ml, L) and all volume↔weight pairs become convertible.
 *
 * The per-ingredient volume-to-volume fields (fl_oz_to_ml, ml_to_pint, etc.)
 * are mathematically redundant with the fixed tables, so they are no longer
 * used to compute conversions; doing so guarantees US/UK mixing and bad data
 * in those fields can never produce inconsistent results.
 */

import type { UnitConversion } from '@/types/types';

/** US customary volume: milliliters per unit (1 fl oz = 1/128 gallon = 29.5735295625 ml). */
const VOLUME_ML: Record<string, number> = {
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  'fl oz': 29.5735295625,
  cup: 236.5882365,
  pint: 473.176473,
  quart: 946.352946,
  gallon: 3785.411784,
  ml: 1,
  L: 1000,
};

/** Weight: grams per unit (1 oz = 1/16 lb = 28.349523125 g). */
const WEIGHT_G: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

export interface ConversionResult {
  quantity: number;
  unit: string;
  originalQuantity: number;
  originalUnit: string;
  converted: boolean;
}

/**
 * Normalize unit names to handle variations
 */
export function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();

  // Teaspoons
  if (['tsp', 'teaspoon', 'teaspoons'].includes(normalized)) return 'tsp';

  // Tablespoons
  if (['tbsp', 'tablespoon', 'tablespoons', 'tbs'].includes(normalized)) return 'tbsp';

  // Cups
  if (['cup', 'cups', 'c'].includes(normalized)) return 'cup';

  // Fluid ounces
  if (['fl oz', 'fluid ounce', 'fluid ounces', 'fl. oz.', 'fl. oz'].includes(normalized)) return 'fl oz';

  // Ounces (weight)
  if (['oz', 'ounce', 'ounces'].includes(normalized)) return 'oz';

  // Pounds
  if (['lb', 'lbs', 'pound', 'pounds'].includes(normalized)) return 'lb';

  // Grams
  if (['g', 'gram', 'grams'].includes(normalized)) return 'g';

  // Milligrams
  if (['mg', 'milligram', 'milligrams'].includes(normalized)) return 'mg';

  // Kilograms
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) return 'kg';

  // Milliliters
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(normalized)) return 'ml';

  // Liters
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(normalized)) return 'L';

  // Pints
  if (['pint', 'pints', 'pt'].includes(normalized)) return 'pint';

  // Quarts
  if (['quart', 'quarts', 'qt'].includes(normalized)) return 'quart';

  // Gallons
  if (['gallon', 'gallons', 'gal'].includes(normalized)) return 'gallon';

  // Other common units (pass through)
  return normalized;
}

/**
 * Smart rounding based on unit type
 */
function smartRound(value: number, unit: string): number {
  const normalizedUnit = normalizeUnit(unit);

  // Teaspoons: round to nearest 0.25
  if (normalizedUnit === 'tsp') {
    return Math.round(value * 4) / 4;
  }

  // Tablespoons: round to nearest 0.5
  if (normalizedUnit === 'tbsp') {
    return Math.round(value * 2) / 2;
  }

  // Ounces: round to nearest 0.1
  if (normalizedUnit === 'oz' || normalizedUnit === 'fl oz') {
    return Math.round(value * 10) / 10;
  }

  // Cups: round to nearest 0.125 (1/8 cup)
  if (normalizedUnit === 'cup') {
    return Math.round(value * 8) / 8;
  }

  // Grams: round to nearest 1
  if (normalizedUnit === 'g') {
    return Math.round(value);
  }

  // Milligrams: round to nearest 1
  if (normalizedUnit === 'mg') {
    return Math.round(value);
  }

  // Milliliters: round to nearest 5
  if (normalizedUnit === 'ml') {
    return Math.round(value / 5) * 5;
  }

  // Default: round to 2 decimal places
  return Math.round(value * 100) / 100;
}

/**
 * Get preferred units based on unit system setting
 */
export function getPreferredUnits(unitSystem: string | null | undefined): string[] {
  if (!unitSystem) return [];

  switch (unitSystem) {
    case 'metric':
    case 'metric_weights':
      return ['g', 'kg', 'ml', 'L'];
    case 'imperial':
    case 'imperial_volume':
      return ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'fl oz'];
    default:
      return [];
  }
}

/**
 * Apply standard conversions between units of the same system using the
 * canonical factor tables. Volume↔weight pairs return null (density needed).
 */
function applyStandardConversion(quantity: number, fromUnit: string, toUnit: string): number | null {
  const fromVolume = VOLUME_ML[fromUnit];
  const toVolume = VOLUME_ML[toUnit];
  if (fromVolume !== undefined && toVolume !== undefined) {
    return quantity * (fromVolume / toVolume);
  }

  const fromWeight = WEIGHT_G[fromUnit];
  const toWeight = WEIGHT_G[toUnit];
  if (fromWeight !== undefined && toWeight !== undefined) {
    return quantity * (fromWeight / toWeight);
  }

  return null;
}

/**
 * Derive grams-per-unit density for every volume unit from the ingredient's
 * specific conversion anchors (cup_to_g, tbsp_to_g, tsp_to_g). Any one anchor
 * is sufficient; cup_to_g is preferred as the most precisely measured.
 */
function buildDensityMap(conversion: UnitConversion): Record<string, number> | null {
  let cupToG: number | null = null;
  if (conversion.cup_to_g !== null && conversion.cup_to_g !== undefined && conversion.cup_to_g > 0) {
    cupToG = conversion.cup_to_g;
  } else if (conversion.tbsp_to_g !== null && conversion.tbsp_to_g !== undefined && conversion.tbsp_to_g > 0) {
    cupToG = conversion.tbsp_to_g * 16;
  } else if (conversion.tsp_to_g !== null && conversion.tsp_to_g !== undefined && conversion.tsp_to_g > 0) {
    cupToG = conversion.tsp_to_g * 48;
  }
  if (cupToG === null) return null;

  const mlPerCup = VOLUME_ML.cup;
  return {
    tsp: cupToG / 48,
    tbsp: cupToG / 16,
    cup: cupToG,
    'fl oz': cupToG / 8,
    pint: cupToG * 2,
    quart: cupToG * 4,
    gallon: cupToG * 16,
    ml: cupToG / mlPerCup,
    L: cupToG * (1000 / mlPerCup),
  };
}

/**
 * Convert between volume and weight units using the ingredient's density.
 * Bridges through grams so every volume↔weight pair is derivable from a
 * single anchor (and volume↔volume stays internally consistent too).
 */
function applyDensityConversion(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  conversion: UnitConversion
): number | null {
  const density = buildDensityMap(conversion);
  if (!density) return null;

  const fromVolume = density[fromUnit];
  const toVolume = density[toUnit];
  const fromWeight = WEIGHT_G[fromUnit];
  const toWeight = WEIGHT_G[toUnit];

  if (fromVolume !== undefined && toWeight !== undefined) {
    // Volume → weight: grams = quantity × (g per volume unit), then to target weight unit
    return (quantity * fromVolume) / toWeight;
  }
  if (fromWeight !== undefined && toVolume !== undefined) {
    // Weight → volume: grams → volume via (g per volume unit)
    return (quantity * fromWeight) / toVolume;
  }
  if (fromVolume !== undefined && toVolume !== undefined) {
    // Volume → volume through the density map (consistent with standard)
    return quantity * (fromVolume / toVolume);
  }

  return null;
}

/**
 * Convert a quantity from one unit to another using the conversion structure.
 *
 * Order of resolution:
 *   1. Same unit  → passthrough
 *   2. Same system (volume↔volume, weight↔weight) → fixed US customary tables
 *   3. Volume↔weight → ingredient density derived from tsp/tbsp/cup_to_g anchors
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  ingredientName: string | null,
  conversions: UnitConversion[]
): { quantity: number; converted: boolean } {
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);

  // If units are the same, no conversion needed
  if (normalizedFrom === normalizedTo) {
    return { quantity: smartRound(quantity, toUnit), converted: false };
  }

  // Find conversion for this ingredient (or general conversion with NULL ingredient_name)
  const conversion = conversions.find((c) =>
    c.ingredient_name === ingredientName ||
    c.ingredient_name === null ||
    (ingredientName && c.ingredient_name?.toLowerCase() === ingredientName.toLowerCase())
  );

  let convertedQty: number | null = null;

  // Same-system conversions use the fixed factor tables
  convertedQty = applyStandardConversion(quantity, normalizedFrom, normalizedTo);

  // Volume↔weight conversions require the ingredient's density
  if (convertedQty === null && conversion) {
    convertedQty = applyDensityConversion(quantity, normalizedFrom, normalizedTo, conversion);
  }

  if (convertedQty !== null) {
    return { quantity: smartRound(convertedQty, toUnit), converted: true };
  }

  return { quantity: smartRound(quantity, fromUnit), converted: false };
}

/**
 * Determine if a unit is already in the preferred unit system
 */
function isInPreferredSystem(unit: string, preferredUnits: string[]): boolean {
  const normalizedUnit = normalizeUnit(unit);
  const normalizedPreferred = preferredUnits.map((u) => normalizeUnit(u));

  // Check if unit is directly in preferred list
  if (normalizedPreferred.includes(normalizedUnit)) {
    return true;
  }

  // Check if unit is in the same system as preferred units
  const metricWeightUnits = ['g', 'kg', 'mg'];
  const metricVolumeUnits = ['ml', 'L'];
  const imperialWeightUnits = ['oz', 'lb'];
  const imperialVolumeUnits = ['tsp', 'tbsp', 'cup', 'fl oz', 'pint', 'quart', 'gallon'];

  // If unit is metric weight and preferred includes metric weight
  if (metricWeightUnits.includes(normalizedUnit) &&
      normalizedPreferred.some((u) => metricWeightUnits.includes(u))) {
    return true;
  }

  // If unit is metric volume and preferred includes metric volume
  if (metricVolumeUnits.includes(normalizedUnit) &&
      normalizedPreferred.some((u) => metricVolumeUnits.includes(u))) {
    return true;
  }

  // If unit is imperial weight and preferred includes imperial weight
  if (imperialWeightUnits.includes(normalizedUnit) &&
      normalizedPreferred.some((u) => imperialWeightUnits.includes(u))) {
    return true;
  }

  // If unit is imperial volume and preferred includes imperial volume
  if (imperialVolumeUnits.includes(normalizedUnit) &&
      normalizedPreferred.some((u) => imperialVolumeUnits.includes(u))) {
    return true;
  }

  return false;
}

/**
 * Choose the most appropriate unit based on quantity
 */
function chooseBestUnit(quantity: number, fromUnit: string, preferredUnits: string[]): string | null {
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedPreferred = preferredUnits.map((u) => normalizeUnit(u));

  // Metric weight: prefer g for < 1000g, kg for >= 1000g
  if (normalizedFrom === 'g' && normalizedPreferred.includes('kg')) {
    return quantity >= 1000 ? 'kg' : null; // null means keep original
  }
  if (normalizedFrom === 'kg' && normalizedPreferred.includes('g')) {
    return quantity < 1 ? 'g' : null;
  }
  // mg: prefer g for >= 1000mg, kg for >= 1000000mg
  if (normalizedFrom === 'mg' && normalizedPreferred.includes('kg')) {
    return quantity >= 1000000 ? 'kg' : normalizedPreferred.includes('g') && quantity >= 1000 ? 'g' : null;
  }
  if (normalizedFrom === 'g' && normalizedPreferred.includes('mg')) {
    return quantity < 1 ? 'mg' : null;
  }

  // Metric volume: prefer ml for < 1000ml, L for >= 1000ml
  if (normalizedFrom === 'ml' && normalizedPreferred.includes('L')) {
    return quantity >= 1000 ? 'L' : null;
  }
  if (normalizedFrom === 'L' && normalizedPreferred.includes('ml')) {
    return quantity < 1 ? 'ml' : null;
  }

  // Imperial weight: prefer oz for < 16oz, lb for >= 16oz
  if (normalizedFrom === 'oz' && normalizedPreferred.includes('lb')) {
    return quantity >= 16 ? 'lb' : null;
  }
  if (normalizedFrom === 'lb' && normalizedPreferred.includes('oz')) {
    return quantity < 1 ? 'oz' : null;
  }

  // Imperial weight to metric: prefer kg for >= 2.2 lb (1000g), otherwise g
  if (normalizedFrom === 'lb' && (normalizedPreferred.includes('kg') || normalizedPreferred.includes('g'))) {
    return quantity >= 2.2 ? 'kg' : 'g';
  }
  if (normalizedFrom === 'oz' && (normalizedPreferred.includes('kg') || normalizedPreferred.includes('g'))) {
    return quantity >= 35.27 ? 'kg' : 'g';
  }

  // Imperial volume: prefer larger units for readability
  // tsp -> tbsp if >= 3 tsp
  if (normalizedFrom === 'tsp' && normalizedPreferred.includes('tbsp')) {
    return quantity >= 3 ? 'tbsp' : null;
  }
  // tbsp -> cup if >= 4 tbsp (1/4 cup)
  if (normalizedFrom === 'tbsp' && normalizedPreferred.includes('cup')) {
    return quantity >= 4 ? 'cup' : null;
  }
  // cup -> larger units only if significantly large
  if (normalizedFrom === 'cup' && normalizedPreferred.includes('pint')) {
    return quantity >= 4 ? 'pint' : null;
  }
  if (normalizedFrom === 'cup' && normalizedPreferred.includes('quart')) {
    return quantity >= 8 ? 'quart' : null;
  }

  return null;
}

/**
 * Convert ingredient to preferred unit system
 */
export function convertIngredient(
  quantity: number,
  unit: string,
  ingredientName: string | null,
  preferredUnits: string[],
  conversions: UnitConversion[]
): ConversionResult {
  const originalQuantity = quantity;
  const originalUnit = unit;
  const normalizedUnit = normalizeUnit(unit);

  // If unit is already in the preferred system, check if we should still convert for better readability
  if (isInPreferredSystem(unit, preferredUnits)) {
    // Check if a better unit exists within the same system
    const bestUnit = chooseBestUnit(quantity, unit, preferredUnits);
    if (bestUnit) {
      const result = convertQuantity(quantity, normalizedUnit, bestUnit, ingredientName, conversions);
      if (result.converted) {
        return {
          quantity: result.quantity,
          unit: bestUnit,
          originalQuantity,
          originalUnit,
          converted: true
        };
      }
    }

    // No better unit found, keep original
    return {
      quantity: smartRound(quantity, unit),
      unit,
      originalQuantity,
      originalUnit,
      converted: false
    };
  }

  // Unit is not in preferred system, try to convert
  // First, choose the best target unit based on quantity
  const bestUnit = chooseBestUnit(quantity, unit, preferredUnits);
  if (bestUnit) {
    const result = convertQuantity(quantity, normalizedUnit, bestUnit, ingredientName, conversions);
    if (result.converted) {
      return {
        quantity: result.quantity,
        unit: bestUnit,
        originalQuantity,
        originalUnit,
        converted: true
      };
    }
  }

  // Try to convert to each preferred unit
  for (const toUnit of preferredUnits) {
    const result = convertQuantity(quantity, normalizedUnit, toUnit, ingredientName, conversions);
    if (result.converted) {
      return {
        quantity: result.quantity,
        unit: toUnit,
        originalQuantity,
        originalUnit,
        converted: true
      };
    }
  }

  // No conversion found, return original with smart rounding
  return {
    quantity: smartRound(quantity, unit),
    unit,
    originalQuantity,
    originalUnit,
    converted: false
  };
}

/**
 * Convert with settings (convenience function)
 */
export function convertWithSettings(
  quantity: number,
  unit: string,
  ingredientName: string | null,
  settings: { preferred_unit_system?: string | null } | null,
  conversions: UnitConversion[]
): ConversionResult {
  const preferredUnits = getPreferredUnits(settings?.preferred_unit_system);
  return convertIngredient(quantity, unit, ingredientName, preferredUnits, conversions);
}

/**
 * Format quantity for display
 */
export function formatQuantity(quantity: number, unit: string): string {
  // Coerce to a finite number (DB NUMERIC arrives as a string from node-postgres)
  const qty = typeof quantity === 'number' && Number.isFinite(quantity)
    ? quantity
    : parseFloat(String(quantity ?? ''));
  if (!Number.isFinite(qty)) return '0';

  const normalizedUnit = normalizeUnit(unit);

  // For fractions (cups, tsp, tbsp)
  if (['cup', 'tsp', 'tbsp'].includes(normalizedUnit)) {
    // Convert to fraction if possible
    const fractions: Record<number, string> = {
      0.125: '⅛',
      0.25: '¼',
      0.333: '⅓',
      0.375: '⅜',
      0.5: '½',
      0.625: '⅝',
      0.666: '⅔',
      0.75: '¾',
      0.875: '⅞'
    };

    const whole = Math.floor(qty);
    const decimal = qty - whole;

    for (const [dec, frac] of Object.entries(fractions)) {
      if (Math.abs(decimal - parseFloat(dec)) < 0.01) {
        return whole > 0 ? `${whole} ${frac}` : frac;
      }
    }
  }

  // Default formatting
  if (qty === Math.floor(qty)) {
    return qty.toString();
  }

  return qty.toFixed(2).replace(/\.?0+$/, '');
}

const NON_MEASURABLE_UNITS = new Set([
  'whole', 'slice', 'slices', 'clove', 'cloves', 'unit', 'units',
  'pinch', 'pinches', 'sprig', 'sprigs', 'bunch', 'can', 'cans',
  'package', 'packages', 'bag', 'bags', 'jar', 'jars', 'stalk',
  'stalks', 'head', 'heads', 'leaf', 'leaves', 'stick', 'sticks',
  'dash', 'drop', 'drops', 'serving', 'servings', 'taste', 'to taste',
  'envelope', 'envelopes', 'container', 'containers',
]);

/**
 * Whether a unit is a measurable volume unit (has a fixed ml factor).
 */
export function isVolumeUnit(unit: string): boolean {
  return VOLUME_ML[normalizeUnit(unit)] !== undefined;
}

/**
 * Whether a unit is a measurable weight unit (has a fixed gram factor).
 */
export function isWeightUnit(unit: string): boolean {
  return WEIGHT_G[normalizeUnit(unit)] !== undefined;
}

/**
 * Whether a conversion row carries a density anchor (grams per tsp/tbsp/cup)
 * that enables volume↔weight conversions for that ingredient.
 */
export function hasDensityAnchor(
  conversion: { cup_to_g?: number | null; tbsp_to_g?: number | null; tsp_to_g?: number | null } | null | undefined
): boolean {
  if (!conversion) return false;
  return (
    (conversion.cup_to_g != null && conversion.cup_to_g > 0) ||
    (conversion.tbsp_to_g != null && conversion.tbsp_to_g > 0) ||
    (conversion.tsp_to_g != null && conversion.tsp_to_g > 0)
  );
}

/**
 * Whether a unit can be converted to another unit system.
 * Count words like "whole" or "slice" have no measurable equivalent.
 */
export function isMeasurableUnit(unit: string): boolean {
  if (!unit) return false;
  return !NON_MEASURABLE_UNITS.has(normalizeUnit(unit));
}
