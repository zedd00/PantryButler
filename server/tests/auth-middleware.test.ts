import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

vi.mock('../src/db/pool', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (fn: (client: never) => unknown) =>
    fn({ query: async () => ({ rows: [], rowCount: 0 }) } as never)),
}));

import { query } from '../src/db/pool';
import { config } from '../src/utils/config';
import { hashSecret, generateApiToken } from '../src/utils/tokens';
import {
  requireAuth,
  requireJwt,
  requireApiToken,
  requireScope,
  requireResourceScope,
} from '../src/middleware/auth';

const mockQuery = vi.mocked(query);

function makeApp(): Hono {
  const app = new Hono();
  const handler = (c: any) =>
    c.json({ userId: c.get('userId'), email: c.get('userEmail'), authType: c.get('authType'), scopes: c.get('scopes') });
  app.get('/protected', requireAuth, handler);
  app.post('/protected', requireAuth, handler);
  return app;
}

function makeGatedApp(): Hono {
  const app = new Hono();
  app.get('/jwt-only', requireAuth, requireJwt, (c) => c.json({ ok: true }));
  app.get('/token-only', requireAuth, requireApiToken, (c) => c.json({ ok: true }));
  app.get('/scope', requireAuth, requireScope('recipes:read'), (c) => c.json({ ok: true }));
  app.get('/resource', requireAuth, requireResourceScope('recipes'), (c) => c.json({ ok: true }));
  app.post('/resource', requireAuth, requireResourceScope('recipes'), (c) => c.json({ ok: true }));
  return app;
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('requireAuth — JWT path', () => {
  it('accepts a valid JWT for an existing user', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never);
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ userId: 'user-1', email: 'a@b.c', authType: 'jwt' });
  });

  it('rejects a JWT carrying a stale jwt_version (revoked after password change)', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 2 }] } as never);
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c', jwtVersion: 1 }, config.jwtSecret);
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a JWT issued before jwt_version existed', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 1 }] } as never);
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c' }, config.jwtSecret);
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a missing or malformed header', async () => {
    const app = makeApp();
    expect((await app.request('/protected')).status).toBe(401);
    expect((await app.request('/protected', { headers: { Authorization: 'Basic xyz' } })).status).toBe(401);
  });

  it('rejects a JWT for a user that no longer exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const token = jwt.sign({ userId: 'ghost', email: 'a@b.c' }, config.jwtSecret);
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a tampered / invalid JWT', async () => {
    const res = await makeApp().request('/protected', {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.notvalid.sig' },
    });
    expect(res.status).toBe(401);
  });
});

describe('requireAuth — API token path', () => {
  const instanceId = '11111111-1111-1111-1111-111111111111';

  function validTokenRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tok-1',
      user_id: 'user-1',
      instance_id: instanceId,
      scopes: ['recipes:read'],
      expires_at: null,
      revoked_at: null,
      email: 'a@b.c',
      ...overrides,
    };
  }

  it('accepts a valid, active token and stamps context', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [validTokenRow()] } as never) // token lookup
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', instance_id: instanceId }] } as never) // membership
      .mockResolvedValueOnce({ rows: [] } as never); // last_used update
    const { token } = generateApiToken();
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ userId: 'user-1', email: 'a@b.c', authType: 'token', scopes: ['recipes:read'] });
    expect(mockQuery.mock.calls.some((c) => /last_used_at/.test(String(c[0])))).toBe(true);
  });

  it('rejects an unknown token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const { token } = generateApiToken();
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a revoked token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [validTokenRow({ revoked_at: '2026-08-01T00:00:00Z' })] } as never);
    const { token } = generateApiToken();
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [validTokenRow({ expires_at: '2020-01-01T00:00:00Z' })] } as never);
    const { token } = generateApiToken();
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a token whose user lost instance membership', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [validTokenRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // membership empty
    const { token } = generateApiToken();
    const res = await makeApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });

  it('rejects a request whose query instance_id differs from the bound instance', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [validTokenRow()] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', instance_id: instanceId }] } as never);
    const { token } = generateApiToken();
    const other = '22222222-2222-2222-2222-222222222222';
    const res = await makeApp().request(`/protected?instance_id=${other}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('allows a matching query instance_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [validTokenRow()] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', instance_id: instanceId }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { token } = generateApiToken();
    const res = await makeApp().request(`/protected?instance_id=${instanceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('rejects a request whose JSON body instance_id differs from the bound instance', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [validTokenRow()] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', instance_id: instanceId }] } as never);
    const { token } = generateApiToken();
    const other = '22222222-2222-2222-2222-222222222222';
    const res = await makeApp().request('/protected', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: other }),
    });
    expect(res.status).toBe(403);
  });
});

describe('auth gates', () => {
  it('requireJwt rejects token callers', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['all'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never);
    const { token } = generateApiToken();
    const res = await makeGatedApp().request('/jwt-only', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });

  it('requireJwt accepts JWT callers', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never);
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c' }, config.jwtSecret);
    const res = await makeGatedApp().request('/jwt-only', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });

  it('requireApiToken rejects JWT callers', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never);
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c' }, config.jwtSecret);
    const res = await makeGatedApp().request('/token-only', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });

  it('requireApiToken accepts token callers', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['all'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { token } = generateApiToken();
    const res = await makeGatedApp().request('/token-only', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });

  it('requireScope allows a token holding the required scope', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['recipes:read'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { token } = generateApiToken();
    const res = await makeGatedApp().request('/scope', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });

  it('requireScope denies a token lacking the required scope', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['pantry:read'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never);
    const { token } = generateApiToken();
    const res = await makeGatedApp().request('/scope', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
  });

  it('requireResourceScope grants GET with recipes:read but denies POST', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['recipes:read'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { token } = generateApiToken();
    const getRes = await makeGatedApp().request('/resource', { headers: { Authorization: `Bearer ${token}` } });
    expect(getRes.status).toBe(200);

    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['recipes:read'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never);
    const postRes = await makeGatedApp().request('/resource', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(postRes.status).toBe(403);
  });

  it('requireResourceScope lets an "all" token write', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: 'u', instance_id: 'i', scopes: ['all'], email: 'x@y.z' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: 'u', instance_id: 'i' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { token } = generateApiToken();
    const res = await makeGatedApp().request('/resource', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('requireResourceScope never blocks JWT callers', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never);
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c' }, config.jwtSecret);
    const app = makeGatedApp();
    const getRes = await app.request('/resource', { headers: { Authorization: `Bearer ${token}` } });
    expect(getRes.status).toBe(200);
    const postRes = await app.request('/resource', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(postRes.status).toBe(200);
  });
});
