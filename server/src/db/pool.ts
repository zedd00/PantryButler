import pg from 'pg';
import { config } from '../utils/config';
import { logError, scrubSecret } from '../utils/log';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logError('Unexpected database pool error', err);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    // eslint-disable-next-line no-console
    console.warn(`Slow query (${duration}ms):`, scrubSecret(text.substring(0, 100)));
  }
  return result;
}

// Runs fn inside a transaction. Multi-statement writes that must succeed or
// fail together (e.g. bootstrap creating a user plus its profile) go through
// this, so a mid-flight failure can never leave half-created rows behind.
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
