import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query, pool } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const recipes = new Hono<{ Variables: AuthVariables }>();

// Red-team hardening: bound the size of every client-supplied collection so a
// hostile recipe payload cannot force a multi-thousand-insert write or an
// arbitrarily deep/nested grid_recipe to be processed.
const MAX_RECIPE_INGREDIENTS = 500;
const MAX_RECIPE_SECTIONS = 100;
const MAX_RECIPE_STEPS = 500;
const MAX_RECIPE_TAGS = 100;
const MAX_RECIPE_EQUIPMENT = 100;
const MAX_GRID_RECIPE_BYTES = 200_000;

const gridRecipeNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('ingredient'),
      ingredientOrderIndex: z.number().int().min(0),
    }),
    z.object({
      type: z.literal('step'),
      text: z.string().max(60),
      inputs: z.array(gridRecipeNodeSchema),
    }),
  ])
);

const gridRecipeSchema = z.object({
  root: gridRecipeNodeSchema,
}).refine(
  (value) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_GRID_RECIPE_BYTES,
  { message: 'grid_recipe is too large' }
);

const ingredientSchema = z.object({
  name: z.string(),
  preparation: z.string().nullable().optional(),
  quantity: z.number(),
  unit: z.string(),
  is_optional: z.boolean().optional(),
  order_index: z.number().int().optional(),
  substitutions: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  prep_style: z.string().nullable().optional(),
  nutrition_food_id: z.string().nullable().optional(),
  group_name: z.string().nullable().optional(),
});

const stepSchema = z.object({
  order_index: z.number().int(),
  instruction: z.string(),
  image_url: z.string().nullable().optional(),
  timer_minutes: z.number().int().nullable().optional(),
});

const sectionSchema = z.object({
  title: z.string(),
  order_index: z.number().int(),
  steps: z.array(stepSchema).max(MAX_RECIPE_STEPS).optional(),
});

const createRecipeSchema = z.object({
  instance_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  prep_time_minutes: z.number().int().nullable().optional(),
  cook_time_minutes: z.number().int().nullable().optional(),
  servings: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  grid_recipe: gridRecipeSchema.nullable().optional(),
  imported_from_recipe_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).max(MAX_RECIPE_TAGS).optional(),
  equipment: z.array(z.string()).max(MAX_RECIPE_EQUIPMENT).optional(),
  ingredients: z.array(ingredientSchema).max(MAX_RECIPE_INGREDIENTS).optional(),
  sections: z.array(sectionSchema).max(MAX_RECIPE_SECTIONS).optional(),
});

const updateRecipeSchema = z.object({
  instance_id: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  prep_time_minutes: z.number().int().nullable().optional(),
  cook_time_minutes: z.number().int().nullable().optional(),
  servings: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  grid_recipe: gridRecipeSchema.nullable().optional(),
  tags: z.array(z.string()).max(MAX_RECIPE_TAGS).optional(),
  equipment: z.array(z.string()).max(MAX_RECIPE_EQUIPMENT).optional(),
  ingredients: z.array(ingredientSchema).max(MAX_RECIPE_INGREDIENTS).optional(),
  sections: z.array(sectionSchema).max(MAX_RECIPE_SECTIONS).optional(),
});

const publicToggleSchema = z.object({
  is_public: z.boolean(),
});

// Batch helpers for recipe create/update. Each collection (tags, equipment,
// ingredients) is now resolved with a small, constant number of queries
// regardless of how many items it contains (the old per-item loops were ~3N).

async function batchUpsertTags(recipeId: string, instanceId: string, tagNames: string[]): Promise<void> {
  if (!tagNames.length) return;
  const names = [...new Set(tagNames)];
  const idByName = new Map<string, string>();

  const existing = await query(
    'SELECT id, name FROM tags WHERE instance_id = $1 AND name = ANY($2::text[])',
    [instanceId, names]
  );
  for (const row of existing.rows) idByName.set(row.name, row.id);

  const missing = names.filter((name) => !idByName.has(name));
  if (missing.length) {
    const inserted = await query(
      `INSERT INTO tags (name, instance_id)
       SELECT m.name, $1 FROM unnest($2::text[]) AS m(name)
       ON CONFLICT (instance_id, name) DO NOTHING
       RETURNING id, name`,
      [instanceId, missing]
    );
    for (const row of inserted.rows) idByName.set(row.name, row.id);
  }

  const tagIds = names
    .map((name) => idByName.get(name))
    .filter((id): id is string => Boolean(id));
  if (tagIds.length) {
    await query(
      'INSERT INTO recipe_tags (recipe_id, tag_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING',
      [recipeId, tagIds]
    );
  }
}

async function batchUpsertEquipment(recipeId: string, instanceId: string, equipmentNames: string[]): Promise<void> {
  if (!equipmentNames.length) return;
  const names = [...new Set(equipmentNames)];
  const idByName = new Map<string, string>();

  const existing = await query(
    'SELECT id, name FROM equipment WHERE instance_id = $1 AND name = ANY($2::text[])',
    [instanceId, names]
  );
  for (const row of existing.rows) idByName.set(row.name, row.id);

  const missing = names.filter((name) => !idByName.has(name));
  if (missing.length) {
    // equipment has no unique constraint, so there is no ON CONFLICT target —
    // mirrors the original SELECT-then-INSERT behavior (including its races).
    const inserted = await query(
      `INSERT INTO equipment (name, instance_id, auto_created, source_recipe_id)
       SELECT m.name, $1, TRUE, $2 FROM unnest($3::text[]) AS m(name)
       RETURNING id, name`,
      [instanceId, recipeId, missing]
    );
    for (const row of inserted.rows) idByName.set(row.name, row.id);
  }

  const kept = names
    .map((name) => ({ name, id: idByName.get(name) }))
    .filter((x): x is { name: string; id: string } => Boolean(x.id));
  if (kept.length) {
    await query(
      `INSERT INTO recipe_equipment (recipe_id, equipment_id, equipment_name, order_index)
       SELECT $1, v.id, v.name, v.idx
       FROM unnest($2::text[], $3::uuid[], $4::int[]) AS v(name, id, idx)`,
      [recipeId, kept.map((x) => x.name), kept.map((x) => x.id), kept.map((_, i) => i)]
    );
  }
}

// Bulk-insert recipe ingredients and their side effects (pantry sync + unit
// conversions from nutrition data). Behavior matches the old per-ingredient
// loop: pantry items are auto-created when missing, and the recipe's nutrition
// match is only propagated when the pantry item has none yet (a user's own
// match is never overwritten). Duplicate ingredient names resolve first-
// occurrence-wins, exactly like the sequential loop.
async function batchInsertIngredients(
  recipeId: string,
  instanceId: string,
  ingredients: any[],
  recipeTitle: string,
  userId: string
): Promise<void> {
  if (!ingredients.length) return;

  const ingJson = ingredients.map((ing, i) => ({
    name: ing.name,
    preparation: ing.preparation || null,
    quantity: ing.quantity,
    unit: ing.unit,
    is_optional: ing.is_optional || false,
    order_index: ing.order_index ?? i,
    substitutions: ing.substitutions || null,
    notes: ing.notes || null,
    prep_style: ing.prep_style || null,
    nutrition_food_id: ing.nutrition_food_id || null,
    group_name: ing.group_name || null,
  }));
  await query(
    `INSERT INTO recipe_ingredients (
       recipe_id, name, preparation, quantity, unit, is_optional, order_index,
       substitutions, notes, prep_style, nutrition_food_id, group_name
     )
     SELECT $1, r.name, r.preparation, r.quantity, r.unit, r.is_optional, r.order_index,
            r.substitutions, r.notes, r.prep_style, r.nutrition_food_id, r.group_name
     FROM jsonb_to_recordset($2::jsonb) AS r(
       name text, preparation text, quantity numeric, unit text, is_optional boolean,
       order_index int, substitutions text, notes text, prep_style text,
       nutrition_food_id text, group_name text
     )`,
    [recipeId, JSON.stringify(ingJson)]
  );

  // Pantry sync: one lookup, then batched inserts/updates for only the items
  // that need them, deduped by ingredient name (first occurrence wins).
  const lowerToName = new Map<string, string>();
  for (const ing of ingredients) {
    if (!lowerToName.has(ing.name.toLowerCase())) lowerToName.set(ing.name.toLowerCase(), ing.name);
  }
  const nutritionByName = new Map<string, string | null>();
  for (const ing of ingredients) {
    if (!nutritionByName.has(ing.name)) nutritionByName.set(ing.name, ing.nutrition_food_id || null);
  }

  const pantryResult = await query(
    'SELECT * FROM pantry_items WHERE instance_id = $1 AND LOWER(ingredient_name) = ANY($2::text[])',
    [instanceId, [...lowerToName.keys()]]
  );
  const pantryByLower = new Map<string, any>();
  for (const row of pantryResult.rows) {
    const key = row.ingredient_name.toLowerCase();
    if (!pantryByLower.has(key)) pantryByLower.set(key, row);
  }

  const toInsert: any[] = [];
  const toUpdate: any[] = [];
  for (const [lower, origName] of lowerToName) {
    const existing = pantryByLower.get(lower);
    const foodId = nutritionByName.get(origName) ?? null;
    if (!existing) {
      toInsert.push({
        ingredient_name: origName,
        nutrition_food_id: foodId,
        notes: `Auto-created from recipe: ${recipeTitle}`,
      });
    } else if (foodId && !existing.nutrition_food_id) {
      toUpdate.push({ id: existing.id, nutrition_food_id: foodId });
    }
  }

  if (toInsert.length) {
    await query(
      `INSERT INTO pantry_items (
         ingredient_name, amount, instance_id, auto_created, source_recipe_id,
         notes, user_id, nutrition_food_id
       )
       SELECT v.ingredient_name, 0, $1, TRUE, $2, v.notes, $3, v.nutrition_food_id
       FROM jsonb_to_recordset($4::jsonb) AS v(
         ingredient_name text, nutrition_food_id text, notes text
       )`,
      [instanceId, recipeId, userId, JSON.stringify(toInsert)]
    );
  }

  if (toUpdate.length) {
    await query(
      `UPDATE pantry_items SET nutrition_food_id = v.nutrition_food_id, updated_at = NOW()
       FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, nutrition_food_id text)
       WHERE pantry_items.id = v.id`,
      [JSON.stringify(toUpdate)]
    );
  }

  // Batch-create unit conversions from nutrition data for matched ingredients.
  const withFood = ingredients.filter((ing) => ing.nutrition_food_id);
  if (withFood.length) {
    const convJson = withFood.map((ing) => ({
      ingredient_name: ing.name,
      nutrition_food_id: ing.nutrition_food_id,
    }));
    await query(
      `INSERT INTO unit_conversions (instance_id, ingredient_name,
         tbsp_to_g, tsp_to_g, oz_to_g, cup_to_g,
         fl_oz_to_ml, fl_oz_to_l,
         ml_to_pint, ml_to_quart, ml_to_gallon,
         l_to_pint, l_to_quart, l_to_gallon)
       SELECT $1, v.ingredient_name,
         nf.tbsp_to_g, nf.tsp_to_g, nf.oz_to_g, nf.cup_to_g,
         nf.fl_oz_to_ml, nf.fl_oz_to_l,
         nf.ml_to_pint, nf.ml_to_quart, nf.ml_to_gallon,
         nf.l_to_pint, nf.l_to_quart, nf.l_to_gallon
       FROM jsonb_to_recordset($2::jsonb) AS v(ingredient_name text, nutrition_food_id text)
       JOIN nutrition_foods nf ON nf.id = v.nutrition_food_id
       ON CONFLICT (instance_id, ingredient_name) DO UPDATE SET
         tbsp_to_g = EXCLUDED.tbsp_to_g,
         tsp_to_g = EXCLUDED.tsp_to_g,
         oz_to_g = EXCLUDED.oz_to_g,
         cup_to_g = EXCLUDED.cup_to_g,
         fl_oz_to_ml = EXCLUDED.fl_oz_to_ml,
         fl_oz_to_l = EXCLUDED.fl_oz_to_l,
         ml_to_pint = EXCLUDED.ml_to_pint,
         ml_to_quart = EXCLUDED.ml_to_quart,
         ml_to_gallon = EXCLUDED.ml_to_gallon,
         l_to_pint = EXCLUDED.l_to_pint,
         l_to_quart = EXCLUDED.l_to_quart,
         l_to_gallon = EXCLUDED.l_to_gallon,
         updated_at = NOW()`,
      [instanceId, JSON.stringify(convJson)]
    );
  }
}

recipes.get('/public/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const recipeResult = await query(
      'SELECT * FROM recipes WHERE public_slug = $1 AND is_public = TRUE',
      [slug]
    );
    if (recipeResult.rows.length === 0) {
      return c.json({ error: 'Recipe not found' }, 404);
    }
    const recipe = recipeResult.rows[0];

    const [tagsResult, equipmentResult, ingredientsResult] = await Promise.all([
      query(
        `SELECT t.* FROM tags t
         INNER JOIN recipe_tags rt ON rt.tag_id = t.id
         WHERE rt.recipe_id = $1`,
        [recipe.id]
      ),
      query(
        'SELECT * FROM recipe_equipment WHERE recipe_id = $1 ORDER BY order_index',
        [recipe.id]
      ),
      query(
        'SELECT * FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY order_index',
        [recipe.id]
      ),
    ]);

    const sectionsResult = await query(
      `SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', st.id, 'order_index', st.order_index, 'instruction', st.instruction,
              'image_url', st.image_url, 'timer_minutes', st.timer_minutes
            )
            ORDER BY st.order_index
          ) FILTER (WHERE st.id IS NOT NULL),
          '[]'::json
        ) as steps
      FROM recipe_sections s
      LEFT JOIN recipe_steps st ON st.section_id = s.id
      WHERE s.recipe_id = $1
      GROUP BY s.id
      ORDER BY s.order_index`,
      [recipe.id]
    );

    const instanceNameResult = recipe.instance_id
      ? await query('SELECT name FROM instances WHERE id = $1', [recipe.instance_id])
      : { rows: [{ name: null }] };

    return c.json({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image_url: recipe.image_url,
      servings: recipe.servings,
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes,
      wait_time_minutes: recipe.wait_time_minutes,
      notes: recipe.notes,
      created_at: recipe.created_at,
      instance_name: instanceNameResult.rows[0]?.name ?? null,
      tags: tagsResult.rows,
      equipment: equipmentResult.rows,
      ingredients: ingredientsResult.rows,
      sections: sectionsResult.rows,
    });
  } catch (err) {
    console.error('Get public recipe error:', err);
    return c.json({ error: 'Failed to fetch public recipe' }, 500);
  }
});

const protect = new Hono<{ Variables: AuthVariables }>();
protect.use('*', requireAuth, requireResourceScope('recipes'));

protect.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);

    if (!(await canAccessInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const folder_id = c.req.query('folder_id');
    const tag_id = c.req.query('tag_id');

    if (tag_id) {
      const params: unknown[] = [instance_id, tag_id];
      let sql = `SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', t.name, 'instance_id', t.instance_id, 'created_at', t.created_at)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) as tags
      FROM recipes r
      INNER JOIN recipe_tags rt ON rt.recipe_id = r.id
      INNER JOIN tags t ON t.id = rt.tag_id
      WHERE r.instance_id = $1 AND rt.tag_id = $2`;

      if (folder_id) {
        params.push(folder_id);
        sql += ` AND r.folder_id = $${params.length}`;
      }

      sql += ` GROUP BY r.id ORDER BY r.created_at DESC`;

      const result = await query(sql, params);
      const rows = result.rows.map((row: Record<string, unknown>) => ({
        ...row,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : row.tags,
      }));
      return c.json(rows);
    }

    const params: unknown[] = [instance_id];
    let sql = `SELECT r.*,
      COALESCE(
        json_agg(
          json_build_object('id', t.id, 'name', t.name, 'instance_id', t.instance_id, 'created_at', t.created_at)
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'::json
      ) as tags
    FROM recipes r
    LEFT JOIN recipe_tags rt ON rt.recipe_id = r.id
    LEFT JOIN tags t ON t.id = rt.tag_id
    WHERE r.instance_id = $1`;

    if (folder_id) {
      params.push(folder_id);
      sql += ` AND r.folder_id = $${params.length}`;
    }

    sql += ` GROUP BY r.id ORDER BY r.created_at DESC`;

    const result = await query(sql, params);
    const rows = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : row.tags,
    }));
    return c.json(rows);
  } catch (err) {
    console.error('Get recipes error:', err);
    return c.json({ error: 'Failed to fetch recipes' }, 500);
  }
});

protect.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const recipeResult = await query('SELECT * FROM recipes WHERE id = $1', [id]);
    if (recipeResult.rows.length === 0) {
      return c.json({ error: 'Recipe not found' }, 404);
    }
    const recipe = recipeResult.rows[0];

    if (!(await canAccessInstance(c.get('userId'), recipe.instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this recipe\'s instance' }, 403);
    }

    const [tagsResult, equipmentResult, ingredientsResult] = await Promise.all([
      query(
        `SELECT t.* FROM tags t
         INNER JOIN recipe_tags rt ON rt.tag_id = t.id
         WHERE rt.recipe_id = $1`,
        [id]
      ),
      query(
        `SELECT re.*, e.location AS equipment_location
         FROM recipe_equipment re
         LEFT JOIN equipment e ON e.id = re.equipment_id
         WHERE re.recipe_id = $1
         ORDER BY re.order_index`,
        [id]
      ),
      query(
        'SELECT * FROM recipe_ingredients WHERE recipe_id = $1 ORDER BY order_index',
        [id]
      ),
    ]);

    const sectionsResult = await query(
      `SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', st.id, 'order_index', st.order_index, 'instruction', st.instruction,
              'image_url', st.image_url, 'timer_minutes', st.timer_minutes
            )
            ORDER BY st.order_index
          ) FILTER (WHERE st.id IS NOT NULL),
          '[]'::json
        ) as steps
      FROM recipe_sections s
      LEFT JOIN recipe_steps st ON st.section_id = s.id
      WHERE s.recipe_id = $1
      GROUP BY s.id
      ORDER BY s.order_index`,
      [id]
    );

    const standaloneStepsResult = await query(
      'SELECT * FROM recipe_steps WHERE recipe_id = $1 AND section_id IS NULL ORDER BY order_index',
      [id]
    );

    let pantryItemsResult: { rows: Record<string, unknown>[] } = { rows: [] };
    if (recipe.instance_id) {
      pantryItemsResult = await query(
        'SELECT ingredient_name, location FROM pantry_items WHERE instance_id = $1',
        [recipe.instance_id]
      );
    }

    let sourceUserDisplayName = null;
    if (recipe.imported_from_user_id) {
      const userResult = await query(
        'SELECT display_name FROM profiles WHERE id = $1',
        [recipe.imported_from_user_id]
      );
      sourceUserDisplayName = userResult.rows[0]?.display_name || null;
    }

    let sourceInstanceName = null;
    if (recipe.imported_from_instance_id) {
      const instResult = await query(
        'SELECT name FROM instances WHERE id = $1',
        [recipe.imported_from_instance_id]
      );
      sourceInstanceName = instResult.rows[0]?.name || null;
    }

    const locationMap = new Map<string, string | null>();
    for (const p of pantryItemsResult.rows) {
      locationMap.set((p.ingredient_name as string).toLowerCase(), p.location as string | null);
    }

    const ingredients = ingredientsResult.rows.map((ing: Record<string, unknown>) => ({
      ...ing,
      location: locationMap.get((ing.name as string).toLowerCase()) || null,
    }));

    const sections = sectionsResult.rows.map((s: Record<string, unknown>) => ({
      ...s,
      steps: typeof s.steps === 'string' ? JSON.parse(s.steps as string) : s.steps,
    }));

    return c.json({
      ...recipe,
      tags: tagsResult.rows,
      equipment: equipmentResult.rows,
      ingredients,
      sections,
      steps: standaloneStepsResult.rows,
      sourceUserDisplayName,
      sourceInstanceName,
    });
  } catch (err) {
    console.error('Get recipe error:', err);
    return c.json({ error: 'Failed to fetch recipe' }, 500);
  }
});

protect.post('/', zValidator('json', createRecipeSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const userId = c.get('userId');

    if (!(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const recipeResult = await query(
      `INSERT INTO recipes (title, description, image_url, folder_id, owner_id, instance_id,
        prep_time_minutes, cook_time_minutes, servings, notes, is_public, grid_recipe,
        imported_from_recipe_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, $12)
      RETURNING *`,
      [
        data.title, data.description || null, data.image_url || null,
        data.folder_id || null, userId, data.instance_id,
        data.prep_time_minutes || null, data.cook_time_minutes || null,
        data.servings ?? 1, data.notes || null,
        data.grid_recipe ? JSON.stringify(data.grid_recipe) : null,
        data.imported_from_recipe_id || null,
      ]
    );
    const recipeId = recipeResult.rows[0].id;

    if (data.tags) {
      await batchUpsertTags(recipeId, data.instance_id, data.tags);
    }

    if (data.equipment) {
      await batchUpsertEquipment(recipeId, data.instance_id, data.equipment);
    }

    if (data.ingredients) {
      await batchInsertIngredients(recipeId, data.instance_id, data.ingredients, data.title, userId);
    }

    if (data.sections) {
      for (const section of data.sections) {
        const secResult = await query(
          'INSERT INTO recipe_sections (recipe_id, title, order_index) VALUES ($1, $2, $3) RETURNING *',
          [recipeId, section.title, section.order_index]
        );
        const steps = section.steps || [];
        for (const step of steps) {
          await query(
            'INSERT INTO recipe_steps (recipe_id, section_id, order_index, instruction, image_url, timer_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [recipeId, secResult.rows[0].id, step.order_index, step.instruction, step.image_url || null, step.timer_minutes || null]
          );
        }
      }
    }

    return c.json(recipeResult.rows[0], 201);
  } catch (err) {
    console.error('Create recipe error:', err);
    return c.json({ error: 'Failed to create recipe' }, 500);
  }
});

protect.put('/:id', zValidator('json', updateRecipeSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM recipes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    if (!(await canEditInstance(c.get('userId'), existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // The recipe's instance is the only legitimate target for all side-effect
    // writes below (tags/equipment/ingredients/folders). Any client-supplied
    // instance_id is ignored — a caller who may edit this recipe must never be
    // able to plant rows into another instance.
    const instanceId = existing.rows[0].instance_id;

    if (data.folder_id !== undefined && data.folder_id !== null) {
      const folderCheck = await query(
        'SELECT 1 FROM folders WHERE id = $1 AND instance_id = $2',
        [data.folder_id, instanceId]
      );
      if (folderCheck.rows.length === 0) {
        return c.json({ error: 'Folder not found in this instance' }, 400);
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.image_url !== undefined) { fields.push(`image_url = $${idx++}`); values.push(data.image_url); }
    if (data.folder_id !== undefined) { fields.push(`folder_id = $${idx++}`); values.push(data.folder_id); }
    if (data.prep_time_minutes !== undefined) { fields.push(`prep_time_minutes = $${idx++}`); values.push(data.prep_time_minutes); }
    if (data.cook_time_minutes !== undefined) { fields.push(`cook_time_minutes = $${idx++}`); values.push(data.cook_time_minutes); }
    if (data.servings !== undefined) { fields.push(`servings = $${idx++}`); values.push(data.servings); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
    if (data.grid_recipe !== undefined) {
      fields.push(`grid_recipe = $${idx++}`);
      values.push(data.grid_recipe ? JSON.stringify(data.grid_recipe) : null);
    }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      values.push(id);

      await query(
        `UPDATE recipes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
    }

    if (data.tags !== undefined) {
      await query('DELETE FROM recipe_tags WHERE recipe_id = $1', [id]);
      await batchUpsertTags(id, instanceId, data.tags);
    }

    if (data.equipment !== undefined) {
      await query('DELETE FROM recipe_equipment WHERE recipe_id = $1', [id]);
      await batchUpsertEquipment(id, instanceId, data.equipment);
    }

    if (data.ingredients !== undefined) {
      await query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
      // instanceId bound to the recipe's own instance above
      const recipeTitle = data.title || existing.rows[0].title;
      await batchInsertIngredients(id, instanceId, data.ingredients, recipeTitle, userId);
    }

    if (data.sections !== undefined) {
      await query('DELETE FROM recipe_steps WHERE recipe_id = $1', [id]);
      await query('DELETE FROM recipe_sections WHERE recipe_id = $1', [id]);
      for (const section of data.sections) {
        const secResult = await query(
          'INSERT INTO recipe_sections (recipe_id, title, order_index) VALUES ($1, $2, $3) RETURNING *',
          [id, section.title, section.order_index]
        );
        const steps = section.steps || [];
        for (const step of steps) {
          await query(
            'INSERT INTO recipe_steps (recipe_id, section_id, order_index, instruction, image_url, timer_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, secResult.rows[0].id, step.order_index, step.instruction, step.image_url || null, step.timer_minutes || null]
          );
        }
      }
    }

    const updated = await query('SELECT * FROM recipes WHERE id = $1', [id]);
    return c.json(updated.rows[0]);
  } catch (err) {
    console.error('Update recipe error:', err);
    return c.json({ error: 'Failed to update recipe' }, 500);
  }
});

protect.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await query('SELECT * FROM recipes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    if (!(await canEditInstance(c.get('userId'), existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    await query('DELETE FROM public_recipes WHERE recipe_id = $1', [id]);
    const stepsResult = await query('DELETE FROM recipe_steps WHERE recipe_id = $1 RETURNING id', [id]);
    const sectionsResult = await query('DELETE FROM recipe_sections WHERE recipe_id = $1 RETURNING id', [id]);
    await query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
    await query('DELETE FROM recipe_equipment WHERE recipe_id = $1', [id]);
    await query('DELETE FROM recipe_tags WHERE recipe_id = $1', [id]);
    const result = await query('DELETE FROM recipes WHERE id = $1 RETURNING *', [id]);

    return c.json({ message: 'Recipe deleted' });
  } catch (err) {
    console.error('Delete recipe error:', err);
    return c.json({ error: 'Failed to delete recipe' }, 500);
  }
});

protect.put('/:id/public', zValidator('json', publicToggleSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const { is_public } = c.req.valid('json');

    const existing = await query('SELECT * FROM recipes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    if (!(await canEditInstance(c.get('userId'), existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    let publicSlug = existing.rows[0].public_slug;

    if (is_public) {
      if (!publicSlug) {
        publicSlug = crypto.randomUUID();
      }

      await query(
        'UPDATE recipes SET is_public = TRUE, public_slug = $1, updated_at = NOW() WHERE id = $2',
        [publicSlug, id]
      );

      const recipe = (await query('SELECT * FROM recipes WHERE id = $1', [id])).rows[0];

      const ingredientsJson = (await query(
        `SELECT COALESCE(json_agg(
          json_build_object(
            'id', ri.id, 'name', ri.name, 'preparation', ri.preparation,
            'quantity', ri.quantity, 'unit', ri.unit, 'is_optional', ri.is_optional,
            'order_index', ri.order_index, 'substitutions', ri.substitutions,
            'notes', ri.notes, 'prep_style', ri.prep_style, 'nutrition_food_id', ri.nutrition_food_id
          ) ORDER BY ri.order_index
        ), '[]'::json) FROM recipe_ingredients ri WHERE ri.recipe_id = $1`,
        [id]
      )).rows[0].coalesce;

      const sectionsJson = (await query(
        `SELECT COALESCE(json_agg(
          json_build_object(
            'id', s.id, 'title', s.title, 'order_index', s.order_index,
            'steps', (SELECT COALESCE(json_agg(
              json_build_object(
                'id', st.id, 'order_index', st.order_index, 'instruction', st.instruction,
                'image_url', st.image_url, 'timer_minutes', st.timer_minutes
              ) ORDER BY st.order_index
            ), '[]'::json) FROM recipe_steps st WHERE st.section_id = s.id)
          ) ORDER BY s.order_index
        ), '[]'::json) FROM recipe_sections s WHERE s.recipe_id = $1`,
        [id]
      )).rows[0].coalesce;

      const equipmentJson = (await query(
        `SELECT COALESCE(json_agg(
          json_build_object(
            'id', re.id, 'equipment_id', re.equipment_id,
            'equipment_name', re.equipment_name, 'order_index', re.order_index
          ) ORDER BY re.order_index
        ), '[]'::json) FROM recipe_equipment re WHERE re.recipe_id = $1`,
        [id]
      )).rows[0].coalesce;

      const tagsJson = (await query(
        `SELECT COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name)
        ), '[]'::json)
        FROM recipe_tags rt
        JOIN tags t ON t.id = rt.tag_id
        WHERE rt.recipe_id = $1`,
        [id]
      )).rows[0].coalesce;

      await query(
        `INSERT INTO public_recipes (recipe_id, title, description, image_url, servings,
          prep_time_minutes, cook_time_minutes, notes, is_public, public_slug,
          owner_id, instance_id, ingredients, sections, equipment, tags, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (recipe_id) DO UPDATE SET
          title = EXCLUDED.title, description = EXCLUDED.description,
          image_url = EXCLUDED.image_url, servings = EXCLUDED.servings,
          prep_time_minutes = EXCLUDED.prep_time_minutes,
          cook_time_minutes = EXCLUDED.cook_time_minutes,
          notes = EXCLUDED.notes, is_public = EXCLUDED.is_public,
          public_slug = EXCLUDED.public_slug,
          ingredients = EXCLUDED.ingredients, sections = EXCLUDED.sections,
          equipment = EXCLUDED.equipment, tags = EXCLUDED.tags`,
        [
          id, recipe.title, recipe.description, recipe.image_url, recipe.servings,
          recipe.prep_time_minutes, recipe.cook_time_minutes, recipe.notes,
          true, publicSlug, recipe.owner_id, recipe.instance_id,
          JSON.stringify(ingredientsJson), JSON.stringify(sectionsJson),
          JSON.stringify(equipmentJson), JSON.stringify(tagsJson), recipe.created_at,
        ]
      );
    } else {
      await query(
        'UPDATE recipes SET is_public = FALSE, updated_at = NOW() WHERE id = $1',
        [id]
      );
      await query('DELETE FROM public_recipes WHERE recipe_id = $1', [id]);
      publicSlug = null;
    }

    return c.json({ publicSlug });
  } catch (err) {
    console.error('Toggle public recipe error:', err);
    return c.json({ error: 'Failed to toggle recipe public status' }, 500);
  }
});

const servingsUpdateSchema = z.object({
  servings: z.number().int().min(1),
});

// Set the recipe's default servings and rescale every ingredient quantity so
// the stored amounts stay proportional to the new default (factor = new/old).
protect.put('/:id/servings', zValidator('json', servingsUpdateSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const existing = await query('SELECT id, servings, instance_id FROM recipes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Recipe not found' }, 404);
    }

    if (!(await canEditInstance(userId, existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const currentServings = Number(existing.rows[0].servings) || 1;
    if (data.servings === currentServings) {
      return c.json(existing.rows[0]);
    }

    const factor = data.servings / currentServings;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE recipe_ingredients SET quantity = ROUND(quantity * $1, 4) WHERE recipe_id = $2',
        [factor, id]
      );
      const result = await client.query(
        'UPDATE recipes SET servings = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [data.servings, id]
      );
      await client.query('COMMIT');
      return c.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update recipe servings error:', err);
    return c.json({ error: 'Failed to update recipe servings' }, 500);
  }
});

recipes.route('/', protect);

export { recipes };
