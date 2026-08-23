import { Hono } from 'hono';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance } from '../utils/membership';

const tags = new Hono<{ Variables: AuthVariables }>();

tags.use('*', requireAuth, requireResourceScope('recipes'));

tags.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM tags WHERE instance_id = $1 ORDER BY name',
      [instance_id]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get tags error:', err);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

export { tags };
