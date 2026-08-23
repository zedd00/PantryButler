import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const settings = new Hono<{ Variables: AuthVariables }>();

settings.use('*', requireAuth, requireResourceScope('settings'));

settings.get('/', async (c) => {
  try {
    const instanceId = c.req.query('instance_id');

    if (!instanceId) {
      return c.json({ error: 'instance_id query parameter is required' }, 400);
    }

    if (!(await canAccessInstance(c.get('userId'), instanceId))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query('SELECT * FROM settings WHERE instance_id = $1', [instanceId]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Settings not found' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Get settings error:', err);
    return c.json({ error: 'Failed to get settings' }, 500);
  }
});

const upsertSettingsSchema = z.object({
  instance_id: z.string().uuid(),
  preferred_unit_system: z.string().optional(),
  dark_mode: z.boolean().optional(),
  vibrant_mode: z.boolean().optional(),
  nutrition_enabled: z.boolean().optional(),
  currency: z.string().min(3).max(3).optional(),
  cost_tracking_enabled: z.boolean().optional(),
});

settings.put('/', zValidator('json', upsertSettingsSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const { instance_id, ...fields } = body;

    if (!(await canEditInstance(c.get('userId'), instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const existing = await query('SELECT instance_id FROM settings WHERE instance_id = $1', [instance_id]);

    if (existing.rows.length > 0) {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (fields.preferred_unit_system !== undefined) {
        setClauses.push(`preferred_unit_system = $${paramIndex++}`);
        values.push(fields.preferred_unit_system);
      }
      if (fields.dark_mode !== undefined) {
        setClauses.push(`dark_mode = $${paramIndex++}`);
        values.push(fields.dark_mode);
      }
      if (fields.vibrant_mode !== undefined) {
        setClauses.push(`vibrant_mode = $${paramIndex++}`);
        values.push(fields.vibrant_mode);
      }
      if (fields.nutrition_enabled !== undefined) {
        setClauses.push(`nutrition_enabled = $${paramIndex++}`);
        values.push(fields.nutrition_enabled);
      }
      if (fields.currency !== undefined) {
        setClauses.push(`currency = $${paramIndex++}`);
        values.push(fields.currency);
      }
      if (fields.cost_tracking_enabled !== undefined) {
        setClauses.push(`cost_tracking_enabled = $${paramIndex++}`);
        values.push(fields.cost_tracking_enabled);
      }

      if (setClauses.length > 0) {
        setClauses.push('updated_at = NOW()');
        values.push(instance_id);

        const result = await query(
          `UPDATE settings SET ${setClauses.join(', ')} WHERE instance_id = $${paramIndex} RETURNING *`,
          values
        );

        return c.json(result.rows[0]);
      }

      const result = await query('SELECT * FROM settings WHERE instance_id = $1', [instance_id]);
      return c.json(result.rows[0]);
    }

    const insertResult = await query(
      `INSERT INTO settings (instance_id, preferred_unit_system, dark_mode, vibrant_mode, nutrition_enabled, currency, cost_tracking_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        instance_id,
        fields.preferred_unit_system || null,
        fields.dark_mode ?? null,
        fields.vibrant_mode ?? null,
        fields.nutrition_enabled ?? null,
        fields.currency ?? 'USD',
        fields.cost_tracking_enabled ?? true,
      ]
    );

    return c.json(insertResult.rows[0], 201);
  } catch (err) {
    console.error('Upsert settings error:', err);
    return c.json({ error: 'Failed to save settings' }, 500);
  }
});

export { settings };
