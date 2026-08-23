import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { config } from '../utils/config';
import { requireSuperAdmin, type AuthVariables, getOptionalSuperAdmin } from '../middleware/auth';
import {
  getSystemConfigValue,
  setSystemConfigValue,
  clearSystemConfigValue,
  isEmailVerificationRequired,
  getEffectiveSmtp,
  getStoredSmtpOverrides,
} from '../utils/system-config';
 
const admin = new Hono<{ Variables: AuthVariables }>();

// Instances sub-router. Gated with path-scoped middleware (the `protect` idiom)
// so the enableAdminFeatures / superadmin checks can never be bypassed: a bare
// `admin.use('/instances*', ...)` wildcard does not match `/instances` under
// Hono's path matcher, leaving the routes otherwise unprotected.
const adminInstances = new Hono<{ Variables: AuthVariables }>();

admin.post('/seed-nutrition', async (c) => {
  try {
    // Only the first-boot bootstrap flow may seed nutrition data. Once an admin
    // user exists, seeding must go through a superadmin (the authenticated
    // import-batch endpoint is the normal post-setup path).
    const userCount = await query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count, 10) > 0 && !(await getOptionalSuperAdmin(c.req.header('Authorization')))) {
      return c.json({ error: 'Seeding is only allowed before any users are created, or by a superadmin' }, 400);
    }

    const body = await c.req.json();
    const { nutritionData } = body;

    if (!Array.isArray(nutritionData) || nutritionData.length === 0) {
      return c.json({ error: 'nutritionData must be a non-empty array' }, 400);
    }

    // Batch-insert with jsonb_to_recordset (mirrors the setup.ts seed path)
    // instead of one INSERT per row.
    let insertedCount = 0;
    const batchSize = 500;
    for (let i = 0; i < nutritionData.length; i += batchSize) {
      const batch = nutritionData.slice(i, i + batchSize);
      const dataJson = JSON.stringify(batch.map((item) => ({
        ...item,
        calories: item.calories || 0,
        protein_g: item.protein_g || 0,
        carbs_g: item.carbs_g || 0,
        fat_g: item.fat_g || 0,
      })));
      const result = await query(
        `INSERT INTO nutrition_foods (
          id, name, category, calories, protein_g, carbs_g, fat_g,
          fiber_g, sugar_g, sodium_mg, cholesterol_mg,
          serving_size, serving_unit, serving_grams, nutrition_data,
          alternate_names,
          tbsp_to_g, tsp_to_g, oz_to_g, cup_to_g,
          fl_oz_to_ml, fl_oz_to_l, ml_to_pint, ml_to_quart, ml_to_gallon,
          l_to_pint, l_to_quart, l_to_gallon,
          name_es, name_fr, name_hi, name_it, name_sq, name_zh,
          alternate_names_es, alternate_names_fr, alternate_names_hi,
          alternate_names_it, alternate_names_sq, alternate_names_zh
        )
        SELECT
          id, name, category,
          (calories)::NUMERIC, (protein_g)::NUMERIC, (carbs_g)::NUMERIC, (fat_g)::NUMERIC,
          (fiber_g)::NUMERIC, (sugar_g)::NUMERIC, (sodium_mg)::NUMERIC, (cholesterol_mg)::NUMERIC,
          (serving_size)::JSONB, serving_unit, NULLIF(serving_grams, '')::NUMERIC, (nutrition_data)::JSONB,
          CASE WHEN alternate_names IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names)) ELSE NULL END,
          NULLIF(tbsp_to_g, '')::NUMERIC, NULLIF(tsp_to_g, '')::NUMERIC, NULLIF(oz_to_g, '')::NUMERIC, NULLIF(cup_to_g, '')::NUMERIC,
          NULLIF(fl_oz_to_ml, '')::NUMERIC, NULLIF(fl_oz_to_l, '')::NUMERIC, NULLIF(ml_to_pint, '')::NUMERIC, NULLIF(ml_to_quart, '')::NUMERIC, NULLIF(ml_to_gallon, '')::NUMERIC,
          NULLIF(l_to_pint, '')::NUMERIC, NULLIF(l_to_quart, '')::NUMERIC, NULLIF(l_to_gallon, '')::NUMERIC,
          name_es, name_fr, name_hi, name_it, name_sq, name_zh,
          CASE WHEN alternate_names_es IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_es)) ELSE NULL END,
          CASE WHEN alternate_names_fr IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_fr)) ELSE NULL END,
          CASE WHEN alternate_names_hi IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_hi)) ELSE NULL END,
          CASE WHEN alternate_names_it IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_it)) ELSE NULL END,
          CASE WHEN alternate_names_sq IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_sq)) ELSE NULL END,
          CASE WHEN alternate_names_zh IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(alternate_names_zh)) ELSE NULL END
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id TEXT, name TEXT, category TEXT,
          calories NUMERIC, protein_g NUMERIC, carbs_g NUMERIC, fat_g NUMERIC,
          fiber_g NUMERIC, sugar_g NUMERIC, sodium_mg NUMERIC, cholesterol_mg NUMERIC,
          serving_size JSONB, serving_unit TEXT, serving_grams TEXT, nutrition_data JSONB,
          alternate_names JSONB,
          tbsp_to_g TEXT, tsp_to_g TEXT, oz_to_g TEXT, cup_to_g TEXT,
          fl_oz_to_ml TEXT, fl_oz_to_l TEXT, ml_to_pint TEXT, ml_to_quart TEXT, ml_to_gallon TEXT,
          l_to_pint TEXT, l_to_quart TEXT, l_to_gallon TEXT,
          name_es TEXT, name_fr TEXT, name_hi TEXT, name_it TEXT, name_sq TEXT, name_zh TEXT,
          alternate_names_es JSONB, alternate_names_fr JSONB, alternate_names_hi JSONB,
          alternate_names_it JSONB, alternate_names_sq JSONB, alternate_names_zh JSONB
        )
        ON CONFLICT (id) DO NOTHING`,
        [dataJson]
      );
      insertedCount += result.rowCount || 0;
    }

    return c.json({ success: true, insertedCount });
  } catch (err) {
    console.error('Seed nutrition error:', err);
    return c.json({ error: 'Failed to seed nutrition data' }, 500);
  }
});

// Validate setup (unauthenticated - used during initial setup)
admin.get('/validate', async (c) => {
  try {
    const userResult = await query('SELECT COUNT(*) FROM profiles');
    const hasUsers = parseInt(userResult.rows[0].count, 10) > 0;

    // During first-boot bootstrap the Setup page calls this before/around
    // admin creation; once users exist, only a superadmin may read the
    // system-wide aggregate counts (security: counts are a recon surface).
    if (hasUsers) {
      const denied = await requireSuperAdmin(c, async () => {});
      if (denied) return denied;
    }

    const nutritionResult = await query('SELECT COUNT(*) FROM nutrition_foods');
    const instanceResult = await query('SELECT COUNT(*) FROM instances');

    return c.json({
      success: true,
      nutritionCount: parseInt(nutritionResult.rows[0].count, 10),
      userCount: parseInt(userResult.rows[0].count, 10),
      instanceCount: parseInt(instanceResult.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Validate error:', err);
    return c.json({ error: 'Failed to validate setup' }, 500);
  }
});

// Authenticated superadmin routes, gated behind the ENABLE_ADMIN_FEATURES switch
adminInstances.use('*', async (c, next) => {
  if (!config.enableAdminFeatures) {
    return c.json({ error: 'Admin features are disabled' }, 403);
  }
  return next();
});
adminInstances.use('*', requireSuperAdmin);

adminInstances.get('/', async (c) => {
  try {
    const instances = await query(
      'SELECT id, name, created_at, created_by FROM instances ORDER BY created_at DESC'
    );

    const instanceIds = instances.rows.map((r) => r.id);
    const creatorIds = instances.rows.map((r) => r.created_by).filter(Boolean);

    // Batch the per-instance lookups: creator profile + last login in two
    // queries total instead of 2N.
    const [profilesResult, lastLoginResult] = await Promise.all([
      query(
        'SELECT id, display_name, username FROM profiles WHERE id = ANY($1::uuid[])',
        [creatorIds]
      ),
      query(
        `SELECT DISTINCT ON (instance_id) instance_id, last_login
         FROM profiles
         WHERE instance_id = ANY($1::uuid[])
         ORDER BY instance_id, last_login DESC NULLS LAST`,
        [instanceIds]
      ),
    ]);

    const creatorById = new Map(profilesResult.rows.map((r) => [r.id, r]));
    const lastLoginByInstance = new Map(lastLoginResult.rows.map((r) => [r.instance_id, r.last_login]));

    const result = instances.rows.map((instance) => ({
      id: instance.id,
      name: instance.name,
      created_at: instance.created_at,
      created_by: instance.created_by,
      creator: creatorById.get(instance.created_by) || null,
      last_login: lastLoginByInstance.get(instance.id) || null,
    }));

    return c.json(result);
  } catch (err) {
    console.error('Get instances error:', err);
    return c.json({ error: 'Failed to get instances' }, 500);
  }
});

adminInstances.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    // Deleting an instance cascade-deletes every profile pointing at it, which
    // would otherwise orphan the member users: their accounts would silently
    // resurrect with a fresh kitchen on their next login. Clean up explicitly:
    // 1. Re-point members who also belong to another kitchen so the cascade
    //    doesn't delete their profile.
    // 2. Re-point superadmins to any surviving instance (or detach them) rather
    //    than orphaning a privileged account.
    // 3. Delete the accounts of members who have no other kitchen.
    await query(
      `UPDATE profiles p SET instance_id = (
         SELECT im2.instance_id
         FROM instance_members im2
         WHERE im2.user_id = p.id AND im2.instance_id <> $1
         ORDER BY im2.joined_at, im2.instance_id
         LIMIT 1
       )
       WHERE p.instance_id = $1
         AND EXISTS (
           SELECT 1 FROM instance_members im2
           WHERE im2.user_id = p.id AND im2.instance_id <> $1
         )`,
      [id]
    );

    await query(
      `UPDATE profiles SET instance_id = (
         SELECT i.id FROM instances i WHERE i.id <> $1 ORDER BY i.created_at LIMIT 1
       )
       WHERE instance_id = $1 AND role = 'superadmin'
         AND EXISTS (SELECT 1 FROM instances WHERE id <> $1)`,
      [id]
    );

    await query(
      `UPDATE profiles SET instance_id = NULL
       WHERE instance_id = $1 AND role = 'superadmin'
         AND NOT EXISTS (SELECT 1 FROM instances WHERE id <> $1)`,
      [id]
    );

    await query(
      `DELETE FROM users
       WHERE id IN (
         SELECT user_id FROM instance_members WHERE instance_id = $1
       )
       AND NOT EXISTS (
         SELECT 1 FROM instance_members im WHERE im.user_id = users.id AND im.instance_id <> $1
       )
       AND id NOT IN (
         SELECT id FROM profiles WHERE role = 'superadmin'
       )`,
      [id]
    );

    const result = await query('DELETE FROM instances WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return c.json({ error: 'Instance not found' }, 404);
    }
    return c.json({ message: 'Instance deleted' });
  } catch (err) {
    console.error('Delete instance error:', err);
    return c.json({ error: 'Failed to delete instance' }, 500);
  }
});

admin.route('/instances', adminInstances);

// ---------------------------------------------------------------------------
// Admin config (email verification + SMTP). Global, superadmin-only, gated
// behind the ENABLE_ADMIN_FEATURES switch like the other admin sub-routers.
// Values are stored in system_config and override the env defaults; a null /
// cleared value falls back to the environment.
// ---------------------------------------------------------------------------

const adminConfigSchema = z.object({
  require_email_verification: z.boolean().optional(),
  smtp: z
    .object({
      host: z.string().nullable().optional(),
      port: z.number().int().optional(),
      username: z.string().nullable().optional(),
      password: z.string().nullable().optional(),
      from: z.string().nullable().optional(),
      secure: z.boolean().nullable().optional(),
    })
    .optional(),
  reset_smtp: z.boolean().optional(),
});

const adminConfig = new Hono<{ Variables: AuthVariables }>();

adminConfig.use('*', async (c, next) => {
  if (!config.enableAdminFeatures) {
    return c.json({ error: 'Admin features are disabled' }, 403);
  }
  return next();
});
adminConfig.use('*', requireSuperAdmin);

adminConfig.get('/', async (c) => {
  try {
    const [override, smtp, smtpOverride] = await Promise.all([
      getSystemConfigValue<boolean>('require_email_verification'),
      getEffectiveSmtp(),
      getStoredSmtpOverrides(),
    ]);
    return c.json({
      require_email_verification: await isEmailVerificationRequired(),
      require_email_verification_override: override ?? null,
      smtp: {
        host: smtp.host || null,
        port: smtp.port,
        username: smtp.username,
        from: smtp.from || null,
        secure: smtp.secure,
        passwordSet: Boolean(smtp.password),
      },
      smtp_override: {
        host: smtpOverride.host,
        port: smtpOverride.port,
        username: smtpOverride.username,
        passwordSet: smtpOverride.passwordSet,
        from: smtpOverride.from,
        secure: smtpOverride.secure,
      },
    });
  } catch (err) {
    console.error('Admin config read error:', err);
    return c.json({ error: 'Failed to load config' }, 500);
  }
});

adminConfig.put('/', zValidator('json', adminConfigSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    if (data.require_email_verification !== undefined) {
      await setSystemConfigValue('require_email_verification', data.require_email_verification);
    }

    if (data.reset_smtp) {
      await Promise.all([
        clearSystemConfigValue('smtp_host'),
        clearSystemConfigValue('smtp_port'),
        clearSystemConfigValue('smtp_username'),
        clearSystemConfigValue('smtp_password'),
        clearSystemConfigValue('smtp_from'),
        clearSystemConfigValue('smtp_secure'),
      ]);
    }

    if (data.smtp) {
      const s = data.smtp;
      if (s.host !== undefined) {
        if (s.host) await setSystemConfigValue('smtp_host', s.host);
        else await clearSystemConfigValue('smtp_host');
      }
      if (s.port !== undefined) {
        if (s.port) await setSystemConfigValue('smtp_port', s.port);
        else await clearSystemConfigValue('smtp_port');
      }
      if (s.username !== undefined) {
        if (s.username) await setSystemConfigValue('smtp_username', s.username);
        else await clearSystemConfigValue('smtp_username');
      }
      // password: a non-empty value sets the override; null / empty leaves the
      // current one untouched (clearing is done via reset_smtp).
      if (s.password !== undefined && s.password !== null && s.password !== '') {
        await setSystemConfigValue('smtp_password', s.password);
      }
      if (s.from !== undefined) {
        if (s.from) await setSystemConfigValue('smtp_from', s.from);
        else await clearSystemConfigValue('smtp_from');
      }
      if (s.secure !== undefined) {
        if (s.secure !== null) await setSystemConfigValue('smtp_secure', s.secure);
        else await clearSystemConfigValue('smtp_secure');
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('Admin config write error:', err);
    return c.json({ error: 'Failed to save config' }, 500);
  }
});

admin.route('/config', adminConfig);

export { admin };
