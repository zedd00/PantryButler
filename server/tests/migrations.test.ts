import { describe, it, expect, vi, beforeEach } from 'vitest';

const { connectMock, clientQueryMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  clientQueryMock: vi.fn(),
}));

vi.mock('../src/db/pool', () => ({
  pool: {
    connect: connectMock.mockImplementation(() =>
      Promise.resolve({ query: clientQueryMock, release: vi.fn() })
    ),
  },
  query: vi.fn(),
}));

import { runMigrations, MIGRATIONS, migrationHash } from '../src/db/migrations';

beforeEach(() => {
  clientQueryMock.mockReset();
  clientQueryMock.mockResolvedValue({ rows: [] } as never);
});

describe('runMigrations tracking', () => {
  it('creates the tracking table and records every migration once', async () => {
    await runMigrations();

    const sqlCalls = clientQueryMock.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS schema_migrations'))).toBe(true);
    expect(sqlCalls.some((s) => s.includes('SELECT name, hash FROM schema_migrations'))).toBe(true);

    const begins = sqlCalls.filter((s) => s === 'BEGIN').length;
    const inserts = sqlCalls.filter((s) => s.includes('INSERT INTO schema_migrations')).length;
    const commits = sqlCalls.filter((s) => s === 'COMMIT').length;

    expect(begins).toBe(MIGRATIONS.length);
    expect(inserts).toBe(MIGRATIONS.length);
    expect(commits).toBe(MIGRATIONS.length);
  });

  it('skips migrations that are already applied with an unchanged hash', async () => {
    const rows = MIGRATIONS.map((sql, i) => ({ name: `migration_${i}`, hash: migrationHash(sql) }));
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT name, hash FROM schema_migrations')) {
        return Promise.resolve({ rows });
      }
      return Promise.resolve({ rows: [] });
    });

    await runMigrations();

    const sqlCalls = clientQueryMock.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.filter((s) => s === 'BEGIN').length).toBe(0);
    expect(sqlCalls.filter((s) => s.includes('INSERT INTO schema_migrations')).length).toBe(0);
  });

  it('refuses to run when an applied migration was modified', async () => {
    const rows = [
      { name: 'migration_0', hash: 'stale-hash' },
      ...MIGRATIONS.slice(1).map((sql, i) => ({ name: `migration_${i + 1}`, hash: migrationHash(sql) })),
    ];
    clientQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT name, hash FROM schema_migrations')) {
        return Promise.resolve({ rows });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(runMigrations()).rejects.toThrow(/migration_0 has been modified/);
  });
});