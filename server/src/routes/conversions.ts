import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const conversions = new Hono<{ Variables: AuthVariables }>();

conversions.use('*', requireAuth, requireResourceScope('pantry'));

const createSchema = z.object({
  ingredient_name: z.string().min(1),
  instance_id: z.string().uuid(),
  tbsp_to_g: z.number().nullable().optional(),
  tsp_to_g: z.number().nullable().optional(),
  oz_to_g: z.number().nullable().optional(),
  cup_to_g: z.number().nullable().optional(),
  fl_oz_to_ml: z.number().nullable().optional(),
  fl_oz_to_l: z.number().nullable().optional(),
  ml_to_pint: z.number().nullable().optional(),
  ml_to_quart: z.number().nullable().optional(),
  ml_to_gallon: z.number().nullable().optional(),
  l_to_pint: z.number().nullable().optional(),
  l_to_quart: z.number().nullable().optional(),
  l_to_gallon: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

conversions.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    const ingredient_name = c.req.query('ingredient_name');

    if (!instance_id) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    conditions.push(`(instance_id = $${idx} OR instance_id IS NULL)`);
    params.push(instance_id);
    idx++;

    if (ingredient_name) {
      conditions.push(`LOWER(ingredient_name) = LOWER($${idx})`);
      params.push(ingredient_name);
      idx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `SELECT * FROM unit_conversions ${whereClause} ORDER BY ingredient_name`;

    const result = await query(sql, params);
    return c.json(result.rows);
  } catch (err) {
    console.error('Get conversions error:', err);
    return c.json({ error: 'Failed to fetch conversions' }, 500);
  }
});

conversions.post('/', zValidator('json', createSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const { instance_id, ingredient_name, ...conversionFields } = data;

    if (!(await canEditInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query(
      `INSERT INTO unit_conversions (instance_id, ingredient_name, tbsp_to_g, tsp_to_g, oz_to_g, cup_to_g, fl_oz_to_ml, fl_oz_to_l, ml_to_pint, ml_to_quart, ml_to_gallon, l_to_pint, l_to_quart, l_to_gallon, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [
        instance_id,
        ingredient_name,
        conversionFields.tbsp_to_g || null,
        conversionFields.tsp_to_g || null,
        conversionFields.oz_to_g || null,
        conversionFields.cup_to_g || null,
        conversionFields.fl_oz_to_ml || null,
        conversionFields.fl_oz_to_l || null,
        conversionFields.ml_to_pint || null,
        conversionFields.ml_to_quart || null,
        conversionFields.ml_to_gallon || null,
        conversionFields.l_to_pint || null,
        conversionFields.l_to_quart || null,
        conversionFields.l_to_gallon || null,
        conversionFields.notes || null,
      ]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create conversion error:', err);
    return c.json({ error: 'Failed to create conversion' }, 500);
  }
});

export { conversions };
