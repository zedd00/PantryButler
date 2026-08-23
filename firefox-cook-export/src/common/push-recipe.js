/**
 * Recipe payload builder for the Pantry Butler `POST /api/recipes` endpoint.
 *
 * Ported from the SPA's `src/components/recipes/UrlImport.tsx` and
 * `src/lib/preparation.ts` so the extension produces the same structured
 * payload (ingredients with quantity/unit/preparation, instructions split into
 * a Main section, timer detection, group headings preserved).
 *
 * Exposes a single global `window.PBRecipe` / `globalThis.PBRecipe`.
 */
(function (global) {
  'use strict';

  const FRACTIONS = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '⅓': 0.333, '⅔': 0.666,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  };

  const PREP_WORDS = [
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

  const UNIT_MAP = {
    'g': 'g', 'gram': 'g', 'grams': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'l': 'L', 'liter': 'L', 'liters': 'L',
    'oz': 'oz', 'oz.': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'lb.': 'lb', 'pound': 'lb', 'pounds': 'lb',
    'cup': 'cup', 'cups': 'cup', 'c': 'cup', 'c.': 'cup',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp.': 'tbsp',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp.': 'tsp',
    'clove': 'clove', 'cloves': 'clove',
    'whole': 'whole',
    'slice': 'slice', 'slices': 'slice',
  };

  // Units recognised as measure indicators (mirrors UrlImport UNIT_ALT).
  const UNIT_ALT = 'g|kg|ml|l|oz\\.?|ounce|ounces|lb\\.?|pound|pounds|cup|cups|c\\.?|tbsp\\.?|tablespoon|tablespoons|tsp\\.?|teaspoon|teaspoons|clove|cloves|whole|slice|slices';

  function parseQuantityText(str) {
    const trimmed = String(str).trim();
    if (!trimmed) return 0;
    const mixed = trimmed.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return parseFloat(mixed[1]) + parseFloat(mixed[2]) / parseFloat(mixed[3]);
    const frac = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
    return parseFloat(trimmed) || 0;
  }

  function normalizeUnit(u) {
    if (!u) return 'unit';
    return UNIT_MAP[u.toLowerCase()] || u || 'unit';
  }

  function truncateAlternatives(name) {
    const idx = name.search(/\s+or\s+|\s+[\\/]\s+/i);
    if (idx === -1) return name.trim();
    let result = name.slice(0, idx).trim();
    result = result.replace(/\s+(and|&|or)$/i, '').trim();
    return result;
  }

  function stripAlternateMeasurement(name) {
    const stripped = name.replace(/^\s*\/\s*\d+(?:\.\d+)?\s*[a-zA-Z]+\.?\s*/i, '').trim();
    return stripped || name.trim();
  }

  function splitLeadingPreparation(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    let count = 0;
    while (count < words.length && PREP_WORDS.indexOf(words[count].toLowerCase()) !== -1) count++;
    if (count === 0) return { name: name.trim(), preparation: '' };
    return { name: words.slice(count).join(' '), preparation: words.slice(0, count).join(' ') };
  }

  function detectTimerMinutes(instruction) {
    if (!instruction) return 0;
    const pattern = /(\d+(?:\.\d+)?)\s*(?:[-–—]\s*(\d+(?:\.\d+)?)\s*|\bto\s+(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
    const matches = instruction.match(pattern) || [];
    if (matches.length === 0) return 0;
    let best = 0;
    for (const m of instruction.matchAll(pattern)) {
      const first = parseFloat(m[1]);
      const second = m[2] ? parseFloat(m[2]) : m[3] ? parseFloat(m[3]) : first;
      const value = Math.min(first, second);
      const unit = (m[4] || '').toLowerCase();
      let minutes = 0;
      if (unit.indexOf('hour') === 0) minutes = value * 60;
      else if (unit.indexOf('min') === 0) minutes = value;
      else minutes = Math.ceil(value / 60);
      best = Math.max(best, minutes);
    }
    return best;
  }

  /**
   * Parse a single ingredient line into the API's ingredient shape.
   * Mirrors UrlImport.parseIngredient (quantity + unit + name + preparation).
   */
  function parseIngredient(ingredientText) {
    let text = String(ingredientText || '');

    text = text.replace(/^[\s▢□☐▪•◦○●✔☑✦✧✿]+/, '');
    // A leading "optional"/"garnish"/"topping" marker is not part of the name;
    // is_optional is set separately by the caller.
    // ("optional garnish: sesame seeds" → "sesame seeds")
    text = text.replace(/^(?:optional\s*)?(?:garnish|topping)\s*:\s+/i, '');
    text = text.replace(/^optional\s*[:,-]?\s+/i, '');

    for (const [fraction, decimal] of Object.entries(FRACTIONS)) {
      text = text.split(fraction).join(decimal.toString());
    }

    const patterns = [
      new RegExp('^(\\d+(?:\\.\\d+)?(?:(?:\\s+\\d+\\s*)?\\/\\s*\\d+)?)\\s*(' + UNIT_ALT + ')?\\s+(.+)$', 'i'),
      new RegExp('^(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*(' + UNIT_ALT + ')?\\s+(.+)$', 'i'),
    ];

    for (const [pattern, isRange] of [[patterns[0], false], [patterns[1], true]]) {
      const match = text.match(pattern);
      if (match) {
        const quantity = parseQuantityText(match[1]);
        const unit = (isRange ? match[3] : match[2])?.toLowerCase() || '';
        let rest = (isRange ? match[4] : match[3]) || '';

        const parenNotes = [];
        rest = rest.replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (whole, inner, bracketInner) => {
          const trimmed = (inner ?? bracketInner ?? '').trim();
          if (trimmed) parenNotes.push(trimmed);
          return ' ';
        }).replace(/\s+/g, ' ').trim();

        rest = rest.replace(/^to\s+\d+(?:[./\s]*\d+)?\s*[a-zA-Z.]+\.?\s+/i, '');
        rest = truncateAlternatives(rest);
        rest = stripAlternateMeasurement(rest);

        const parts = rest.split(',');
        let name = parts[0].trim();
        let preparation = parts.slice(1).join(',').trim();

        if (parenNotes.length > 0) {
          preparation = preparation ? preparation + ', ' + parenNotes.join(', ') : parenNotes.join(', ');
        }

        name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();

        const cleaned = splitLeadingPreparation(name);
        name = cleaned.name;
        if (cleaned.preparation) {
          preparation = preparation ? preparation + ', ' + cleaned.preparation : cleaned.preparation;
        }

        return { name, preparation, quantity, unit: normalizeUnit(unit) };
      }
    }

    // Fallback: no leading quantity — the whole line is the name (minus prep).
    const cleaned = splitLeadingPreparation(text.replace(/,.*$/, '').trim());
    return { name: cleaned.name || text.trim(), preparation: cleaned.preparation, quantity: 1, unit: 'unit' };
  }

  /**
   * Build the POST /api/recipes body from the popup's form fields.
   * form: { title, description, servings, prep, cook, source, notes, tags,
   *        ingredients: string[], instructions: string[] }
   * Lines ending in ":" become ingredient group headers (group_name).
   */
  function buildPayload(form, connection) {
    const ingredients = [];
    let order = 0;
    let groupName = null;

    for (const raw of form.ingredients || []) {
      const line = String(raw).trim();
      if (!line) continue;
      if (/^[\w\s-]{2,60}:$/.test(line)) {
        groupName = line.replace(/:$/, '').trim();
        continue;
      }
      const parsed = parseIngredient(line);
      const name = parsed.name.length > 100 ? parsed.name.substring(0, 100) : parsed.name;
      ingredients.push({
        name,
        preparation: parsed.preparation || null,
        quantity: parsed.quantity,
        unit: parsed.unit || 'unit',
        is_optional: line.toLowerCase().includes('optional'),
        order_index: order++,
        group_name: groupName,
      });
    }

    const steps = (form.instructions || [])
      .map(function (s) { return String(s).trim(); })
      .filter(Boolean)
      .map(function (instruction, idx) {
        return {
          order_index: idx,
          instruction: instruction,
          image_url: '',
          timer_minutes: detectTimerMinutes(instruction),
        };
      });

    const sections = steps.length > 0
      ? [{ title: 'Main', order_index: 0, steps: steps }]
      : [];

    const notesParts = [];
    if (form.source) notesParts.push('Source: ' + form.source);
    if (form.notes) notesParts.push(form.notes);

    const payload = {
      instance_id: connection.instanceId,
      title: (form.title || 'Untitled Recipe').trim(),
      description: (form.description || '').trim() || null,
      image_url: form.image_url || null,
      prep_time_minutes: form.prep,
      cook_time_minutes: form.cook,
      servings: form.servings || 1,
      notes: notesParts.length > 0 ? notesParts.join('\n') : null,
      tags: (form.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      ingredients: ingredients,
      sections: sections,
    };

    return payload;
  }

  global.PBRecipe = {
    parseIngredient: parseIngredient,
    detectTimerMinutes: detectTimerMinutes,
    buildPayload: buildPayload,
  };
})(typeof self !== 'undefined' ? self : this);
