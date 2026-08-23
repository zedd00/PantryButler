import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const folders = new Hono<{ Variables: AuthVariables }>();

folders.use('*', requireAuth, requireResourceScope('recipes'));

const createFolderSchema = z.object({
  name: z.string().min(1),
  owner_id: z.string().uuid().optional(),
  instance_id: z.string().uuid(),
  parent_folder_id: z.string().uuid().nullable().optional(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1),
});

folders.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM folders WHERE instance_id = $1 ORDER BY name',
      [instance_id]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get folders error:', err);
    return c.json({ error: 'Failed to fetch folders' }, 500);
  }
});

folders.post('/', zValidator('json', createFolderSchema), async (c) => {
  try {
    const { name, owner_id, instance_id, parent_folder_id } = c.req.valid('json');
    const userId = c.get('userId');

    if (!(await canEditInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // Never trust a client-supplied owner_id; folders belong to the caller.
    const result = await query(
      'INSERT INTO folders (name, owner_id, instance_id, parent_folder_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, userId, instance_id, parent_folder_id || null]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create folder error:', err);
    return c.json({ error: 'Failed to create folder' }, 500);
  }
});

folders.put('/:id', zValidator('json', updateFolderSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const { name } = c.req.valid('json');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM folders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    if (!(await canEditInstance(userId, existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query(
      'UPDATE folders SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Folder not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update folder error:', err);
    return c.json({ error: 'Failed to update folder' }, 500);
  }
});

folders.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const existing = await query('SELECT * FROM folders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    if (!(await canEditInstance(userId, existing.rows[0].instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    await query('UPDATE recipes SET folder_id = NULL WHERE folder_id = $1', [id]);

    const result = await query('DELETE FROM folders WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Folder not found' }, 404);
    }

    return c.json({ message: 'Folder deleted' });
  } catch (err) {
    console.error('Delete folder error:', err);
    return c.json({ error: 'Failed to delete folder' }, 500);
  }
});

export { folders };
