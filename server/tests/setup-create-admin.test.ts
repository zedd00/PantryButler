import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock, clientQueryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  clientQueryMock: vi.fn(),
}));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(async (fn) => fn({ query: clientQueryMock })),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() },
}));

import { buildApp } from '../src/index';

function postCreateAdmin(email: string, password = 'supersecret1') {
  return buildApp().request('/api/setup/create-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

beforeEach(() => {
  queryMock.mockReset();
  clientQueryMock.mockReset();
  clientQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('POST /api/setup/create-admin bootstrap hardening', () => {
  it('refuses once any profile exists (bootstrap already complete)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
    const res = await postCreateAdmin('root@example.com');
    expect(res.status).toBe(400);
    expect(clientQueryMock).not.toHaveBeenCalled();
  });

  it('creates the user and superadmin profile in one transaction on a fresh install', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] } as never); // guard counts profiles
    clientQueryMock.mockImplementation(async (sql: unknown) => {
      if (String(sql).includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await postCreateAdmin('root@example.com');
    expect(res.status).toBe(200);

    const sqls = clientQueryMock.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('INSERT INTO users'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO profiles') && s.includes("'superadmin'"))).toBe(
      true
    );
  });

  it('claims a dormant unverified account holding the same email instead of colliding', async () => {
    // Regression: a registered-but-never-verified user (no profile) used to
    // wedge first-boot setup — the old guard counted users and blocked
    // create-admin forever, leaving the instance unbootstrappable.
    queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] } as never);
    clientQueryMock.mockImplementation(async (sql: unknown) => {
      if (String(sql).includes('SELECT id FROM users WHERE email')) {
        return { rows: [{ id: 'dormant-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await postCreateAdmin('dormant@example.com');
    expect(res.status).toBe(200);

    const sqls = clientQueryMock.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('UPDATE users SET password_hash'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO users'))).toBe(false);
    expect(sqls.some((s) => s.includes('INSERT INTO profiles') && s.includes("'superadmin'"))).toBe(
      true
    );
  });

  it('still creates a brand-new user when no dormant row holds the email', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] } as never);
    clientQueryMock.mockImplementation(async (sql: unknown) => {
      if (String(sql).includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-new' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await postCreateAdmin('fresh@example.com');
    expect(res.status).toBe(200);

    const sqls = clientQueryMock.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('INSERT INTO users'))).toBe(true);
    expect(sqls.some((s) => s.includes('UPDATE users SET password_hash'))).toBe(false);
  });
});
