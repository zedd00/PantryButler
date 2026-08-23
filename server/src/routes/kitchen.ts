import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { canAccessInstance, canEditInstance } from '../utils/membership';

const kitchen = new Hono<{ Variables: AuthVariables }>();

kitchen.use('*', requireAuth, requireResourceScope('kitchen'));

// Kitchen models are strictly per-user (GET /models and /locations both filter
// on user_id). Elements and placements must follow the same ownership rule:
// only the model's owner (or a superadmin) may read or mutate them. A bare
// instance membership is not sufficient — otherwise any member could read and
// rewrite another user's layout, and even move their pantry/equipment items.
async function canManageModel(userId: string, modelId: string): Promise<boolean> {
  const result = await query(
    'SELECT user_id FROM kitchen_models WHERE id = $1',
    [modelId]
  );
  if (result.rows.length === 0) return false;
  if (result.rows[0].user_id === userId) return true;
  const profile = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
  return profile.rows[0]?.role === 'superadmin';
}

async function canEditModel(userId: string, modelId: string): Promise<boolean> {
  return canManageModel(userId, modelId);
}

const createModelSchema = z.object({
  instance_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  canvas_width: z.number().int().optional(),
  canvas_height: z.number().int().optional(),
});

const updateModelSchema = z.object({
  instance_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  canvas_width: z.number().int().optional(),
  canvas_height: z.number().int().optional(),
});

const createElementSchema = z.object({
  model_id: z.string().uuid(),
  element_type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().optional(),
  custom_name: z.string().nullable().optional(),
  custom_color: z.string().nullable().optional(),
  shelves: z.any().optional(),
});

const updateElementSchema = z.object({
  element_type: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  custom_name: z.string().nullable().optional(),
  custom_color: z.string().nullable().optional(),
  shelves: z.any().optional(),
});

const createPlacementSchema = z.object({
  element_id: z.string().uuid(),
  item_type: z.enum(['ingredient', 'equipment']),
  item_id: z.string().uuid(),
});

const deletePlacementByItemSchema = z.object({
  element_id: z.string().uuid(),
  item_type: z.enum(['ingredient', 'equipment']),
  item_id: z.string().uuid(),
});

// Rename the "model\" prefix of every stored location string for the given
// instance so a layout rename propagates to pantry_items and equipment (and,
// through them, to recipes on next load). This covers both items that were
// placed via drag-and-drop and items whose location was set directly through
// the Ingredients/Equipment dropdowns (which have no placement row). Pantry
// items are per-user, so renames only ever touch the owner's own rows.
async function propagateModelRename(oldName: string, newName: string, instanceId: string, userId: string) {
  if (oldName === newName) return;

  await query(
    `UPDATE pantry_items
     SET location = $1 || substr(location, char_length($2) + 2)
     WHERE instance_id = $3
       AND user_id = $4
       AND location IS NOT NULL
       AND left(location, char_length($2) + 1) = $2 || '\\'`,
    [newName, oldName, instanceId, userId]
  );

  await query(
    `UPDATE equipment
     SET location = $1 || substr(location, char_length($2) + 2)
     WHERE instance_id = $3
       AND location IS NOT NULL
       AND left(location, char_length($2) + 1) = $2 || '\\'`,
    [newName, oldName, instanceId]
  );
}

// Exact-string rename of a single element's location ("model\element").
async function propagateElementRename(oldLocation: string, newLocation: string, instanceId: string, userId: string) {
  if (oldLocation === newLocation) return;

  await query(
    'UPDATE pantry_items SET location = $1 WHERE instance_id = $3 AND user_id = $4 AND location = $2',
    [newLocation, oldLocation, instanceId, userId]
  );

  await query(
    'UPDATE equipment SET location = $1 WHERE instance_id = $3 AND location = $2',
    [newLocation, oldLocation, instanceId]
  );
}

kitchen.get('/models', async (c) => {
  try {
    const userId = c.get('userId');
    const instance_id = c.req.query('instance_id');

    if (instance_id && !(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    let sql = 'SELECT * FROM kitchen_models WHERE user_id = $1';
    const params: unknown[] = [userId];

    if (instance_id) {
      sql += ' AND instance_id = $2';
      params.push(instance_id);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return c.json(result.rows);
  } catch (err) {
    console.error('Get kitchen models error:', err);
    return c.json({ error: 'Failed to fetch kitchen models' }, 500);
  }
});

kitchen.post('/models', zValidator('json', createModelSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    if (!(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const result = await query(
      `INSERT INTO kitchen_models (instance_id, name, description, canvas_width, canvas_height, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.instance_id, data.name, data.description ?? null, data.canvas_width ?? 1200, data.canvas_height ?? 800, userId]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create kitchen model error:', err);
    return c.json({ error: 'Failed to create kitchen model' }, 500);
  }
});

kitchen.put('/models/:id', zValidator('json', updateModelSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const data = c.req.valid('json');

    const before = await query(
      'SELECT name, instance_id FROM kitchen_models WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (before.rows.length === 0) return c.json({ error: 'Kitchen model not found' }, 404);

    if (data.instance_id !== undefined && !(await canEditInstance(userId, data.instance_id))) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.instance_id !== undefined) { fields.push(`instance_id = $${idx++}`); values.push(data.instance_id); }
    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.canvas_width !== undefined) { fields.push(`canvas_width = $${idx++}`); values.push(data.canvas_width); }
    if (data.canvas_height !== undefined) { fields.push(`canvas_height = $${idx++}`); values.push(data.canvas_height); }

    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

    fields.push('updated_at = NOW()');
    values.push(id, userId);

    const result = await query(
      `UPDATE kitchen_models SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );

    if (data.name !== undefined) {
      const oldModel = before.rows[0] as { name: string; instance_id: string };
      await propagateModelRename(oldModel.name, data.name, oldModel.instance_id, c.get('userId'));
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update kitchen model error:', err);
    return c.json({ error: 'Failed to update kitchen model' }, 500);
  }
});

kitchen.delete('/models/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const result = await query(
      'DELETE FROM kitchen_models WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) return c.json({ error: 'Kitchen model not found' }, 404);
    return c.json({ message: 'Kitchen model deleted' });
  } catch (err) {
    console.error('Delete kitchen model error:', err);
    return c.json({ error: 'Failed to delete kitchen model' }, 500);
  }
});

kitchen.get('/models/:modelId/elements', async (c) => {
  try {
    const modelId = c.req.param('modelId');

    if (!(await canManageModel(c.get('userId'), modelId))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      `SELECT e.*, 
        COALESCE(
          json_agg(eip.*) FILTER (WHERE eip.id IS NOT NULL),
          '[]'::json
        ) as placements
      FROM kitchen_elements e
      LEFT JOIN element_item_placements eip ON eip.element_id = e.id
      WHERE e.model_id = $1
      GROUP BY e.id
      ORDER BY e.created_at ASC`,
      [modelId]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get kitchen elements error:', err);
    return c.json({ error: 'Failed to fetch kitchen elements' }, 500);
  }
});

kitchen.post('/elements', zValidator('json', createElementSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    if (!(await canEditModel(c.get('userId'), data.model_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      `INSERT INTO kitchen_elements (model_id, element_type, x, y, width, height, rotation, custom_name, custom_color, shelves)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.model_id, data.element_type, data.x, data.y, data.width, data.height, data.rotation ?? 0, data.custom_name ?? null, data.custom_color ?? null, data.shelves ?? null]
    );

    return c.json(result.rows[0], 201);
  } catch (err) {
    console.error('Create kitchen element error:', err);
    return c.json({ error: 'Failed to create kitchen element' }, 500);
  }
});

kitchen.put('/elements/:id', zValidator('json', updateElementSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const before = await query(
      `SELECT e.custom_name, e.element_type, e.model_id, m.name AS model_name, m.instance_id
       FROM kitchen_elements e
       JOIN kitchen_models m ON m.id = e.model_id
       WHERE e.id = $1`,
      [id]
    );
    if (before.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);

    if (!(await canEditModel(c.get('userId'), before.rows[0].model_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.element_type !== undefined) { fields.push(`element_type = $${idx++}`); values.push(data.element_type); }
    if (data.x !== undefined) { fields.push(`x = $${idx++}`); values.push(data.x); }
    if (data.y !== undefined) { fields.push(`y = $${idx++}`); values.push(data.y); }
    if (data.width !== undefined) { fields.push(`width = $${idx++}`); values.push(data.width); }
    if (data.height !== undefined) { fields.push(`height = $${idx++}`); values.push(data.height); }
    if (data.rotation !== undefined) { fields.push(`rotation = $${idx++}`); values.push(data.rotation); }
    if (data.custom_name !== undefined) { fields.push(`custom_name = $${idx++}`); values.push(data.custom_name); }
    if (data.custom_color !== undefined) { fields.push(`custom_color = $${idx++}`); values.push(data.custom_color); }
    if (data.shelves !== undefined) { fields.push(`shelves = $${idx++}`); values.push(data.shelves); }

    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

    values.push(id);

    const result = await query(
      `UPDATE kitchen_elements SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);

    if (data.custom_name !== undefined || data.element_type !== undefined) {
      const el = before.rows[0] as { custom_name: string | null; element_type: string; model_name: string; instance_id: string };
      const oldElementName = el.custom_name || el.element_type;
      const newCustomName = data.custom_name !== undefined ? data.custom_name : el.custom_name;
      const newElementType = data.element_type !== undefined ? data.element_type : el.element_type;
      const newElementName = newCustomName || newElementType;

      await propagateElementRename(
        `${el.model_name}\\${oldElementName}`,
        `${el.model_name}\\${newElementName}`,
        el.instance_id,
        c.get('userId')
      );
    }

    return c.json(result.rows[0]);
  } catch (err) {
    console.error('Update kitchen element error:', err);
    return c.json({ error: 'Failed to update kitchen element' }, 500);
  }
});

kitchen.delete('/elements/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const before = await query(
      'SELECT model_id FROM kitchen_elements WHERE id = $1',
      [id]
    );
    if (before.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);
    if (!(await canEditModel(c.get('userId'), before.rows[0].model_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      'DELETE FROM kitchen_elements WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);
    return c.json({ message: 'Kitchen element deleted' });
  } catch (err) {
    console.error('Delete kitchen element error:', err);
    return c.json({ error: 'Failed to delete kitchen element' }, 500);
  }
});

kitchen.get('/elements/:elementId/placements', async (c) => {
  try {
    const elementId = c.req.param('elementId');

    const before = await query(
      'SELECT model_id FROM kitchen_elements WHERE id = $1',
      [elementId]
    );
    if (before.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);
    if (!(await canManageModel(c.get('userId'), before.rows[0].model_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      'SELECT * FROM element_item_placements WHERE element_id = $1 ORDER BY created_at ASC',
      [elementId]
    );

    return c.json(result.rows);
  } catch (err) {
    console.error('Get element placements error:', err);
    return c.json({ error: 'Failed to fetch placements' }, 500);
  }
});

kitchen.post('/placements', zValidator('json', createPlacementSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const data = c.req.valid('json');

    const elementResult = await query(
      `SELECT e.custom_name, e.element_type, e.model_id, m.name as model_name, m.instance_id
       FROM kitchen_elements e
       JOIN kitchen_models m ON m.id = e.model_id
       WHERE e.id = $1`,
      [data.element_id]
    );

    if (elementResult.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);
    if (!(await canEditModel(userId, elementResult.rows[0].model_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (data.item_type === 'ingredient') {
      const item = await query(
        'SELECT instance_id, user_id FROM pantry_items WHERE id = $1',
        [data.item_id]
      );
      if (item.rows.length === 0) return c.json({ error: 'Item not found' }, 404);
      if (item.rows[0].instance_id !== elementResult.rows[0].instance_id) {
        return c.json({ error: 'Forbidden: item is not in this instance' }, 403);
      }
      // Pantry items are owned per-user; placing one mutates its location, so
      // only the owner may move it into a layout.
      if (item.rows[0].user_id !== userId) {
        return c.json({ error: 'Forbidden: item belongs to another user' }, 403);
      }
    } else if (data.item_type === 'equipment') {
      const item = await query(
        'SELECT instance_id FROM equipment WHERE id = $1',
        [data.item_id]
      );
      if (item.rows.length === 0) return c.json({ error: 'Item not found' }, 404);
      if (item.rows[0].instance_id !== elementResult.rows[0].instance_id) {
        return c.json({ error: 'Forbidden: item is not in this instance' }, 403);
      }
    }

    const result = await query(
      `INSERT INTO element_item_placements (element_id, item_type, item_id) VALUES ($1, $2, $3) RETURNING *`,
      [data.element_id, data.item_type, data.item_id]
    );

    const placement = result.rows[0];

    const element = elementResult.rows[0];
    const elementName = element.custom_name || element.element_type;
    const location = `${element.model_name}\\${elementName}`;

    if (data.item_type === 'ingredient') {
      await query('UPDATE pantry_items SET location = $1 WHERE id = $2', [location, data.item_id]);
    } else if (data.item_type === 'equipment') {
      await query('UPDATE equipment SET location = $1 WHERE id = $2', [location, data.item_id]);
    }

    return c.json(placement, 201);
  } catch (err) {
    console.error('Create placement error:', err);
    return c.json({ error: 'Failed to create placement' }, 500);
  }
});

kitchen.delete('/placements/by-item', zValidator('json', deletePlacementByItemSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    const before = await query(
      'SELECT model_id FROM kitchen_elements WHERE id = $1',
      [data.element_id]
    );
    if (before.rows.length === 0) return c.json({ error: 'Kitchen element not found' }, 404);
    if (!(await canEditModel(c.get('userId'), before.rows[0].model_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await query(
      'DELETE FROM element_item_placements WHERE element_id = $1 AND item_type = $2 AND item_id = $3 RETURNING *',
      [data.element_id, data.item_type, data.item_id]
    );

    if (result.rows.length === 0) return c.json({ error: 'Placement not found' }, 404);
    return c.json({ message: 'Placement deleted' });
  } catch (err) {
    console.error('Delete placement by item error:', err);
    return c.json({ error: 'Failed to delete placement' }, 500);
  }
});

kitchen.get('/locations', async (c) => {
  try {
    const userId = c.get('userId');
    const instance_id = c.req.query('instance_id');

    if (!instance_id) return c.json({ error: 'instance_id query parameter is required' }, 400);

    if (!(await canAccessInstance(userId, instance_id))) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }

    const result = await query(
      `SELECT m.name as model_name, e.custom_name, e.element_type
       FROM kitchen_models m
       JOIN kitchen_elements e ON e.model_id = m.id
       WHERE m.user_id = $1 AND m.instance_id = $2
       ORDER BY m.name, e.created_at`,
      [userId, instance_id]
    );

    const locations = result.rows.map((row: { model_name: string; custom_name: string | null; element_type: string }) => {
      const elementName = row.custom_name || row.element_type;
      return `${row.model_name}\\${elementName}`;
    });

    return c.json(locations);
  } catch (err) {
    console.error('Get kitchen locations error:', err);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

export { kitchen };
