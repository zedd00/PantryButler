import { Hono, type Context } from 'hono';
import { query } from '../db/pool';
import { requireAuth, requireResourceScope, type AuthVariables } from '../middleware/auth';
import { getMemberships, canAccessInstance } from '../utils/membership';

const recipeIngredients = new Hono<{ Variables: AuthVariables }>();

recipeIngredients.use('*', requireAuth, requireResourceScope('recipes'));

// Returns a SQL clause + params that restrict recipe_ingredients lookups to the
// caller's accessible instances (rows are tied to instances only through their
// parent recipe). Superadmins see everything; a non-superadmin sees only the
// instances they belong to — never a cross-tenant dump.
async function instanceScope(c: Context): Promise<{ clause: string; params: unknown[] }> {
  const userId = c.get('userId');
  const optional = c.req.query('instance_id');
  if (optional) {
    if (!(await canAccessInstance(userId, optional))) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    return { clause: ' AND r.instance_id = $1', params: [optional] };
  }
  // API tokens are bound to a single instance (see authenticateApiToken). Even
  // though this route has no instance_id parameter, the scope must stay pinned
  // to the token's instance — falling back to all memberships here would let a
  // token minted for one kitchen read another kitchen the user belongs to.
  if (c.get('authType') === 'token') {
    const bound = c.get('instanceId');
    return bound
      ? { clause: ' AND r.instance_id = $1', params: [bound] }
      : { clause: ' AND FALSE', params: [] };
  }
  const profile = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
  if (profile.rows[0]?.role === 'superadmin') {
    return { clause: '', params: [] };
  }
  const memberships = await getMemberships(userId);
  const ids = Array.from(memberships.keys());
  if (ids.length === 0) {
    return { clause: ' AND FALSE', params: [] };
  }
  return {
    clause: ` AND r.instance_id = ANY($1::uuid[])`,
    params: [ids],
  };
}

recipeIngredients.get('/names', async (c) => {
  try {
    const scope = await instanceScope(c);
    const result = await query(
      `SELECT DISTINCT ri.name
       FROM recipe_ingredients ri
       JOIN recipes r ON r.id = ri.recipe_id
       WHERE 1=1${scope.clause}
       ORDER BY ri.name`,
      scope.params
    );
    return c.json(result.rows);
  } catch (err: any) {
    if (err?.status === 403) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }
    console.error('Get recipe ingredient names error:', err);
    return c.json({ error: 'Failed to load recipe ingredient names' }, 500);
  }
});

recipeIngredients.get('/preparations', async (c) => {
  try {
    const scope = await instanceScope(c);
    const result = await query(
      `SELECT DISTINCT ri.preparation
       FROM recipe_ingredients ri
       JOIN recipes r ON r.id = ri.recipe_id
       WHERE ri.preparation IS NOT NULL AND ri.preparation <> ''${scope.clause}
       ORDER BY ri.preparation`,
      scope.params
    );
    return c.json(result.rows);
  } catch (err: any) {
    if (err?.status === 403) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }
    console.error('Get recipe ingredient preparations error:', err);
    return c.json({ error: 'Failed to load recipe ingredient preparations' }, 500);
  }
});

recipeIngredients.get('/units', async (c) => {
  try {
    const scope = await instanceScope(c);
    const result = await query(
      `SELECT DISTINCT ri.unit
       FROM recipe_ingredients ri
       JOIN recipes r ON r.id = ri.recipe_id
       WHERE ri.unit IS NOT NULL AND ri.unit <> ''${scope.clause}
       ORDER BY ri.unit`,
      scope.params
    );
    return c.json(result.rows);
  } catch (err: any) {
    if (err?.status === 403) {
      return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
    }
    console.error('Get recipe ingredient units error:', err);
    return c.json({ error: 'Failed to load recipe ingredient units' }, 500);
  }
});

recipeIngredients.get('/', async (c) => {
  try {
    const ids = c.req.query('ids');
    const idArray = (ids || '').split(',').map(id => id.trim()).filter(Boolean);
    if (idArray.length === 0) return c.json([]);

    const recipesResult = await query(
      'SELECT DISTINCT instance_id FROM recipes WHERE id = ANY($1::uuid[])',
      [idArray]
    );

    const memberships = await getMemberships(c.get('userId'));
    const isSuper = (await query('SELECT role FROM profiles WHERE id = $1', [c.get('userId')])).rows[0]?.role === 'superadmin';
    for (const row of recipesResult.rows) {
      if (!(isSuper || memberships.has(row.instance_id as string))) {
        return c.json({ error: 'Forbidden: recipe not in an accessible instance' }, 403);
      }
    }

    const result = await query(
      'SELECT * FROM recipe_ingredients WHERE recipe_id = ANY($1::uuid[]) ORDER BY order_index',
      [idArray]
    );
    return c.json(result.rows);
  } catch (err) {
    console.error('Get recipe ingredients error:', err);
    return c.json({ error: 'Failed to load recipe ingredients' }, 500);
  }
});

export { recipeIngredients };
