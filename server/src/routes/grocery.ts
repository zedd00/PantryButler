import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const grocery = new Hono<{ Variables: AuthVariables }>();

grocery.use('*', requireAuth, requireResourceScope('grocery'));

// --- Grocery List Recipes ---

grocery.get('/recipes', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    const userId = c.get('userId');

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM grocery_list_recipes WHERE user_id = $1 AND instance_id = $2 ORDER BY added_at DESC',
      [userId, instance_id]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get grocery list recipes error:', err);
    return c.json({ error: 'Failed to fetch grocery list' }, 500);
  }
});

const addRecipeSchema = z.object({
  instance_id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  servings: z.number().int().min(1).optional(),
});

grocery.post('/recipes', zValidator('json', addRecipeSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const recipe = await query(
      'SELECT id FROM recipes WHERE id = $1 AND instance_id = $2',
      [data.recipe_id, data.instance_id]
    );
    if (recipe.rows.length === 0) {
      return c.json({ error: 'Recipe not found in this instance' }, 404);
    }

    const result = await query(
      'INSERT INTO grocery_list_recipes (user_id, recipe_id, instance_id, servings) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, data.recipe_id, data.instance_id, data.servings ?? null]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Add recipe to grocery list error:', err);
    return c.json({ error: 'Failed to add recipe to grocery list' }, 500);
  }
});

grocery.delete('/recipes/:recipeId', async (c) => {
  try {
    const userId = c.get('userId');
    const recipeId = c.req.param('recipeId');

    const result = await query(
      'DELETE FROM grocery_list_recipes WHERE user_id = $1 AND recipe_id = $2 RETURNING *',
      [userId, recipeId]
    );

    if (result.rows.length === 0) return c.json({ error: 'Recipe not in grocery list' }, 404);
    return c.json({ message: 'Recipe removed from grocery list' });
  } catch (err) {
    console.error('Remove recipe from grocery list error:', err);
    return c.json({ error: 'Failed to remove recipe from grocery list' }, 500);
  }
});

grocery.delete('/recipes', async (c) => {
  try {
    const userId = c.get('userId');
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);

    if (!(await canEditInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    await query(
      'DELETE FROM grocery_list_recipes WHERE user_id = $1 AND instance_id = $2',
      [userId, instance_id]
    );

    return c.json({ message: 'Grocery list cleared' });
  } catch (err) {
    console.error('Clear grocery list error:', err);
    return c.json({ error: 'Failed to clear grocery list' }, 500);
  }
});

// --- Custom Grocery Items ---

grocery.get('/custom', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    const userId = c.get('userId');

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM custom_grocery_items WHERE created_by = $1 AND instance_id = $2 ORDER BY created_at DESC',
      [userId, instance_id]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get custom grocery items error:', err);
    return c.json({ error: 'Failed to fetch custom grocery items' }, 500);
  }
});

const addCustomSchema = z.object({
  instance_id: z.string().uuid(),
  name: z.string().min(1),
  quantity: z.number(),
  unit: z.string(),
});

grocery.post('/custom', zValidator('json', addCustomSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query(
      'INSERT INTO custom_grocery_items (created_by, instance_id, item_name, quantity, unit) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, data.instance_id, data.name, data.quantity, data.unit]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Add custom grocery item error:', err);
    return c.json({ error: 'Failed to add custom grocery item' }, 500);
  }
});

const updateCustomSchema = z.object({
  is_purchased: z.boolean().optional(),
  name: z.string().min(1).optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
});

grocery.put('/custom/:id', zValidator('json', updateCustomSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM custom_grocery_items WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Custom grocery item not found' }, 404);
    const item = existing.rows[0];
    if (item.created_by !== userId || !(await canEditInstance(userId, item.instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      `UPDATE custom_grocery_items
       SET is_purchased = COALESCE($2, is_purchased),
           item_name = COALESCE($3, item_name),
           quantity = COALESCE($4, quantity),
           unit = COALESCE($5, unit)
       WHERE id = $1
       RETURNING *`,
      [id, data.is_purchased ?? null, data.name ?? null, data.quantity ?? null, data.unit ?? null]
    );

    if (result.rows.length === 0) return c.json({ error: 'Custom grocery item not found' }, 404);
    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update custom grocery item error:', err);
    return c.json({ error: 'Failed to update custom grocery item' }, 500);
  }
});

grocery.delete('/custom/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM custom_grocery_items WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Custom grocery item not found' }, 404);
    const item = existing.rows[0];
    if (item.created_by !== userId || !(await canEditInstance(userId, item.instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query('DELETE FROM custom_grocery_items WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return c.json({ error: 'Custom grocery item not found' }, 404);
    return c.json({ message: 'Custom grocery item deleted' });
  } catch (err) {
    console.error('Delete custom grocery item error:', err);
    return c.json({ error: 'Failed to delete custom grocery item' }, 500);
  }
});

grocery.delete('/custom', async (c) => {
  try {
    const userId = c.get('userId');
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);

    if (!(await canEditInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    await query(
      'DELETE FROM custom_grocery_items WHERE created_by = $1 AND instance_id = $2',
      [userId, instance_id]
    );

    return c.json({ message: 'Custom grocery items cleared' });
  } catch (err) {
    console.error('Clear custom grocery items error:', err);
    return c.json({ error: 'Failed to clear custom grocery items' }, 500);
  }
});

// --- Consolidation ---

const consolidateSchema = z.object({
  instance_id: z.string().uuid(),
});

// Canonicalize unit spellings so "tsp"/"teaspoons", "cup"/"cups", etc.
// consolidate into a single line instead of showing as duplicates.
function normalizeUnit(unit: string): string {
  const u = (unit || '').toLowerCase().trim();
  if (['tsp', 'teaspoon', 'teaspoons'].includes(u)) return 'tsp';
  if (['tbsp', 'tablespoon', 'tablespoons', 'tbs'].includes(u)) return 'tbsp';
  if (['cup', 'cups', 'c'].includes(u)) return 'cup';
  if (['fl oz', 'fluid ounce', 'fluid ounces', 'fl. oz.'].includes(u)) return 'fl oz';
  if (['oz', 'ounce', 'ounces'].includes(u)) return 'oz';
  if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) return 'lb';
  if (['g', 'gram', 'grams'].includes(u)) return 'g';
  if (['mg', 'milligram', 'milligrams'].includes(u)) return 'mg';
  if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(u)) return 'ml';
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(u)) return 'L';
  if (['pint', 'pints', 'pt'].includes(u)) return 'pint';
  if (['quart', 'quarts', 'qt'].includes(u)) return 'quart';
  if (['gallon', 'gallons', 'gal'].includes(u)) return 'gallon';
  return u;
}

grocery.post('/consolidate', zValidator('json', consolidateSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canAccessInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const groceryResult = await query(
      'SELECT recipe_id, servings FROM grocery_list_recipes WHERE user_id = $1 AND instance_id = $2',
      [userId, data.instance_id]
    );

    const groceryRows = groceryResult.rows;
    if (groceryRows.length === 0) return c.json([]);

    const recipeIds = groceryRows.map(r => r.recipe_id);

    const recipesResult = await query(
      'SELECT id, servings FROM recipes WHERE id = ANY($1::uuid[])',
      [recipeIds]
    );
    const recipeServings = new Map(recipesResult.rows.map(r => [r.id, Number(r.servings) || 1]));
    // Servings each recipe was added to the list for (NULL → its own default).
    const groceryServings = new Map(groceryRows.map(r => [r.recipe_id, r.servings ?? null]));

    const ingredientsResult = await query(
      'SELECT * FROM recipe_ingredients WHERE recipe_id = ANY($1::uuid[])',
      [recipeIds]
    );

    const consolidated = new Map<string, { name: string; quantity: number; unit: string; is_substitution: boolean; original_ingredients: any[] }>();

    for (const ing of ingredientsResult.rows) {
      const unit = normalizeUnit(ing.unit);
      const key = `${String(ing.name).toLowerCase().trim()}_${unit}`;
      const baseServings = recipeServings.get(ing.recipe_id) || 1;
      const storedServings = groceryServings.get(ing.recipe_id);
      const scale = (storedServings ?? baseServings) / baseServings;
      const quantity = Math.round(Number(ing.quantity) * scale * 10000) / 10000;
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.quantity += quantity;
        existing.original_ingredients.push(ing);
      } else {
        consolidated.set(key, {
          name: ing.name,
          quantity,
          unit,
          is_substitution: false,
          original_ingredients: [ing],
        });
      }
    }

    return c.json(Array.from(consolidated.values()));
  } catch (err) {
    console.error('Consolidate grocery list error:', err);
    return c.json({ error: 'Failed to consolidate grocery list' }, 500);
  }
});

export { grocery };
