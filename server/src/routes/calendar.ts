import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditCalendar } from '../utils/membership';

const calendar = new Hono<{ Variables: AuthVariables }>();

calendar.use('*', requireAuth, requireResourceScope('calendar'));

const createSchema = z.object({
  instance_id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  meal_date: z.string(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  user_id: z.string().uuid().optional(),
});

calendar.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    const start_date = c.req.query('start_date');
    const end_date = c.req.query('end_date');
    const userId = c.get('userId');

    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    if (!start_date || !end_date) return c.json({ error: 'start_date and end_date query parameters are required' }, 400);

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      `SELECT cm.id, cm.user_id, cm.instance_id, cm.recipe_id, cm.meal_date,
              cm.meal_type, cm.is_cooked, cm.created_at AS meal_created_at,
              r.id AS rid, r.title, r.description, r.image_url, r.servings,
              r.created_at AS recipe_created_at, r.updated_at AS recipe_updated_at
       FROM calendar_meals cm
       JOIN recipes r ON r.id = cm.recipe_id
       WHERE cm.user_id = $1 AND cm.instance_id = $2 AND cm.meal_date >= $3 AND cm.meal_date <= $4
       ORDER BY cm.meal_date ASC`,
      [userId, instance_id, start_date, end_date]
    );

    const meals = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      instance_id: row.instance_id,
      recipe_id: row.recipe_id,
      meal_date: row.meal_date,
      meal_type: row.meal_type,
      is_cooked: row.is_cooked,
      created_at: row.meal_created_at,
      recipe: {
        id: row.rid,
        title: row.title,
        description: row.description,
        image_url: row.image_url,
        servings: row.servings,
        created_at: row.recipe_created_at,
        updated_at: row.recipe_updated_at,
      },
    }));

    return c.json(meals);
  } catch (err) {
    console.error('Get calendar meals error:', err);
    return c.json({ error: 'Failed to fetch calendar meals' }, 500);
  }
});

calendar.post('/', zValidator('json', createSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canEditCalendar(userId, data.instance_id))) {
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
      'INSERT INTO calendar_meals (user_id, instance_id, recipe_id, meal_date, meal_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, data.instance_id, data.recipe_id, data.meal_date, data.meal_type]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create calendar meal error:', err);
    return c.json({ error: 'Failed to create calendar meal' }, 500);
  }
});

calendar.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM calendar_meals WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Calendar meal not found' }, 404);
    const meal = existing.rows[0];
    if (meal.user_id !== userId || !(await canEditCalendar(userId, meal.instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query('DELETE FROM calendar_meals WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return c.json({ error: 'Calendar meal not found' }, 404);
    return c.json({ message: 'Calendar meal deleted' });
  } catch (err) {
    console.error('Delete calendar meal error:', err);
    return c.json({ error: 'Failed to delete calendar meal' }, 500);
  }
});

calendar.post('/:id/cook', async (c) => {
  try {
    const mealId = c.req.param('id');
    const userId = c.get('userId');

    const mealResult = await query(
      'SELECT * FROM calendar_meals WHERE id = $1',
      [mealId]
    );
    if (mealResult.rows.length === 0) return c.json({ error: 'Meal not found' }, 404);

    const meal = mealResult.rows[0];
    if (meal.user_id !== userId || !(await canEditCalendar(userId, meal.instance_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const ingredientsResult = await query(
      'SELECT * FROM recipe_ingredients WHERE recipe_id = $1',
      [meal.recipe_id]
    );

    const pantryResult = await query(
      'SELECT * FROM pantry_items WHERE user_id = $1 AND instance_id = $2',
      [userId, meal.instance_id]
    );

    // Compute all pantry deductions in memory, then apply them in a single
    // batched UPDATE (the old code issued one UPDATE per matching ingredient).
    const updates: { id: string; amount: number }[] = [];
    for (const ingredient of ingredientsResult.rows) {
      const pantryItem = pantryResult.rows.find(
        p => p.ingredient_name.toLowerCase() === ingredient.name.toLowerCase()
      );

      if (pantryItem && ingredient.unit && pantryItem.unit && ingredient.unit.toLowerCase() === pantryItem.unit.toLowerCase()) {
        const newAmount = Math.max(0, Number(pantryItem.amount) - Number(ingredient.quantity));
        updates.push({ id: pantryItem.id, amount: newAmount });
      }
    }

    if (updates.length) {
      await query(
        `UPDATE pantry_items p
         SET amount = v.amount, updated_at = NOW()
         FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, amount numeric)
         WHERE p.id = v.id`,
        [JSON.stringify(updates)]
      );
    }

    await query('UPDATE calendar_meals SET is_cooked = TRUE WHERE id = $1', [mealId]);

    return c.json({ message: 'Meal marked as cooked' });
  } catch (err) {
    console.error('Cook meal error:', err);
    return c.json({ error: 'Failed to mark meal as cooked' }, 500);
  }
});

export { calendar };
