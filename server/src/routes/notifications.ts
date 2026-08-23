import { Hono } from 'hono';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance } from '../utils/membership';

const notifications = new Hono<{ Variables: AuthVariables }>();

notifications.use('*', requireAuth, requireResourceScope('profile'));

notifications.get('/', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    const userId = c.get('userId');

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 AND instance_id = $2 ORDER BY created_at DESC LIMIT 50',
      [userId, instance_id]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

notifications.get('/unread-count', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    const userId = c.get('userId');

    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND instance_id = $2 AND is_read = FALSE',
      [userId, instance_id]
    );

    return c.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('Get unread count error:', err);
    return c.json({ error: 'Failed to get unread count' }, 500);
  }
});

notifications.put('/:id/read', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return c.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
});

notifications.put('/read-all', async (c) => {
  try {
    const instance_id = c.req.query('instance_id');
    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);
    const userId = c.get('userId');

    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND instance_id = $2 AND is_read = FALSE',
      [userId, instance_id]
    );

    return c.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return c.json({ error: 'Failed to mark all as read' }, 500);
  }
});

export { notifications };
