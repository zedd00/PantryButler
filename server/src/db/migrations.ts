import { createHash } from 'crypto';
import { pool } from './pool';

export const MIGRATIONS: string[] = [
  // handle_new_user: creator of a new instance is its first member, so make them admin.
  // (Previously only the first system-wide user became admin/superadmin.)
  `CREATE OR REPLACE FUNCTION handle_new_user(
    p_user_id UUID,
    p_email TEXT,
    p_instance_name TEXT DEFAULT NULL
  )
  RETURNS UUID
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    user_instance_id UUID;
    user_instance_name TEXT;
    is_first_user BOOLEAN;
    v_username TEXT;
  BEGIN
    v_username := SPLIT_PART(p_email, '@', 1);

    IF p_instance_name IS NULL THEN
      user_instance_name := 'Kitchen ' || v_username;
    ELSE
      user_instance_name := p_instance_name;
    END IF;

    INSERT INTO instances (name, created_by)
    VALUES (user_instance_name, p_user_id)
    RETURNING id INTO user_instance_id;

    -- First user in the whole system is superadmin
    SELECT NOT EXISTS (
      SELECT 1 FROM profiles
    ) INTO is_first_user;

    INSERT INTO profiles (id, email, username, display_name, role, instance_id)
    VALUES (
      p_user_id, p_email, v_username, v_username,
      CASE WHEN is_first_user THEN 'superadmin'::user_role ELSE 'admin'::user_role END,
      user_instance_id
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO instance_members (instance_id, user_id, role, can_edit_calendar)
    VALUES (user_instance_id, p_user_id, 'admin', true)
    ON CONFLICT (instance_id, user_id) DO NOTHING;

    INSERT INTO settings (instance_id, preferred_unit_system, dark_mode, vibrant_mode, nutrition_enabled)
    VALUES (user_instance_id, 'metric', false, false, true)
    ON CONFLICT (instance_id) DO NOTHING;

    RETURN user_instance_id;
  END;
  $$;`,
  // Cost tracking: pantry items can carry the total price paid for their current amount.
  'ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS price NUMERIC;',
  // Cost tracking: pantry items can record the size (in the item's unit) that `price` covers.
  'ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS price_size NUMERIC;',
  // Cost tracking: per-instance global currency + display toggle.
  'ALTER TABLE settings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT \'USD\';',
  'ALTER TABLE settings ADD COLUMN IF NOT EXISTS cost_tracking_enabled BOOLEAN NOT NULL DEFAULT true;',
  // API access: long-lived tokens for extensions / mobile apps.
  // token_hash is SHA-256 of the `pb_` secret; the plaintext is never stored.
  `CREATE TABLE IF NOT EXISTS api_tokens (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instance_id       UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    token_hash        TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    scopes            TEXT[] NOT NULL DEFAULT '{all}',
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_from_ip   TEXT,
    last_used_at      TIMESTAMPTZ,
    last_used_ip      TEXT,
    revoked_at        TIMESTAMPTZ,
    revoked_reason    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);`,
  // OAuth client registry (seeded from config at startup).
  `CREATE TABLE IF NOT EXISTS oauth_clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    redirect_uri    TEXT NOT NULL,
    default_scopes  TEXT[] NOT NULL DEFAULT '{}',
    is_dev          BOOLEAN NOT NULL DEFAULT FALSE
  );`,
  // One-time authorization codes (hashed); bound to user, instance, client.
  `CREATE TABLE IF NOT EXISTS oauth_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       TEXT NOT NULL REFERENCES oauth_clients(client_id),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instance_id     UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    redirect_uri    TEXT NOT NULL,
    code_hash       TEXT NOT NULL UNIQUE,
    scope           TEXT[] NOT NULL,
    code_challenge  TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_oauth_codes_hash ON oauth_codes(code_hash);`,
  // Red-team hardening: jwt_version lets the server revoke previously-issued
  // JWTs (e.g. after a password change) by rejecting tokens carrying a stale
  // version.
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS jwt_version INTEGER NOT NULL DEFAULT 0;',
  // Red-team hardening: uploaded files are recorded with their uploader so
  // deletes can be scoped to the owning user (prevents cross-user deletion).
  `CREATE TABLE IF NOT EXISTS user_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path        TEXT NOT NULL UNIQUE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_user_files_user ON user_files(user_id);`,
  // Red-team hardening: per-user OAuth consent. Absence of a row means the
  // SPA must ask for approval before /oauth/authorize can mint a code.
  `CREATE TABLE IF NOT EXISTS oauth_consents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id   TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
  );`,
  // Red-team hardening: instance_members.can_edit_calendar should only default
  // true for editor roles. Flip the column default and backfill existing rows
  // (viewers lose calendar editing; admin/user retain it).
  `ALTER TABLE instance_members ALTER COLUMN can_edit_calendar SET DEFAULT false;`,
  `UPDATE instance_members
   SET can_edit_calendar = (role IN ('admin', 'user'))
   WHERE can_edit_calendar = true AND role = 'viewer';`,
  // Red-team hardening: promote_last_user_to_admin fired on every
  // instance_members delete and, when the instance was left with a single
  // member, set that member's *global* profile role to 'admin' — silently
  // demoting a system superadmin who ended up as the last member of an
  // instance. Promotion is fine; demotion of a superadmin is not.
  `CREATE OR REPLACE FUNCTION promote_last_user_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_count INTEGER;
  remaining_user_id UUID;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM instance_members
  WHERE instance_id = OLD.instance_id;

  IF remaining_count = 1 THEN
    SELECT user_id INTO remaining_user_id
    FROM instance_members
    WHERE instance_id = OLD.instance_id
    LIMIT 1;

    UPDATE instance_members
    SET role = 'admin'
    WHERE instance_id = OLD.instance_id AND user_id = remaining_user_id;

    UPDATE profiles
    SET role = 'admin'::user_role
    WHERE id = remaining_user_id
      AND role <> 'superadmin';
  END IF;

  RETURN OLD;
END;
$$;`,
  // Grocery list: record the servings a recipe was added for, so the
  // consolidated list can scale ingredient quantities to match what the
  // user selected (NULL falls back to the recipe's own servings).
  'ALTER TABLE grocery_list_recipes ADD COLUMN IF NOT EXISTS servings INTEGER;',
  // Email verification for instance creators: users track whether their email
  // has been confirmed and the kitchen name intended at registration (instance
  // creation is deferred until verification when the feature is enabled).
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_instance_name TEXT;',
  // Existing accounts predate verification — treat them as already verified so
  // enabling the feature never locks anyone out.
  'UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;',
  // One-time verification tokens (SHA-256 of the raw secret).
  `CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);`,
  // Global superadmin-editable application config (email verification + SMTP).
  `CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
];

export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Track which migrations have been applied (name + content hash + time) so
    // the server skips work already done and can detect edits to applied SQL.
    // Existing deployments re-apply everything on the first tracked run; every
    // migration is idempotent (CREATE OR REPLACE / IF NOT EXISTS / guarded
    // UPDATE), so that is safe.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        hash       TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query('SELECT name, hash FROM schema_migrations');
    const applied = new Map<string, string>();
    for (const row of appliedResult.rows) applied.set(row.name, row.hash);

    for (let i = 0; i < MIGRATIONS.length; i++) {
      const name = `migration_${i}`;
      const sql = MIGRATIONS[i];
      const hash = migrationHash(sql);

      if (applied.has(name)) {
        if (applied.get(name) !== hash) {
          throw new Error(`Migration ${name} has been modified after it was applied; refusing to run.`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, hash) VALUES ($1, $2)', [name, hash]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('Database migrations applied successfully.');
  } finally {
    client.release();
  }
}

export function migrationHash(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}
