/**
 * Ingredient preparation helpers.
 * Shared client-side logic for recognizing and stripping preparation words
 * (grated, diced, etc.) and ingredient alternatives ("cream or half-and-half").
 * The server keeps its own copy of PREP_WORDS in server/src/routes/nutrition.ts.
 */

export const PREP_WORDS = [
  'grated', 'shredded', 'diced', 'cubed', 'chopped', 'minced', 'sliced',
  'peeled', 'crushed', 'mashed', 'pureed', 'puréed', 'blended', 'pounded',
  'julienned', 'julienne', 'halved', 'quartered', 'trimmed', 'cored',
  'seeded', 'pitted', 'deveined', 'shelled', 'boned', 'whisked', 'beaten',
  'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'fresh', 'raw',
  'cooked', 'boiled', 'steamed', 'roasted', 'fried', 'sauteed', 'sautéed',
  'baked', 'grilled', 'broiled', 'toasted', 'blanched', 'candied',
  'caramelized', 'clarified', 'melted', 'softened', 'frozen', 'thawed',
  'dried', 'ground', 'whole',
];

/**
 * Remove all preparation words from a search term so "grated cheddar"
 * still matches "Cheddar cheese".
 */
export function stripPreparations(term: string): string {
  if (!term) return term;
  let result = term;
  for (const word of PREP_WORDS) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate an ingredient name at alternatives such as "cream or half-and-half".
 * Stops at the first " or ", or a "/" or "\" surrounded by spaces.
 */
export function truncateAlternatives(name: string): string {
  if (!name) return name;
  const idx = name.search(/\s+or\s+|\s+[\\/]\s+/i);
  if (idx === -1) return name.trim();
  let result = name.slice(0, idx).trim();
  // Clean up dangling conjunctions left by "and /", "& /", etc.
  result = result.replace(/\s+(and|&|or)$/i, '').trim();
  return result;
}

/**
 * Strip a leading alternate measurement like "/ 8.8oz" or "/ 7 oz" from a name,
 * e.g. "250 g / 8.8oz fresh egg fettucine" → "fresh egg fettucine".
 * Handles dual metric/imperial measurements where the first unit was already
 * parsed as the quantity's unit.
 */
export function stripAlternateMeasurement(name: string): string {
  if (!name) return name;
  const stripped = name.replace(/^\s*\/\s*\d+(?:\.\d+)?\s*[a-zA-Z]+\.?\s*/i, '').trim();
  return stripped || name.trim();
}

/**
 * Extract leading preparation words from a name and return them separately.
 * "grated sharp cheddar cheese" → { name: "sharp cheddar cheese", preparation: "grated" }
 */
export function splitLeadingPreparation(name: string): { name: string; preparation: string } {
  if (!name) return { name: '', preparation: '' };
  const words = name.trim().split(/\s+/).filter(Boolean);
  let count = 0;
  while (count < words.length && PREP_WORDS.includes(words[count].toLowerCase())) {
    count++;
  }
  if (count === 0) return { name: name.trim(), preparation: '' };
  return {
    name: words.slice(count).join(' '),
    preparation: words.slice(0, count).join(' '),
  };
}
