import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, isAbsolute } from 'path';
import { query, withTransaction } from '../db/pool';
import { config } from '../utils/config';
import { requireSuperAdmin, getOptionalSuperAdmin } from '../middleware/auth';

const setup = new Hono();

setup.post('/seed-nutrition', async (c) => {
  try {
    // Same "fresh install" definition as GET /api/setup/status: profiles, not
    // users. A dormant (registered-but-unverified) account must not wedge
    // pre-bootstrap seeding — before any profile exists there is no superadmin
    // who could authorize it later.
    const userCount = await query('SELECT COUNT(*) FROM profiles');
    const hasUsers = parseInt(userCount.rows[0].count, 10) > 0;
    if (hasUsers && !(await getOptionalSuperAdmin(c.req.header('Authorization')))) {
      return c.json({ success: false, error: 'Seeding is only allowed before any users are created, or by a superadmin' }, 400);
    }

    const existing = await query('SELECT COUNT(*) FROM nutrition_foods');
    if (parseInt(existing.rows[0].count, 10) > 0) {
      return c.json({ success: false, error: 'Nutrition data already exists', count: parseInt(existing.rows[0].count, 10) });
    }

    const filePath = join(config.setupDir, 'nutrition_foods.json');
    let fileContent;
    try {
      fileContent = await readFile(filePath, 'utf-8');
    } catch {
      return c.json({ error: 'nutrition_foods.json not found in setup directory' }, 404);
    }

    const nutritionData = JSON.parse(fileContent);
    if (!Array.isArray(nutritionData) || nutritionData.length === 0) {
      return c.json({ error: 'nutrition_foods.json must contain a non-empty array' }, 400);
    }

    const batchSize = 500;
    let insertedCount = 0;

    for (let i = 0; i < nutritionData.length; i += batchSize) {
      const batch = nutritionData.slice(i, i + batchSize);
      const dataJson = JSON.stringify(batch);
      const result = await query(
        `INSERT INTO nutrition_foods (
          id, name, category, calories, protein_g, carbs_g, fat_g,
          fiber_g, sugar_g, sodium_mg, cholesterol_mg,
          serving_size, serving_unit, serving_grams, nutrition_data,
          alternate_names, tbsp_to_g, tsp_to_g, oz_to_g, cup_to_g,
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

    console.log(`Nutrition data seeded: ${insertedCount} records`);
    return c.json({ success: true, message: 'Nutrition data seeded successfully', insertedCount });
  } catch (err) {
    console.error('Seed nutrition error:', err);
    return c.json({ error: 'Failed to seed nutrition data' }, 500);
  }
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

setup.post('/create-admin', zValidator('json', createAdminSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');

    // Bootstrap is complete once any profile exists. Count profiles rather
    // than users so a dormant (registered-but-unverified, profile-less)
    // account can never wedge first-boot setup — this is the same table
    // GET /api/setup/status reports from, keeping both views of "is this a
    // fresh install" consistent.
    const existing = await query('SELECT COUNT(*) FROM profiles');
    if (parseInt(existing.rows[0].count, 10) > 0) {
      return c.json({ error: 'Users already exist. Use /api/auth/register instead.' }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const normalizedEmail = email.toLowerCase();

    // Create the user row and its superadmin profile in one transaction, so a
    // failure partway can no longer leave an orphaned user that blocks both
    // login and retrying bootstrap.
    await withTransaction(async (tx) => {
      // A dormant row may already hold this email (registered but never
      // verified). Claim it instead of colliding on the unique constraint.
      const dormant = await tx.query(
        'SELECT id FROM users WHERE email = $1 FOR UPDATE',
        [normalizedEmail]
      );
      let userId: string;
      if (dormant.rows.length > 0) {
        userId = dormant.rows[0].id;
        await tx.query(
          'UPDATE users SET password_hash = $2, email_verified_at = NOW() WHERE id = $1',
          [userId, passwordHash]
        );
      } else {
        const userResult = await tx.query(
          'INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, NOW()) RETURNING id',
          [normalizedEmail, passwordHash]
        );
        userId = userResult.rows[0].id;
      }

      // Superadmin profile without an instance (can manage all instances)
      await tx.query(
        `INSERT INTO profiles (id, email, username, display_name, role)
         VALUES ($1, $2, $3, $4, 'superadmin')`,
        [userId, normalizedEmail, normalizedEmail.split('@')[0], normalizedEmail.split('@')[0]]
      );
    });

    return c.json({ success: true, message: 'Superadmin created successfully', email });
  } catch (err) {
    console.error('Create admin error:', err);
    return c.json({ error: 'Failed to create admin user' }, 500);
  }
});

setup.get('/status', async (c) => {
  try {
    const profileResult = await query('SELECT COUNT(*) FROM profiles');
    const hasUsers = parseInt(profileResult.rows[0].count, 10) > 0;

    // Pre-bootstrap this endpoint is intentionally open (the Setup page needs
    // it before any account exists). Once users exist, expose the aggregate
    // counts only to a superadmin (security: counts are a recon surface).
    if (hasUsers) {
      const denied = await requireSuperAdmin(c, async () => {});
      if (denied) return denied;
    }

    const nutritionResult = await query('SELECT COUNT(*) FROM nutrition_foods');
    const instanceResult = await query('SELECT COUNT(*) FROM instances');

    return c.json({
      success: true,
      validation: {
        nutritionData: parseInt(nutritionResult.rows[0].count, 10) > 0,
        nutritionCount: parseInt(nutritionResult.rows[0].count, 10),
        hasUsers,
        userCount: parseInt(profileResult.rows[0].count, 10),
        hasInstances: parseInt(instanceResult.rows[0].count, 10) > 0,
        instanceCount: parseInt(instanceResult.rows[0].count, 10),
      },
    });
  } catch (err) {
    console.error('Setup status error:', err);
    return c.json({ error: 'Failed to get setup status' }, 500);
  }
});

setup.get('/files', requireSuperAdmin, async (c) => {
  try {
    const files = await readdir(config.setupDir);
    const jsonFiles = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async (f) => {
          const fullPath = join(config.setupDir, f);
          const stats = await stat(fullPath);
          return { name: f, sizeBytes: stats.size };
        })
    );
    jsonFiles.sort((a, b) => a.name.localeCompare(b.name));
    return c.json(jsonFiles);
  } catch (err) {
    console.error('List setup files error:', err);
    return c.json({ error: 'Failed to list setup files' }, 500);
  }
});

setup.get('/files/:filename', requireSuperAdmin, async (c) => {
  try {
    const filename = c.req.param('filename');
    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400);
    }
    const fullPath = join(config.setupDir, filename);

    // Proper containment check: startsWith would also accept sibling
    // directories named setup_* (e.g. ../setup_evil/foo.json normalises to
    // outside the setup dir but still starts with it).
    const rel = relative(config.setupDir, fullPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    const content = await readFile(fullPath, 'utf-8');
    const parsed = JSON.parse(content);
    return c.json({ data: Array.isArray(parsed) ? parsed : [parsed] });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return c.json({ error: 'File not found' }, 404);
    }
    console.error('Read setup file error:', err);
    return c.json({ error: 'Failed to read file' }, 500);
  }
});

export { setup };
