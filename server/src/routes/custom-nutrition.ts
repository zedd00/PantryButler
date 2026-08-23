import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canEditInstance } from '../utils/membership';

const customNutrition = new Hono<{ Variables: AuthVariables }>();

customNutrition.use('*', requireAuth, requireResourceScope('nutrition'));

const createCustomNutritionSchema = z.object({
  instance_id: z.string().uuid(),
  ingredient_name: z.string().min(1),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().optional(),
  sugar_g: z.number().optional(),
  sodium_mg: z.number().optional(),
  cholesterol_mg: z.number().optional(),
  serving_size: z.string().optional(),
  serving_unit: z.string().optional(),
});

customNutrition.post('/', zValidator('json', createCustomNutritionSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query(
      `INSERT INTO custom_nutrition (
        user_id, instance_id, ingredient_name, calories, protein_g, carbs_g, fat_g,
        fiber_g, sugar_g, sodium_mg, cholesterol_mg, serving_size, serving_unit
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        userId, data.instance_id, data.ingredient_name,
        data.calories, data.protein_g, data.carbs_g, data.fat_g,
        // All columns are NOT NULL; default omitted optional fields instead of
        // inserting NULL (which would violate the schema and 500).
        data.fiber_g ?? 0, data.sugar_g ?? 0, data.sodium_mg ?? 0, data.cholesterol_mg ?? 0,
        data.serving_size ?? '100', data.serving_unit ?? 'g',
      ]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create custom nutrition error:', err);
    return c.json({ error: 'Failed to create custom nutrition entry' }, 500);
  }
});

export { customNutrition };
