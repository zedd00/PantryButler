import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';

const userTutorials = new Hono<{ Variables: AuthVariables }>();

userTutorials.use('*', requireAuth, requireResourceScope('profile'));

const createTutorialSchema = z.object({
  user_id: z.string().uuid(),
  tutorial_id: z.string().min(1),
});

userTutorials.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const requestedUserId = c.req.query('user_id');
    if (requestedUserId && requestedUserId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      'SELECT tutorial_id FROM user_tutorials WHERE user_id = $1',
      [requestedUserId || userId]
    );
    return c.json(result.rows);
  } catch (err) {
    console.error('Get user tutorials error:', err);
    return c.json({ error: 'Failed to load tutorials' }, 500);
  }
});

userTutorials.post('/', zValidator('json', createTutorialSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');
    if (data.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      `INSERT INTO user_tutorials (user_id, tutorial_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, tutorial_id) DO NOTHING
       RETURNING *`,
      [userId, data.tutorial_id]
    );

    return c.json(result.rows[0] || { user_id: userId, tutorial_id: data.tutorial_id }, 201);
  } catch (err) {
    console.error('Mark tutorial completed error:', err);
    return c.json({ error: 'Failed to mark tutorial completed' }, 500);
  }
});

userTutorials.delete('/', async (c) => {
  try {
    const userId = c.get('userId');
    const requestedUserId = c.req.query('user_id');
    if (requestedUserId && requestedUserId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const tutorialId = c.req.query('tutorial_id');
    const targetUserId = requestedUserId || userId;

    if (tutorialId) {
      await query(
        'DELETE FROM user_tutorials WHERE user_id = $1 AND tutorial_id = $2',
        [targetUserId, tutorialId]
      );
    } else {
      await query('DELETE FROM user_tutorials WHERE user_id = $1', [targetUserId]);
    }

    return c.json({ message: 'Tutorial state updated' });
  } catch (err) {
    console.error('Reset tutorials error:', err);
    return c.json({ error: 'Failed to reset tutorials' }, 500);
  }
});

export { userTutorials };
