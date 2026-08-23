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
import { tokens } from '../src/routes/tokens';
import { hashSecret } from '../src/utils/tokens';

const mockQuery = vi.mocked(query);
const instanceId = '11111111-1111-1111-1111-111111111111';
const userId = 'user-1';
const jwtToken = jwt.sign({ userId, email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
const authHeader = { Authorization: `Bearer ${jwtToken}` };

beforeEach(() => {
  mockQuery.mockReset();
});

describe('POST /tokens — mint', () => {
  const baseBody = { instance_id: instanceId, name: 'My device', scopes: ['recipes:read'], expires_at: undefined };

  it('mints a token for a member and returns plaintext once', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never) // jwt user exists
      .mockResolvedValueOnce({ rows: [{ instance_id: instanceId, role: 'user' }] } as never) // membership
      .mockResolvedValueOnce({ rows: [{ id: instanceId }] } as never) // instance exists
      .mockResolvedValueOnce({ rows: [{ id: 'tok-new', name: 'My device' }] } as never); // insert

    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.token).toMatch(/^pb_/);
    expect(body.id).toBe('tok-new');
    // insert received the SHA-256 hash, not the plaintext
    const insertCall = mockQuery.mock.calls[3];
    expect(insertCall[0]).toMatch(/INSERT INTO api_tokens/);
    expect(insertCall[1][2]).toBe(hashSecret(body.token));
    expect(insertCall[1][2]).not.toBe(body.token);
  });

  it('rejects a non-member', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never) // jwt user exists
      .mockResolvedValueOnce({ rows: [] } as never) // not a member
      .mockResolvedValueOnce({ rows: [] } as never); // not superadmin either
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(res.status).toBe(403);
  });

  it('lets a JWT caller mint any valid scope (web sessions are all-access)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ instance_id: instanceId, role: 'user' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: instanceId }] } as never) // instance exists
      .mockResolvedValueOnce({ rows: [{ id: 'tok-new' }] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId, name: 'x', scopes: ['settings:write'] }),
    });
    expect(res.status).toBe(201);
  });

  it('returns 404 for a nonexistent instance even for a superadmin', async () => {
    const bogus = '99999999-9999-9999-9999-999999999999';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never) // jwt user exists
      .mockResolvedValueOnce({ rows: [] } as never) // not a member of bogus
      .mockResolvedValueOnce({ rows: [{ role: 'superadmin' }] } as never) // superadmin bypass
      .mockResolvedValueOnce({ rows: [] } as never); // instance does not exist
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: bogus, name: 'x' }),
    });
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error).toBe('Instance not found');
  });

  it('accepts the exact payload shape the Settings UI sends (full-access + ISO expiry)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never) // jwt user exists
      .mockResolvedValueOnce({ rows: [{ instance_id: instanceId, role: 'user' }] } as never) // membership
      .mockResolvedValueOnce({ rows: [{ id: instanceId }] } as never) // instance exists
      .mockResolvedValueOnce({ rows: [{ id: 'tok-ui' }] } as never); // insert

    // The ApiTokensCard sends scopes: ['all'] and a toISOString() expires_at.
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: instanceId,
        name: 'Firefox extension',
        scopes: ['all'],
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.id).toBe('tok-ui');
    expect(body.token).toMatch(/^pb_/);

    const insertCall = mockQuery.mock.calls[3];
    // scopes persisted as ['all'], expiry passed through as a valid date string
    expect(insertCall[1][4]).toEqual(['all']);
    expect(typeof insertCall[1][5]).toBe('string');
    expect(Number.isNaN(Date.parse(insertCall[1][5]))).toBe(false);
  });

  it('rejects an expires_at in the past', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ instance_id: instanceId, role: 'user' }] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: instanceId,
        name: 'x',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown scopes entirely', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ instance_id: instanceId, role: 'user' }] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId, name: 'x', scopes: ['bogus:read'] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid instance uuid', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never); // jwt user exists
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: 'not-a-uuid', name: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an expires_at beyond the max TTL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ instance_id: instanceId, role: 'user' }] } as never);
    const farFuture = new Date(Date.now() + config.apiTokenMaxTtlMs * 2).toISOString();
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId, name: 'x', expires_at: farFuture }),
    });
    expect(res.status).toBe(400);
  });

  it('blocks token callers from minting (requireJwt)', async () => {
    // token caller: user exists check is bypassed; authType token via token path
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: userId, instance_id: instanceId, scopes: ['all'], email: 'a@b.c' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: userId, instance_id: instanceId }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // last_used update

    const { generateApiToken } = await import('../src/utils/tokens');
    const { token } = generateApiToken();
    const res = await new Hono().route('/tokens', tokens).request('/tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /tokens — list', () => {
  it('lists all tokens for a JWT caller', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens', { headers: authHeader });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveLength(2);
    expect(mockQuery.mock.calls[1][0]).toMatch(/FROM api_tokens WHERE user_id/);
  });

  it('returns only its own record for a token caller', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: userId, instance_id: instanceId, scopes: ['all'], email: 'a@b.c' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: userId, instance_id: instanceId }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // last_used update
      .mockResolvedValueOnce({ rows: [{ id: 't' }] } as never); // self-inspection select

    const { generateApiToken } = await import('../src/utils/tokens');
    const { token } = generateApiToken();
    const res = await new Hono().route('/tokens', tokens).request('/tokens', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.id).toBe('t');
    expect(mockQuery.mock.calls[3][0]).toMatch(/FROM api_tokens WHERE id = \$\d/);
  });
});

describe('DELETE /tokens/:id — revoke single', () => {
  it('revokes an owned token', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never) // jwt
      .mockResolvedValueOnce({ rows: [{ id: 'tok-9', user_id: userId, scopes: ['all'] }] } as never) // existing
      .mockResolvedValueOnce({ rows: [] } as never); // update
    const res = await new Hono().route('/tokens', tokens).request('/tokens/tok-9', { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(200);
    expect(String(mockQuery.mock.calls[2][0])).toMatch(/UPDATE api_tokens SET revoked_at/);
  });

  it('returns 404 for a missing token', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens/tok-nope', { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(404);
  });

  it('forbids revoking another user\u2019s token', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 'tok-9', user_id: 'someone-else', scopes: ['all'] }] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens/tok-9', { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(403);
  });

  it('lets a token revoke itself (extension Disconnect / self-revocation)', async () => {
    const { generateApiToken } = await import('../src/utils/tokens');
    const { token } = generateApiToken();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: userId, instance_id: instanceId, scopes: ['all'], email: 'a@b.c' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: userId, instance_id: instanceId }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // last_used update
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: userId, scopes: ['all'] }] } as never) // existing (itself)
      .mockResolvedValueOnce({ rows: [] } as never); // update
    const res = await new Hono().route('/tokens', tokens).request('/tokens/t', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const updateCall = mockQuery.mock.calls[4];
    expect(String(updateCall[0])).toMatch(/UPDATE api_tokens SET revoked_at/);
    expect(updateCall[1][1]).toBe('t');
  });

  it('forbids a token revoking a sibling token', async () => {
    const { generateApiToken } = await import('../src/utils/tokens');
    const { token } = generateApiToken();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 't', user_id: userId, instance_id: instanceId, scopes: ['all'], email: 'a@b.c' }] } as never)
      .mockResolvedValueOnce({ rows: [{ user_id: userId, instance_id: instanceId }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // last_used update
      .mockResolvedValueOnce({ rows: [{ id: 'other-token', user_id: userId, scopes: ['all'] }] } as never); // existing (sibling)
    const res = await new Hono().route('/tokens', tokens).request('/tokens/other-token', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /tokens — revoke all (JWT only)', () => {
  it('revokes all of the caller\u2019s tokens', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: userId, jwt_version: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const res = await new Hono().route('/tokens', tokens).request('/tokens', { method: 'DELETE', headers: authHeader });
    expect(res.status).toBe(200);
    expect(String(mockQuery.mock.calls[1][0])).toMatch(/WHERE user_id = \$\d/);
  });
});
