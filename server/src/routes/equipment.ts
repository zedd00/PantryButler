import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const equipment = new Hono<{ Variables: AuthVariables }>();

equipment.use('*', requireAuth, requireResourceScope('recipes'));

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().nullable().optional(),
  instance_id: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
});

equipment.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);

    if (!(await canAccessInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM equipment WHERE instance_id = $1 ORDER BY name',
      [instance_id]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get equipment error:', err);
    return c.json({ error: 'Failed to fetch equipment' }, 500);
  }
});

equipment.post('/', zValidator('json', createSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    if (!(await canEditInstance(c.get('userId'), data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query(
      'INSERT INTO equipment (name, location, instance_id) VALUES ($1, $2, $3) RETURNING *',
      [data.name, data.location || null, data.instance_id]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create equipment error:', err);
    return c.json({ error: 'Failed to create equipment' }, 500);
  }
});

equipment.put('/:id', zValidator('json', updateSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const existing = await query('SELECT instance_id FROM equipment WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Equipment not found' }, 404);
    if (!(await canEditInstance(c.get('userId'), existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.location !== undefined) { fields.push(`location = $${idx++}`); values.push(data.location); }

    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

    values.push(id);
    const result = await query(
      `UPDATE equipment SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return c.json({ error: 'Equipment not found' }, 404);
    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update equipment error:', err);
    return c.json({ error: 'Failed to update equipment' }, 500);
  }
});

equipment.get('/:id/usage', async (c) => {
  try {
    const id = c.req.param('id');

    const itemResult = await query('SELECT name, instance_id FROM equipment WHERE id = $1', [id]);
    if (itemResult.rows.length === 0) return c.json({ isUsed: false, recipes: [] });

    if (!(await canAccessInstance(c.get('userId'), itemResult.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const equipmentName = itemResult.rows[0].name;
    const equipmentInstanceId = itemResult.rows[0].instance_id;

    const usageResult = await query(
      `SELECT DISTINCT r.id, r.title FROM recipe_equipment re
       JOIN recipes r ON r.id = re.recipe_id
       WHERE re.equipment_name ILIKE $1 AND r.instance_id = $2`,
      [equipmentName, equipmentInstanceId]
    );

    return c.json({
      isUsed: usageResult.rows.length > 0,
      recipes: usageResult.rows,
    });
  } catch (err) {
    console.error('Check equipment usage error:', err);
    return c.json({ error: 'Failed to check usage' }, 500);
  }
});

equipment.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await query('SELECT instance_id FROM equipment WHERE id = $1', [id]);
    if (existing.rows.length === 0) return c.json({ error: 'Equipment not found' }, 404);
    if (!(await canEditInstance(c.get('userId'), existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query('DELETE FROM equipment WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return c.json({ error: 'Equipment not found' }, 404);
    return c.json({ message: 'Equipment deleted' });
  } catch (err) {
    console.error('Delete equipment error:', err);
    return c.json({ error: 'Failed to delete equipment' }, 500);
  }
});

export { equipment };
