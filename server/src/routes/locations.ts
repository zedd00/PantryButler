import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const locations = new Hono<{ Variables: AuthVariables }>();

locations.use('*', requireAuth, requireResourceScope('pantry'));

locations.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);

    if (!(await canAccessInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT location_name FROM custom_locations WHERE instance_id = $1 ORDER BY location_name',
      [instance_id]
    );

    return c.json(result.rows.map(r => r.location_name));
  } catch (err) {
    console.error('Get locations error:', err);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

const addSchema = z.object({
  instance_id: z.string().uuid(),
  location_name: z.string().min(1),
});

locations.post('/', zValidator('json', addSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    if (!(await canEditInstance(c.get('userId'), data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    try {
      await query(
        'INSERT INTO custom_locations (instance_id, location_name) VALUES ($1, $2)',
        [data.instance_id, data.location_name]
      );
    } catch (err: any) {
      if (err.code !== '23505') {
        throw err;
      }
    }

    return c.json({ message: 'Location added' }, 201);
  } catch (err) {
    console.error('Add location error:', err);
    return c.json({ error: 'Failed to add location' }, 500);
  }
});

export { locations };
