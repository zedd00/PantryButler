import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { config } from '../utils/config';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance } from '../utils/membership';

const announcements = new Hono<{ Variables: AuthVariables }>();

announcements.use('*', requireAuth, requireResourceScope('settings'));

async function isSuperAdminUser(userId: string): Promise<boolean> {
  const profileResult = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
  return profileResult.rows.length > 0 && profileResult.rows[0].role === 'superadmin';
}

// Announcement creation is available to system superadmins and to admins of
// the instance the announcement belongs to.
async function canManageAnnouncementsInInstance(userId: string, instanceId: string): Promise<boolean> {
  if (await isSuperAdminUser(userId)) {
    return true;
  }

  const memberResult = await query(
    "SELECT 1 FROM instance_members WHERE user_id = $1 AND instance_id = $2 AND role = 'admin' LIMIT 1",
    [userId, instanceId]
  );
  return memberResult.rows.length > 0;
}

// Announcement management (list/edit/delete) is gated behind the
// ENABLE_ADMIN_FEATURES switch and limited to system superadmins.
async function canManageAnnouncements(userId: string): Promise<boolean> {
  return config.enableAdminFeatures && (await isSuperAdminUser(userId));
}

announcements.get('/active-list', async (c) => {
  try {
    const userId = c.get('userId');
    const instanceId = c.req.query('instance_id');
    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(userId, instanceId))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT * FROM announcements WHERE instance_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [instanceId]
    );
    return c.json(result.rows);
  } catch (err) {
    console.error('Get active announcements error:', err);
    return c.json({ error: 'Failed to get active announcements' }, 500);
  }
});

announcements.get('/viewed', async (c) => {
  try {
    const userId = c.get('userId');
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(userId, instanceId))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      'SELECT announcement_id, viewed_at FROM user_announcement_views WHERE user_id = $1 AND instance_id = $2',
      [userId, instanceId]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get viewed announcements error:', err);
    return c.json({ error: 'Failed to get viewed announcements' }, 500);
  }
});

const dismissViewSchema = z.object({
  instance_id: z.string().uuid(),
});

announcements.post('/:id/view', zValidator('json', dismissViewSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const announcementId = c.req.param('id');
    const { instance_id } = c.req.valid('json');

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    // The announcement id must actually belong to the membership-checked
    // instance; otherwise any member could record view rows for announcements
    // of other instances they know the id of.
    const announcementCheck = await query(
      'SELECT 1 FROM announcements WHERE id = $1 AND instance_id = $2',
      [announcementId, instance_id]
    );
    if (announcementCheck.rows.length === 0) {
      return c.json({ error: 'Announcement not found' }, 404);
    }

    await query(
      'INSERT INTO user_announcement_views (user_id, announcement_id, instance_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [userId, announcementId, instance_id]
    );

    return c.json({ message: 'Announcement viewed' });
  } catch (err) {
    console.error('View announcement error:', err);
    return c.json({ error: 'Failed to mark announcement as viewed' }, 500);
  }
});

announcements.get('/has-unseen', async (c) => {
  try {
    const userId = c.get('userId');
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(userId, instanceId))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const activeResult = await query(
      'SELECT id FROM announcements WHERE instance_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
      [instanceId]
    );

    if (activeResult.rows.length === 0) {
      return c.json({ hasUnseen: false });
    }

    const viewResult = await query(
      'SELECT * FROM user_announcement_views WHERE user_id = $1 AND announcement_id = $2 AND instance_id = $3',
      [userId, activeResult.rows[0].id, instanceId]
    );

    return c.json({ hasUnseen: viewResult.rows.length === 0 });
  } catch (err) {
    console.error('Check unseen announcements error:', err);
    return c.json({ error: 'Failed to check unseen announcements' }, 500);
  }
});

announcements.get('/unread-count', async (c) => {
  try {
    const userId = c.get('userId');
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(userId, instanceId))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const activeResult = await query(
      'SELECT id FROM announcements WHERE instance_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [instanceId]
    );

    if (activeResult.rows.length === 0) {
      return c.json({ count: 0 });
    }

    const activeIds = activeResult.rows.map(r => r.id);

    const viewedResult = await query(
      'SELECT announcement_id FROM user_announcement_views WHERE user_id = $1 AND instance_id = $2 AND announcement_id = ANY($3::uuid[])',
      [userId, instanceId, activeIds]
    );

    const viewedIds = new Set(viewedResult.rows.map(r => r.announcement_id));
    const unreadCount = activeIds.filter(id => !viewedIds.has(id)).length;

    return c.json({ count: unreadCount });
  } catch (err) {
    console.error('Get unread count error:', err);
    return c.json({ error: 'Failed to get unread count' }, 500);
  }
});

const createAnnouncementSchema = z.object({
  instance_id: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
});

const updateAnnouncementSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  is_active: z.boolean().optional(),
});

announcements.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canManageAnnouncements(userId))) {
      return c.json({ error: 'Forbidden: superadmin access required' }, 403);
    }

    const result = await query(
      'SELECT * FROM announcements WHERE instance_id = $1 ORDER BY created_at DESC',
      [instanceId]
    );
    return c.json(result.rows);
  } catch (err) {
    console.error('Get announcements error:', err);
    return c.json({ error: 'Failed to get announcements' }, 500);
  }
});

announcements.post('/', zValidator('json', createAnnouncementSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const body = c.req.valid('json');

    if (!(await canManageAnnouncementsInInstance(userId, body.instance_id))) {
      return c.json({ error: 'Forbidden: admin access required' }, 403);
    }

    const result = await query(
      'INSERT INTO announcements (instance_id, title, message, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [body.instance_id, body.title, body.message, userId]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create announcement error:', err);
    return c.json({ error: 'Failed to create announcement' }, 500);
  }
});

announcements.put('/:id', zValidator('json', updateAnnouncementSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    if (!(await canManageAnnouncements(userId))) {
      return c.json({ error: 'Forbidden: superadmin access required' }, 403);
    }

    const existing = await query('SELECT instance_id FROM announcements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Announcement not found' }, 404);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(body.title); }
    if (body.message !== undefined) { fields.push(`message = $${idx++}`); values.push(body.message); }
    if (body.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(body.is_active); }

    if (fields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(id);
    const result = await query(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update announcement error:', err);
    return c.json({ error: 'Failed to update announcement' }, 500);
  }
});

announcements.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const id = c.req.param('id');

    if (!(await canManageAnnouncements(userId))) {
      return c.json({ error: 'Forbidden: superadmin access required' }, 403);
    }

    const existing = await query('SELECT instance_id FROM announcements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Announcement not found' }, 404);
    }

    await query('DELETE FROM announcements WHERE id = $1', [id]);
    return c.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    return c.json({ error: 'Failed to delete announcement' }, 500);
  }
});

export { announcements };
