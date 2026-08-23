import { Hono } from 'hono';
import { query } from '../db/pool';
import { requireAuth, requireJwt, type AuthVariables } from '../middleware/auth';
import { calculateRecipeNutrition, type IngredientInput } from '../utils/nutrition-calculator';
import { createRateLimiter } from '../utils/rate-limit';
import { clientIp } from '../utils/client-ip';

const nutrition = new Hono<{ Variables: AuthVariables }>();

// The public search/calculate endpoints are unauthenticated by design, so they
// get their own generous-but-bounded rate limit to stop them being used as a
// free database-query spam channel.
const publicNutritionLimiter = createRateLimiter(60, 60 * 1000);
const MAX_SEARCH_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;
const MAX_CALCULATE_INGREDIENTS = 250;
const MAX_SERVINGS = 1000;
const MAX_IMPORT_BATCH = 10000;

// Search/calculate/foods/:id are public; only the superadmin export/import
// routes require auth (and are JWT/superadmin-gated), so no router-level
// scope guard applies here. Tokens cannot reach those routes regardless.

// Preparation words that describe how an ingredient is prepared (grated, diced, etc.).
// These are stripped from search queries so "grated cheddar" still matches "Cheddar cheese".
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

function stripPreparations(term: string): string {
  if (!term) return term;
  let result = term;
  for (const word of PREP_WORDS) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}


nutrition.get('/search', async (c) => {
  try {
    if (!publicNutritionLimiter(clientIp(c))) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    const q = c.req.query('q');
    const rawLimit = parseInt(c.req.query('limit') || '10', 10);
    // Clamp the limit so a caller cannot force arbitrarily expensive LIKE scans.
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_SEARCH_LIMIT) : 10;

    if (!q || q.trim().length === 0) {
      return c.json([]);
    }

    const searchTerm = q.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
    const results: any[] = [];
    const seenIds = new Set<string>();

    const addIfNew = (rows: any[]) => {
      for (const row of rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          results.push(row);
        }
      }
    };

    // Run the priority tiers for a given search term
    const runTiers = async (term: string) => {
      // Priority 1: Exact match
      const exact = await query('SELECT * FROM nutrition_foods WHERE LOWER(name) = $1 LIMIT 1', [term]);
      addIfNew(exact.rows);

      // Priority 2: Starts with
      if (results.length < limit) {
        const startsWith = await query(
          'SELECT * FROM nutrition_foods WHERE LOWER(name) LIKE $1 LIMIT $2',
          [`${term}%`, limit]
        );
        addIfNew(startsWith.rows);
      }

      // Priority 3: Contains
      if (results.length < limit) {
        const contains = await query(
          'SELECT * FROM nutrition_foods WHERE LOWER(name) LIKE $1 LIMIT $2',
          [`%${term}%`, limit]
        );
        addIfNew(contains.rows);
      }

      // Priority 4: Alternate names
      if (results.length < limit) {
        const alt = await query(
          `SELECT * FROM nutrition_foods WHERE EXISTS (
             SELECT 1 FROM unnest(alternate_names) AS alt_name WHERE alt_name ILIKE $1
           ) LIMIT $2`,
          [term, limit]
        );
        addIfNew(alt.rows);
      }
    };

    await runTiers(searchTerm);

    // If nothing matched, retry without preparation words (e.g. "grated", "diced")
    if (results.length < limit) {
      const strippedTerm = stripPreparations(searchTerm);
      if (strippedTerm && strippedTerm !== searchTerm) {
        await runTiers(strippedTerm);
      }
    }

    return c.json(results.slice(0, limit));
  } catch (err) {
    console.error('Search nutrition foods error:', err);
    return c.json({ error: 'Failed to search nutrition foods' }, 500);
  }
});

nutrition.post('/calculate', async (c) => {
  try {
    if (!publicNutritionLimiter(clientIp(c))) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    const { ingredients, servings = 1 } = await c.req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return c.json({ error: 'ingredients array is required' }, 400);
    }
    // Cap array size so a hostile payload cannot trigger a multi-thousand-query
    // N+1 scan against the nutrition table.
    if (ingredients.length > MAX_CALCULATE_INGREDIENTS) {
      return c.json({ error: `ingredients array must not exceed ${MAX_CALCULATE_INGREDIENTS} items` }, 400);
    }
    const numericServings = Number(servings);
    if (!Number.isFinite(numericServings) || numericServings <= 0 || numericServings > MAX_SERVINGS) {
      return c.json({ error: 'servings must be a positive number' }, 400);
    }

    const result = await calculateRecipeNutrition(ingredients as IngredientInput[], numericServings);
    return c.json(result);
  } catch (err) {
    console.error('Calculate nutrition error:', err);
    return c.json({ error: 'Failed to calculate nutrition' }, 500);
  }
});

nutrition.get('/foods', async (c) => {
  try {
    if (!publicNutritionLimiter(clientIp(c))) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    const result = await query('SELECT id, name, category, serving_size, serving_unit, serving_grams, tbsp_to_g, tsp_to_g, oz_to_g, cup_to_g, fl_oz_to_ml, fl_oz_to_l, ml_to_pint, ml_to_quart, ml_to_gallon, l_to_pint, l_to_quart, l_to_gallon FROM nutrition_foods ORDER BY name');
    return c.json(result.rows);
  } catch (err) {
    console.error('Get nutrition foods error:', err);
    return c.json({ error: 'Failed to fetch nutrition foods' }, 500);
  }
});

// Export/import are web-session (JWT) superadmin operations. requireJwt keeps a
// long-lived API token — even a superadmin-owned `all` token — off these
// routes, so a leaked read-scoped token can never dump or overwrite the full
// dataset.
nutrition.get('/export', requireAuth, requireJwt, async (c) => {
  try {
    const userId = c.get('userId');
    const profile = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
    if (profile.rows.length === 0 || profile.rows[0].role !== 'superadmin') {
      return c.json({ error: 'Forbidden: Superadmin access required' }, 403);
    }

    const result = await query('SELECT * FROM nutrition_foods ORDER BY id');
    return c.json(result.rows);
  } catch (err) {
    console.error('Export nutrition data error:', err);
    return c.json({ error: 'Failed to export nutrition data' }, 500);
  }
});

nutrition.post('/import-batch', requireAuth, requireJwt, async (c) => {
  try {
    const userId = c.get('userId');
    const profile = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
    if (profile.rows.length === 0 || profile.rows[0].role !== 'superadmin') {
      return c.json({ error: 'Forbidden: Superadmin access required' }, 403);
    }

    const body = await c.req.json();
    const batch_data = body?.batch_data;

    if (!batch_data || !Array.isArray(batch_data)) {
      return c.json({ error: 'batch_data array is required' }, 400);
    }
    // Cap the batch so a single request can't drive an arbitrarily large
    // jsonb_to_recordset write. The UI already chunks at 500 rows.
    if (batch_data.length > MAX_IMPORT_BATCH) {
      return c.json({ error: `batch_data must not exceed ${MAX_IMPORT_BATCH} records` }, 400);
    }

    console.log(`Import batch: ${batch_data.length} records, first id: ${batch_data[0]?.id}`);

    const dataJson = JSON.stringify(batch_data);

    const result = await query(
      `INSERT INTO nutrition_foods (
        id, name, category, calories, protein_g, carbs_g, fat_g,
        fiber_g, sugar_g, sodium_mg, cholesterol_mg,
        serving_size, serving_unit, serving_grams, nutrition_data,
        alternate_names, tbsp_to_g, tsp_to_g, oz_to_g, cup_to_g,
        fl_oz_to_ml, fl_oz_to_l, ml_to_pint, ml_to_quart, ml_to_gallon,
        l_to_pint, l_to_quart, l_to_gallon,
        name_es, name_fr, name_hi, name_it, name_sq, name_zh,
        alternate_names_es, alternate_names_fr, alternate_names_hi,
        alternate_names_it, alternate_names_sq, alternate_names_zh
      )
      SELECT
        id, name, category,
        (calories)::NUMERIC, (protein_g)::NUMERIC, (carbs_g)::NUMERIC, (fat_g)::NUMERIC,
        (fiber_g)::NUMERIC, (sugar_g)::NUMERIC, (sodium_mg)::NUMERIC, (cholesterol_mg)::NUMERIC,
        (serving_size)::JSONB, serving_unit, NULLIF(serving_grams, '')::NUMERIC, (nutrition_data)::JSONB,
        CASE WHEN alternate_names IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names)) ELSE NULL END,
        NULLIF(tbsp_to_g, '')::NUMERIC, NULLIF(tsp_to_g, '')::NUMERIC, NULLIF(oz_to_g, '')::NUMERIC, NULLIF(cup_to_g, '')::NUMERIC,
        NULLIF(fl_oz_to_ml, '')::NUMERIC, NULLIF(fl_oz_to_l, '')::NUMERIC, NULLIF(ml_to_pint, '')::NUMERIC, NULLIF(ml_to_quart, '')::NUMERIC, NULLIF(ml_to_gallon, '')::NUMERIC,
        NULLIF(l_to_pint, '')::NUMERIC, NULLIF(l_to_quart, '')::NUMERIC, NULLIF(l_to_gallon, '')::NUMERIC,
        name_es, name_fr, name_hi, name_it, name_sq, name_zh,
        CASE WHEN alternate_names_es IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_es)) ELSE NULL END,
        CASE WHEN alternate_names_fr IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_fr)) ELSE NULL END,
        CASE WHEN alternate_names_hi IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_hi)) ELSE NULL END,
        CASE WHEN alternate_names_it IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_it)) ELSE NULL END,
        CASE WHEN alternate_names_sq IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_sq)) ELSE NULL END,
        CASE WHEN alternate_names_zh IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_zh)) ELSE NULL END
      FROM jsonb_to_recordset($1::jsonb) AS x(
        id TEXT, name TEXT, category TEXT,
        calories NUMERIC, protein_g NUMERIC, carbs_g NUMERIC, fat_g NUMERIC,
        fiber_g NUMERIC, sugar_g NUMERIC, sodium_mg NUMERIC, cholesterol_mg NUMERIC,
        serving_size JSONB, serving_unit TEXT, serving_grams TEXT, nutrition_data JSONB,
        alternate_names JSONB,
        tbsp_to_g TEXT, tsp_to_g TEXT, oz_to_g TEXT, cup_to_g TEXT,
        fl_oz_to_ml TEXT, fl_oz_to_l TEXT, ml_to_pint TEXT, ml_to_quart TEXT, ml_to_gallon TEXT,
        l_to_pint TEXT, l_to_quart TEXT, l_to_gallon TEXT,
        name_es TEXT, name_fr TEXT, name_hi TEXT, name_it TEXT, name_sq TEXT, name_zh TEXT,
        alternate_names_es JSONB, alternate_names_fr JSONB, alternate_names_hi JSONB,
        alternate_names_it JSONB, alternate_names_sq JSONB, alternate_names_zh JSONB
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, category = EXCLUDED.category,
        calories = EXCLUDED.calories, protein_g = EXCLUDED.protein_g,
        carbs_g = EXCLUDED.carbs_g, fat_g = EXCLUDED.fat_g,
        fiber_g = EXCLUDED.fiber_g, sugar_g = EXCLUDED.sugar_g,
        sodium_mg = EXCLUDED.sodium_mg, cholesterol_mg = EXCLUDED.cholesterol_mg,
        serving_size = EXCLUDED.serving_size, serving_unit = EXCLUDED.serving_unit,
        serving_grams = EXCLUDED.serving_grams, nutrition_data = EXCLUDED.nutrition_data,
        alternate_names = EXCLUDED.alternate_names,
        tbsp_to_g = EXCLUDED.tbsp_to_g, tsp_to_g = EXCLUDED.tsp_to_g,
        oz_to_g = EXCLUDED.oz_to_g, cup_to_g = EXCLUDED.cup_to_g,
        fl_oz_to_ml = EXCLUDED.fl_oz_to_ml, fl_oz_to_l = EXCLUDED.fl_oz_to_l,
        ml_to_pint = EXCLUDED.ml_to_pint, ml_to_quart = EXCLUDED.ml_to_quart,
        ml_to_gallon = EXCLUDED.ml_to_gallon,
        l_to_pint = EXCLUDED.l_to_pint, l_to_quart = EXCLUDED.l_to_quart,
        l_to_gallon = EXCLUDED.l_to_gallon,
        name_es = EXCLUDED.name_es, name_fr = EXCLUDED.name_fr,
        name_hi = EXCLUDED.name_hi, name_it = EXCLUDED.name_it,
        name_sq = EXCLUDED.name_sq, name_zh = EXCLUDED.name_zh,
        alternate_names_es = EXCLUDED.alternate_names_es,
        alternate_names_fr = EXCLUDED.alternate_names_fr,
        alternate_names_hi = EXCLUDED.alternate_names_hi,
        alternate_names_it = EXCLUDED.alternate_names_it,
        alternate_names_sq = EXCLUDED.alternate_names_sq,
        alternate_names_zh = EXCLUDED.alternate_names_zh`,
      [dataJson]
    );

    const imported = result.rowCount || 0;
    console.log(`Import batch complete: ${imported} rows affected`);

    return c.json({ success: true, imported });
  } catch (err) {
    console.error('Import nutrition batch error:', err);
    return c.json({ error: 'Failed to import nutrition data' }, 500);
  }
});

// Dynamic :id route must be registered last so it does not shadow the
// static /export route registered above it.
nutrition.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await query('SELECT * FROM nutrition_foods WHERE id = $1', [id]);
    if (result.rows.length === 0) return c.json({ error: 'Nutrition food not found' }, 404);
    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Get nutrition food error:', err);
    return c.json({ error: 'Failed to fetch nutrition food' }, 500);
  }
});

export { nutrition };
