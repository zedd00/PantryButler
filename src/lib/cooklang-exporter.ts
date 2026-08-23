/**
 * Cooklang Exporter
 * Converts PantryButler recipes to Cooklang (.cook) format.
 *
 * Spec-compliant output:
 * - YAML front matter (--- fences) for metadata
 * - == Section Title == markers for sections
 * - @name{quantity%unit} with braces for multi-word names
 * - #name{quantity} cookware markers
 * - ~{duration%unit} timer markers
 * - Backslash-escaped special characters in plain text
 *
 * Ingredient quantities are distributed across mentions so amounts are not
 * duplicated: if a step lists an amount next to the ingredient name, that
 * amount is used and deducted from the ingredient's total; a mention without
 * an explicit amount is assumed to use whatever remains.
 */

import type { RecipeWithDetails, RecipeIngredient } from '@/types/types';

/** Escape Cooklang special characters so they are treated as literal text. */
function escapeCooklang(text: string): string {
  return text.replace(/([@#~:{}%()\\])/g, '\\$1');
}

/** Whether a name needs braces (multi-word) per the spec single-word rule. */
function needsBraces(name: string): boolean {
  return !/^[a-zA-Z0-9\-']+$/.test(name);
}

/** Build an @ingredient marker with an optional quantity and unit. */
function buildIngredientMarker(
  name: string,
  amountText: string | null,
  unit: string | null
): string {
  if (amountText != null) {
    const details = unit ? `${amountText}%${unit}` : amountText;
    return `@${name}{${details}}`;
  }
  return needsBraces(name) ? `@${name}{}` : `@${name}`;
}

/** Parse a quantity from a number/fraction/mixed-fraction string. */
function parseQuantity(str: string): number | null {
  str = str.trim();
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    const numerator = parseFloat(parts[0]);
    const denominator = parseFloat(parts[1]);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }
  const num = parseFloat(str.replace(',', '.'));
  return isNaN(num) ? null : num;
}

/** Format a remainder quantity for the marker. */
function formatQuantity(value: number): string {
  return String(Math.round(value * 100) / 100);
}

const AMOUNT_PATTERN = '(\\d+(?:[.,]\\d+)?|\\d+\\s*\\/\\s*\\d+)';
const UNIT_PATTERN = '[a-zA-Z]+';

interface ParsedAmount {
  amountText: string;
  unit: string | null;
  value: number;
  /** Number of characters in the instruction consumed by the amount text. */
  consumed: number;
}

/** Look for an amount immediately before the ingredient name ("200 g flour"). */
function parseAmountBefore(text: string, start: number): ParsedAmount | null {
  const before = text.slice(0, start);
  const m = before.match(
    new RegExp(`${AMOUNT_PATTERN}\\s*(${UNIT_PATTERN})?(?:\\s+of)?\\s*$`)
  );
  if (!m) return null;
  const value = parseQuantity(m[1]);
  if (value === null) return null;
  return { amountText: m[1], unit: m[2] ?? null, value, consumed: m[0].length };
}

/** Look for an amount immediately after the ingredient name ("flour 200 g"). */
function parseAmountAfter(text: string, end: number): ParsedAmount | null {
  const after = text.slice(end);
  const m = after.match(
    new RegExp(`^\\s+${AMOUNT_PATTERN}\\s*(${UNIT_PATTERN})?`)
  );
  if (!m) return null;
  const value = parseQuantity(m[1]);
  if (value === null) return null;
  return { amountText: m[1], unit: m[2] ?? null, value, consumed: m[0].length };
}

interface Mention {
  /** Start/end of the full span (including any inline amount) to replace. */
  replaceStart: number;
  replaceEnd: number;
  amountText: string | null;
  unit: string | null;
  amountValue: number | null;
  ingredient: RecipeIngredient;
}

/** Find every ingredient mention in a step, with any inline amount. */
function parseMentions(instruction: string, ingredients: RecipeIngredient[]): Mention[] {
  const mentions: Mention[] = [];

  for (const ing of ingredients) {
    if (!ing.name) continue;
    const escapedName = ing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(instruction)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;

      let replaceStart = start;
      let replaceEnd = end;
      let amountText: string | null = null;
      let unit: string | null = null;
      let amountValue: number | null = null;

      const before = parseAmountBefore(instruction, start);
      if (before) {
        replaceStart = start - before.consumed;
        amountText = before.amountText;
        unit = before.unit;
        amountValue = before.value;
      } else {
        const after = parseAmountAfter(instruction, end);
        if (after) {
          replaceEnd = end + after.consumed;
          amountText = after.amountText;
          unit = after.unit;
          amountValue = after.value;
        }
      }

      mentions.push({
        replaceStart,
        replaceEnd,
        amountText,
        unit,
        amountValue,
        ingredient: ing,
      });
    }
  }

  // Sort by position, longest match first so combined names win over parts.
  mentions.sort((a, b) =>
    a.replaceStart !== b.replaceStart
      ? a.replaceStart - b.replaceStart
      : b.replaceEnd - b.replaceStart - (a.replaceEnd - a.replaceStart)
  );

  const filtered: Mention[] = [];
  let lastEnd = -1;
  for (const mention of mentions) {
    if (mention.replaceStart < lastEnd) continue;
    filtered.push(mention);
    lastEnd = mention.replaceEnd;
  }
  return filtered;
}

interface ParsedStep {
  instruction: string;
  mentions: Mention[];
}

export function exportRecipeToCooklang(recipe: RecipeWithDetails): string {
  const lines: string[] = [];

  // YAML front matter metadata
  lines.push('---');
  lines.push(`title: ${recipe.title}`);

  if (recipe.description) {
    lines.push(`description: ${recipe.description}`);
  }

  if (recipe.servings) {
    lines.push(`servings: ${recipe.servings}`);
  }

  if (recipe.prep_time_minutes) {
    lines.push(`prep time: ${recipe.prep_time_minutes} minutes`);
  }

  if (recipe.cook_time_minutes) {
    lines.push(`cook time: ${recipe.cook_time_minutes} minutes`);
  }

  if (recipe.prep_time_minutes && recipe.cook_time_minutes) {
    lines.push(`total time: ${recipe.prep_time_minutes + recipe.cook_time_minutes} minutes`);
  }

  if (recipe.tags && recipe.tags.length > 0) {
    lines.push(`tags: ${recipe.tags.map(t => t.name).join(', ')}`);
  }

  if (recipe.notes) {
    lines.push(`notes: ${recipe.notes}`);
  }

  lines.push('---');
  lines.push('');

  const ingredients = recipe.ingredients ?? [];
  const sections = recipe.sections && recipe.sections.length > 0 ? recipe.sections : [];

  // Single default "Instructions" section renders without a section marker
  const isDefaultSection =
    sections.length === 1 && sections[0].title.toLowerCase() === 'instructions';

  // Pass 1: parse mentions in every step and total the amounts listed in text
  const parsedSections: { section: (typeof sections)[number]; steps: (ParsedStep & { timer: number | null })[] }[] = [];
  const listedByIngredient = new Map<string, number>();

  for (const section of sections) {
    const steps: (ParsedStep & { timer: number | null })[] = [];
    for (const step of section.steps ?? []) {
      const instruction = escapeCooklang(step.instruction || '');
      const mentions = parseMentions(instruction, ingredients);
      for (const mention of mentions) {
        if (mention.amountValue != null) {
          const key = mention.ingredient.name.toLowerCase();
          listedByIngredient.set(key, (listedByIngredient.get(key) ?? 0) + mention.amountValue);
        }
      }
      steps.push({ instruction, mentions, timer: step.timer_minutes });
    }
    parsedSections.push({ section, steps });
  }

  // Pass 2: compute what remains of each ingredient after listed amounts
  const remainingByIngredient = new Map<string, number>();
  for (const ing of ingredients) {
    const quantity = ing.quantity || 0;
    const listed = listedByIngredient.get(ing.name.toLowerCase()) ?? 0;
    remainingByIngredient.set(ing.name.toLowerCase(), Math.max(0, quantity - listed));
  }

  // Pass 3: emit steps, assigning the remainder to unquantified mentions
  for (const { section, steps } of parsedSections) {
    if (!isDefaultSection) {
      lines.push(`== ${section.title} ==`);
      lines.push('');
    }

    for (const step of steps) {
      let instruction = step.instruction;
      let cursor = 0;
      let output = '';
      for (const mention of step.mentions) {
        output += instruction.slice(cursor, mention.replaceStart);

        let amountText: string | null = mention.amountText;
        let unit: string | null = mention.unit;
        if (amountText == null) {
          const remaining = remainingByIngredient.get(mention.ingredient.name.toLowerCase()) ?? 0;
          if (remaining > 0) {
            amountText = formatQuantity(remaining);
            unit = mention.ingredient.unit || null;
            remainingByIngredient.set(mention.ingredient.name.toLowerCase(), 0);
          }
        }

        output += buildIngredientMarker(mention.ingredient.name, amountText, unit);
        cursor = mention.replaceEnd;
      }
      output += instruction.slice(cursor);
      instruction = output;

      // Best-effort: link equipment that appears in the instruction text
      if (recipe.equipment && recipe.equipment.length > 0) {
        recipe.equipment.forEach((eq: any) => {
          const equipmentName = (eq.equipment_name || eq.name || '').trim();
          if (!equipmentName) return;
          const escapedName = equipmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
          const marker = needsBraces(equipmentName)
            ? `#${equipmentName}{}`
            : `#${equipmentName}`;
          instruction = instruction.replace(regex, marker);
        });
      }

      // Append timer
      if (step.timer && step.timer > 0) {
        instruction += ` ~{${step.timer}%minutes}`;
      }

      lines.push(instruction);
      lines.push(''); // Empty line between steps
    }
  }

  return lines.join('\n');
}

export function downloadCooklangFile(recipe: RecipeWithDetails) {
  const cooklangContent = exportRecipeToCooklang(recipe);

  // Create a safe filename
  const filename = recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '.cook';

  // Create blob and download
  const blob = new Blob([cooklangContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
