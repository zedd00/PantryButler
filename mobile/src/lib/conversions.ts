import type { UnitConversion } from '../api/types';

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

export function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  if (['tsp', 'teaspoon', 'teaspoons'].includes(normalized)) return 'tsp';
  if (['tbsp', 'tablespoon', 'tablespoons', 'tbs'].includes(normalized)) return 'tbsp';
  if (['cup', 'cups', 'c'].includes(normalized)) return 'cup';
  if (['fl oz', 'fluid ounce', 'fluid ounces', 'fl. oz.', 'fl. oz'].includes(normalized)) return 'fl oz';
  if (['oz', 'ounce', 'ounces'].includes(normalized)) return 'oz';
  if (['lb', 'lbs', 'pound', 'pounds'].includes(normalized)) return 'lb';
  if (['g', 'gram', 'grams'].includes(normalized)) return 'g';
  if (['mg', 'milligram', 'milligrams'].includes(normalized)) return 'mg';
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) return 'kg';
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(normalized)) return 'ml';
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(normalized)) return 'L';
  if (['pint', 'pints', 'pt'].includes(normalized)) return 'pint';
  if (['quart', 'quarts', 'qt'].includes(normalized)) return 'quart';
  if (['gallon', 'gallons', 'gal'].includes(normalized)) return 'gallon';
  return normalized;
}

function smartRound(value: number, unit: string): number {
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === 'tsp') return Math.round(value * 4) / 4;
  if (normalizedUnit === 'tbsp') return Math.round(value * 2) / 2;
  if (normalizedUnit === 'oz' || normalizedUnit === 'fl oz') return Math.round(value * 10) / 10;
  if (normalizedUnit === 'cup') return Math.round(value * 8) / 8;
  if (normalizedUnit === 'g') return Math.round(value);
  if (normalizedUnit === 'mg') return Math.round(value);
  if (normalizedUnit === 'ml') return Math.round(value / 5) * 5;
  return Math.round(value * 100) / 100;
}

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

function applyStandardConversion(quantity: number, fromUnit: string, toUnit: string): number | null {
  const fromVolume = VOLUME_ML[fromUnit];
  const toVolume = VOLUME_ML[toUnit];
  if (fromVolume !== undefined && toVolume !== undefined) return quantity * (fromVolume / toVolume);

  const fromWeight = WEIGHT_G[fromUnit];
  const toWeight = WEIGHT_G[toUnit];
  if (fromWeight !== undefined && toWeight !== undefined) return quantity * (fromWeight / toWeight);

  return null;
}

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

  if (fromVolume !== undefined && toWeight !== undefined) return (quantity * fromVolume) / toWeight;
  if (fromWeight !== undefined && toVolume !== undefined) return (quantity * fromWeight) / toVolume;
  if (fromVolume !== undefined && toVolume !== undefined) return quantity * (fromVolume / toVolume);

  return null;
}

export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  ingredientName: string | null,
  conversions: UnitConversion[]
): { quantity: number; converted: boolean } {
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);

  if (normalizedFrom === normalizedTo) {
    return { quantity: smartRound(quantity, toUnit), converted: false };
  }

  const conversion = conversions.find(
    (c) =>
      c.ingredient_name === ingredientName ||
      c.ingredient_name === null ||
      (ingredientName && c.ingredient_name?.toLowerCase() === ingredientName.toLowerCase())
  );

  let convertedQty: number | null = null;
  convertedQty = applyStandardConversion(quantity, normalizedFrom, normalizedTo);

  if (convertedQty === null && conversion) {
    convertedQty = applyDensityConversion(quantity, normalizedFrom, normalizedTo, conversion);
  }

  if (convertedQty !== null) {
    return { quantity: smartRound(convertedQty, toUnit), converted: true };
  }

  return { quantity: smartRound(quantity, fromUnit), converted: false };
}

function isInPreferredSystem(unit: string, preferredUnits: string[]): boolean {
  const normalizedUnit = normalizeUnit(unit);
  const normalizedPreferred = preferredUnits.map((u) => normalizeUnit(u));

  if (normalizedPreferred.includes(normalizedUnit)) return true;

  const metricWeightUnits = ['g', 'kg', 'mg'];
  const metricVolumeUnits = ['ml', 'L'];
  const imperialWeightUnits = ['oz', 'lb'];
  const imperialVolumeUnits = ['tsp', 'tbsp', 'cup', 'fl oz', 'pint', 'quart', 'gallon'];

  if (metricWeightUnits.includes(normalizedUnit) && normalizedPreferred.some((u) => metricWeightUnits.includes(u))) return true;
  if (metricVolumeUnits.includes(normalizedUnit) && normalizedPreferred.some((u) => metricVolumeUnits.includes(u))) return true;
  if (imperialWeightUnits.includes(normalizedUnit) && normalizedPreferred.some((u) => imperialWeightUnits.includes(u))) return true;
  if (imperialVolumeUnits.includes(normalizedUnit) && normalizedPreferred.some((u) => imperialVolumeUnits.includes(u))) return true;

  return false;
}

function chooseBestUnit(quantity: number, fromUnit: string, preferredUnits: string[]): string | null {
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedPreferred = preferredUnits.map((u) => normalizeUnit(u));

  if (normalizedFrom === 'g' && normalizedPreferred.includes('kg')) return quantity >= 1000 ? 'kg' : null;
  if (normalizedFrom === 'kg' && normalizedPreferred.includes('g')) return quantity < 1 ? 'g' : null;
  if (normalizedFrom === 'mg' && normalizedPreferred.includes('kg')) {
    return quantity >= 1000000 ? 'kg' : normalizedPreferred.includes('g') && quantity >= 1000 ? 'g' : null;
  }
  if (normalizedFrom === 'g' && normalizedPreferred.includes('mg')) return quantity < 1 ? 'mg' : null;

  if (normalizedFrom === 'ml' && normalizedPreferred.includes('L')) return quantity >= 1000 ? 'L' : null;
  if (normalizedFrom === 'L' && normalizedPreferred.includes('ml')) return quantity < 1 ? 'ml' : null;

  if (normalizedFrom === 'oz' && normalizedPreferred.includes('lb')) return quantity >= 16 ? 'lb' : null;
  if (normalizedFrom === 'lb' && normalizedPreferred.includes('oz')) return quantity < 1 ? 'oz' : null;

  if (normalizedFrom === 'lb' && (normalizedPreferred.includes('kg') || normalizedPreferred.includes('g'))) {
    return quantity >= 2.2 ? 'kg' : 'g';
  }
  if (normalizedFrom === 'oz' && (normalizedPreferred.includes('kg') || normalizedPreferred.includes('g'))) {
    return quantity >= 35.27 ? 'kg' : 'g';
  }

  if (normalizedFrom === 'tsp' && normalizedPreferred.includes('tbsp')) return quantity >= 3 ? 'tbsp' : null;
  if (normalizedFrom === 'tbsp' && normalizedPreferred.includes('cup')) return quantity >= 4 ? 'cup' : null;
  if (normalizedFrom === 'cup' && normalizedPreferred.includes('pint')) return quantity >= 4 ? 'pint' : null;
  if (normalizedFrom === 'cup' && normalizedPreferred.includes('quart')) return quantity >= 8 ? 'quart' : null;

  return null;
}

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

  if (isInPreferredSystem(unit, preferredUnits)) {
    const bestUnit = chooseBestUnit(quantity, unit, preferredUnits);
    if (bestUnit) {
      const result = convertQuantity(quantity, normalizedUnit, bestUnit, ingredientName, conversions);
      if (result.converted) {
        return { quantity: result.quantity, unit: bestUnit, originalQuantity, originalUnit, converted: true };
      }
    }
    return { quantity: smartRound(quantity, unit), unit, originalQuantity, originalUnit, converted: false };
  }

  const bestUnit = chooseBestUnit(quantity, unit, preferredUnits);
  if (bestUnit) {
    const result = convertQuantity(quantity, normalizedUnit, bestUnit, ingredientName, conversions);
    if (result.converted) {
      return { quantity: result.quantity, unit: bestUnit, originalQuantity, originalUnit, converted: true };
    }
  }

  for (const toUnit of preferredUnits) {
    const result = convertQuantity(quantity, normalizedUnit, toUnit, ingredientName, conversions);
    if (result.converted) {
      return { quantity: result.quantity, unit: toUnit, originalQuantity, originalUnit, converted: true };
    }
  }

  return { quantity: smartRound(quantity, unit), unit, originalQuantity, originalUnit, converted: false };
}

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

export function formatQuantity(quantity: number, unit: string): string {
  const qty = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : parseFloat(String(quantity ?? ''));
  if (!Number.isFinite(qty)) return '0';

  const normalizedUnit = normalizeUnit(unit);
  if (['cup', 'tsp', 'tbsp'].includes(normalizedUnit)) {
    const fractions: Record<number, string> = {
      0.125: '⅛',
      0.25: '¼',
      0.333: '⅓',
      0.375: '⅜',
      0.5: '½',
      0.625: '⅝',
      0.666: '⅔',
      0.75: '¾',
      0.875: '⅞',
    };
    const whole = Math.floor(qty);
    const decimal = qty - whole;
    for (const [dec, frac] of Object.entries(fractions)) {
      if (Math.abs(decimal - parseFloat(dec)) < 0.01) {
        return whole > 0 ? `${whole} ${frac}` : frac;
      }
    }
  }

  if (qty === Math.floor(qty)) return qty.toString();
  return qty.toFixed(2).replace(/\.?0+$/, '');
}
