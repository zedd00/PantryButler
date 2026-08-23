import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireJwt, type AuthVariables } from '../middleware/auth';

const instanceMembers = new Hono<{ Variables: AuthVariables }>();

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
  instance_id: z.string().uuid(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
});

const updateMemberSchema = z.object({
  instance_id: z.string().uuid(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  can_edit_calendar: z.boolean().optional(),
});

instanceMembers.use('*', requireAuth, requireJwt);

instanceMembers.post('/', zValidator('json', addMemberSchema), async (c) => {
  try {
    const callerId = c.get('userId');
    const { user_id, instance_id, role } = c.req.valid('json');

    const callerMembership = await query(
      'SELECT role FROM instance_members WHERE user_id = $1 AND instance_id = $2',
      [callerId, instance_id]
    );
    if (callerMembership.rows.length === 0 || callerMembership.rows[0].role !== 'admin') {
      return c.json({ error: 'Forbidden: admin access required' }, 403);
    }

    const userResult = await query('SELECT id FROM profiles WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const result = await query(
      `INSERT INTO instance_members (instance_id, user_id, role, can_edit_calendar)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (instance_id, user_id) DO UPDATE SET
         role = EXCLUDED.role,
         can_edit_calendar = EXCLUDED.can_edit_calendar
       RETURNING *`,
      [instance_id, user_id, role || 'user', role === 'viewer' ? false : true]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Add instance member error:', err);
    return c.json({ error: 'Failed to add member' }, 500);
  }
});

instanceMembers.put('/:userId', zValidator('json', updateMemberSchema), async (c) => {
  try {
    const callerId = c.get('userId');
    const targetUserId = c.req.param('userId');
    const { instance_id, role, can_edit_calendar } = c.req.valid('json');

    // Only an admin of the instance can modify memberships
    const callerMembership = await query(
      'SELECT role FROM instance_members WHERE user_id = $1 AND instance_id = $2',
      [callerId, instance_id]
    );
    if (callerMembership.rows.length === 0 || callerMembership.rows[0].role !== 'admin') {
      return c.json({ error: 'Forbidden: admin access required' }, 403);
    }

    const targetMembership = await query(
      'SELECT 1 FROM instance_members WHERE user_id = $1 AND instance_id = $2',
      [targetUserId, instance_id]
    );
    if (targetMembership.rows.length === 0) {
      return c.json({ error: 'User is not a member of this instance' }, 404);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(role);
    }
    if (can_edit_calendar !== undefined) {
      fields.push(`can_edit_calendar = $${idx++}`);
      values.push(can_edit_calendar);
    } else if (role !== undefined) {
      // Recompute calendar permissions to match the new role (mirrors POST).
      fields.push(`can_edit_calendar = $${idx++}`);
      values.push(role === 'viewer' ? false : true);
    }

    if (fields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(targetUserId, instance_id);
    const result = await query(
      `UPDATE instance_members SET ${fields.join(', ')} WHERE user_id = $${idx} AND instance_id = $${idx + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Membership not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update instance member error:', err);
    return c.json({ error: 'Failed to update member' }, 500);
  }
});

export { instanceMembers };
