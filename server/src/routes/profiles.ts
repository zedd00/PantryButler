import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance } from '../utils/membership';

const profiles = new Hono<{ Variables: AuthVariables }>();

profiles.use('*', requireAuth, requireResourceScope('profile'));

profiles.get('/', async (c) => {
  try {
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(c.get('userId'), instanceId))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const membersResult = await query(
      'SELECT user_id, role FROM instance_members WHERE instance_id = $1',
      [instanceId]
    );

    const members = membersResult.rows;
    const userIds = members.map((m) => m.user_id);

    if (userIds.length === 0) {
      return c.json([]);
    }

    const profilesResult = await query(
      'SELECT * FROM profiles WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC',
      [userIds]
    );

    const profilesWithRoles = profilesResult.rows.map((profile) => ({
      ...profile,
      role: members.find((m) => m.user_id === profile.id)?.role || null,
    }));

    return c.json(profilesWithRoles);
  } catch (err) {
    console.error('Get profiles error:', err);
    return c.json({ error: 'Failed to get profiles' }, 500);
  }
});

profiles.get('/role', async (c) => {
  try {
    const userId = c.get('userId');
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    const result = await query(
      'SELECT role FROM instance_members WHERE user_id = $1 AND instance_id = $2',
      [userId, instanceId]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Not a member of this instance' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Get role error:', err);
    return c.json({ error: 'Failed to get role' }, 500);
  }
});

// `.strict()` rejects unknown keys (e.g. {"role":"superadmin"}) instead of
// silently stripping them, so a privilege-escalation attempt fails loudly.
const updateProfileSchema = z.object({
  display_name: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
}).strict();

profiles.put('/:id', zValidator('json', updateProfileSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const profileId = c.req.param('id');

    if (userId !== profileId) {
      return c.json({ error: 'You can only update your own profile' }, 403);
    }

    const body = c.req.valid('json');

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (body.display_name !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(body.display_name);
    }

    if (body.avatar_url !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(body.avatar_url);
    }

    if (fields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    values.push(profileId);
    const result = await query(
      `UPDATE profiles SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

profiles.delete('/:id', async (c) => {
  try {
    const callerId = c.get('userId');
    const profileId = c.req.param('id');

    if (callerId === profileId) {
      return c.json({ error: 'You cannot delete your own account' }, 403);
    }

    const callerResult = await query(
      'SELECT instance_id, role FROM profiles WHERE id = $1',
      [callerId]
    );
    if (callerResult.rows.length === 0) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    const caller = callerResult.rows[0];

    const targetResult = await query(
      'SELECT id FROM profiles WHERE id = $1',
      [profileId]
    );
    if (targetResult.rows.length === 0) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    const isSuperAdmin = caller.role === 'superadmin';

    if (!isSuperAdmin) {
      // The caller must be an admin of the instance they are acting in.
      const adminCheck = await query(
        'SELECT 1 FROM instance_members WHERE user_id = $1 AND instance_id = $2 AND role = \'admin\'',
        [callerId, caller.instance_id]
      );
      if (adminCheck.rows.length === 0) {
        return c.json({ error: 'Forbidden: admin access required' }, 403);
      }

      // The target must actually be a member of the caller's instance — not
      // merely share an *active* instance id, which is caller-controlled.
      const membershipCheck = await query(
        'SELECT 1 FROM instance_members WHERE user_id = $1 AND instance_id = $2',
        [profileId, caller.instance_id]
      );
      if (membershipCheck.rows.length === 0) {
        return c.json({ error: 'Forbidden: user is not a member of this instance' }, 403);
      }

      // Cross-instance safety: deleting a users row cascades across every
      // membership. A kitchen admin may only delete accounts that belong
      // exclusively to their kitchen; a user shared with another kitchen must
      // be removed there first.
      const membershipCount = await query(
        'SELECT COUNT(*)::int AS count FROM instance_members WHERE user_id = $1',
        [profileId]
      );
      if ((membershipCount.rows[0]?.count ?? 0) > 1) {
        return c.json(
          { error: 'User belongs to other kitchens; remove them from those kitchens first' },
          409
        );
      }
    }

    // Delete the user row — profiles and all dependent rows cascade
    await query('DELETE FROM users WHERE id = $1', [profileId]);

    return c.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete profile error:', err);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

export { profiles };
