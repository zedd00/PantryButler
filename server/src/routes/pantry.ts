import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const pantry = new Hono<{ Variables: AuthVariables }>();

pantry.use('*', requireAuth, requireResourceScope('pantry'));

const createSchema = z.object({
  ingredient_name: z.string().min(1),
  preparation: z.string().nullable().optional(),
  unit: z.string(),
  amount: z.number(),
  price: z.coerce.number().nullable().optional(),
  price_size: z.coerce.number().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  default_display_unit: z.string().nullable().optional(),
  nutrition_food_id: z.string().nullable().optional(),
  is_unlimited: z.boolean().optional(),
  instance_id: z.string().uuid(),
});

const updateSchema = z.object({
  ingredient_name: z.string().min(1).optional(),
  preparation: z.string().nullable().optional(),
  unit: z.string().optional(),
  amount: z.number().optional(),
  price: z.coerce.number().nullable().optional(),
  price_size: z.coerce.number().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  default_display_unit: z.string().nullable().optional(),
  nutrition_food_id: z.string().nullable().optional(),
  is_unlimited: z.boolean().optional(),
});

pantry.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    const userId = c.get('userId');

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM pantry_items WHERE instance_id = $1 AND user_id = $2 ORDER BY ingredient_name',
      [instance_id, userId]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get pantry items error:', err);
    return c.json({ error: 'Failed to fetch pantry items' }, 500);
  }
});

pantry.post('/', zValidator('json', createSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // Merge into an existing pantry entry with the same name rather than
    // creating a duplicate (e.g. repeated "add to pantry" from a grocery list).
    const existing = await query(
      'SELECT * FROM pantry_items WHERE instance_id = $1 AND user_id = $2 AND LOWER(ingredient_name) = LOWER($3) LIMIT 1',
      [data.instance_id, userId, data.ingredient_name]
    );

    if (existing.rows.length > 0) {
      const item = existing.rows[0];
      const incAmount = Number(data.amount) || 0;
      const newAmount = item.is_unlimited ? 0 : (Number(item.amount) || 0) + incAmount;

      const currPrice = item.price === null || item.price === undefined ? 0 : Number(item.price);
      const incPrice = Number(data.price) || 0;
      const newPrice = currPrice + incPrice;
      const hasPrice = newPrice > 0;
      const newPriceSize = hasPrice ? newAmount : (item.price_size ?? null);

      const updated = await query(
        `UPDATE pantry_items
         SET amount = $1, price = $2, price_size = $3, auto_created = FALSE,
             unit = $4, preparation = $5, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [newAmount, hasPrice ? newPrice : null, newPriceSize, data.unit, data.preparation || null, item.id]
      );

      return c.json(updated.rows[0]);
    }

    const result = await query(
      `INSERT INTO pantry_items (ingredient_name, preparation, unit, amount, price, price_size, location, notes, default_display_unit, nutrition_food_id, is_unlimited, instance_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [data.ingredient_name, data.preparation || null, data.unit, data.amount, data.price ?? null, data.price_size ?? null, data.location || null, data.notes || null, data.default_display_unit || null, data.nutrition_food_id || null, data.is_unlimited ?? false, data.instance_id, userId]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create pantry item error:', err);
    return c.json({ error: 'Failed to create pantry item' }, 500);
  }
});

pantry.put('/:id', zValidator('json', updateSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM pantry_items WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Pantry item not found' }, 404);
    const item = existing.rows[0];
    if (item.user_id !== userId || !(await canEditInstance(userId, item.instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.ingredient_name !== undefined) { fields.push(`ingredient_name = $${idx++}`); values.push(data.ingredient_name); }
    if (data.preparation !== undefined) { fields.push(`preparation = $${idx++}`); values.push(data.preparation); }
    if (data.unit !== undefined) { fields.push(`unit = $${idx++}`); values.push(data.unit); }
    if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(data.amount); }
    if (data.price !== undefined) { fields.push(`price = $${idx++}`); values.push(data.price); }
    if (data.price_size !== undefined) { fields.push(`price_size = $${idx++}`); values.push(data.price_size); }
    if (data.location !== undefined) { fields.push(`location = $${idx++}`); values.push(data.location); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
    if (data.default_display_unit !== undefined) { fields.push(`default_display_unit = $${idx++}`); values.push(data.default_display_unit); }
    if (data.nutrition_food_id !== undefined) { fields.push(`nutrition_food_id = $${idx++}`); values.push(data.nutrition_food_id); }
    if (data.is_unlimited !== undefined) { fields.push(`is_unlimited = $${idx++}`); values.push(data.is_unlimited); }

    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

    fields.push(`auto_created = FALSE`);
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE pantry_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return c.json({ error: 'Pantry item not found' }, 404);

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update pantry item error:', err);
    return c.json({ error: 'Failed to update pantry item' }, 500);
  }
});

pantry.get('/:id/usage', async (c) => {
  try {
    const id = c.req.param('id');

    const itemResult = await query('SELECT ingredient_name, instance_id FROM pantry_items WHERE id = $1', [id]);
    if (itemResult.rows.length === 0) return c.json({ isUsed: false, recipes: [] });

    if (!(await canAccessInstance(c.get('userId'), itemResult.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const ingredientName = itemResult.rows[0].ingredient_name;

    const usageResult = await query(
      `SELECT DISTINCT r.id, r.title FROM recipe_ingredients ri
       JOIN recipes r ON r.id = ri.recipe_id
       WHERE ri.name ILIKE $1 AND r.instance_id = $2`,
      [ingredientName, itemResult.rows[0].instance_id]
    );

    return c.json({
      isUsed: usageResult.rows.length > 0,
      recipes: usageResult.rows,
    });
  } catch (err) {
    console.error('Check pantry usage error:', err);
    return c.json({ error: 'Failed to check usage' }, 500);
  }
});

pantry.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM pantry_items WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Pantry item not found' }, 404);
    const item = existing.rows[0];
    if (item.user_id !== userId || !(await canEditInstance(userId, item.instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query('DELETE FROM pantry_items WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return c.json({ error: 'Pantry item not found' }, 404);
    return c.json({ message: 'Pantry item deleted' });
  } catch (err) {
    console.error('Delete pantry item error:', err);
    return c.json({ error: 'Failed to delete pantry item' }, 500);
  }
});

export { pantry };
