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
import { oauth } from '../src/routes/oauth';
import { generateApiToken, generateAuthCode, sha256Hex } from '../src/utils/tokens';
import { hashSecret } from '../src/utils/tokens';

const mockQuery = vi.mocked(query);

const instanceId = '11111111-1111-1111-1111-111111111111';
const userId = 'user-1';
const CLIENT_ID = 'android';
const REDIRECT = 'pantrybutler://oauth/callback';

// A valid client row as getOAuthClient would return (from pool query).
const androidClientRow = {
  client_id: CLIENT_ID,
  name: 'Android',
  redirect_uri: REDIRECT,
  is_dev: false,
  default_scopes: 'all',
};

const clientRowQuery = () =>
  mockQuery.mockImplementationOnce(async (sql: string, params: any[]) => {
    if (String(sql).includes('oauth_clients')) {
      return { rows: [androidClientRow] };
    }
    return { rows: [] };
  });

function jwtCookieHeader() {
  const token = jwt.sign({ userId, email: 'a@b.c' }, config.jwtSecret);
  return { Cookie: `pb_session=${token}` };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /oauth/authorize', () => {
  const validChallenge = 'e0ZmbW5hcXFqbHkwcXYzZmF0dnpzc3ZobXdkeGhrZWg=';
  const baseParams = `response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${validChallenge}&code_challenge_method=S256&state=xyz`;

  it('redirects to login when no session cookie', async () => {
    clientRowQuery();
    const res = await new Hono().route('/oauth', oauth).request(`/oauth/authorize?${baseParams}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('rejects an unknown client', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const res = await new Hono().route('/oauth', oauth).request(
      `/oauth/authorize?response_type=code&client_id=nope&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${validChallenge}&code_challenge_method=S256`
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('rejects a redirect_uri that does not match the registered client', async () => {
    clientRowQuery();
    const res = await new Hono().route('/oauth', oauth).request(
      `/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent('https://evil.example/cb')}&code_challenge=${validChallenge}&code_challenge_method=S256`
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'redirect_uri mismatch' });
  });

  it('rejects an unsupported code_challenge_method (PKCE S256 only)', async () => {
    clientRowQuery();
    const res = await new Hono().route('/oauth', oauth).request(
      `/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${validChallenge}&code_challenge_method=plain`
    );
    expect(res.status).toBe(400);
  });

  it('issues a code redirecting to the client redirect_uri when session is valid', async () => {
    clientRowQuery();
    // profile lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId, instance_id: instanceId, jwt_version: 0 }] } as never);
    // consent already granted
    mockQuery.mockResolvedValueOnce({ rows: [{ granted: true }] } as never);
    // oauth_codes insert
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    const res = await new Hono().route('/oauth', oauth).request(`/oauth/authorize?${baseParams}`, {
      headers: jwtCookieHeader(),
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location')!;
    expect(loc.startsWith(REDIRECT)).toBe(true);
    const url = new URL(loc);
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // code stored as SHA-256 hash, scopes bounded to the client default
    const insertCall = mockQuery.mock.calls[3];
    expect(String(insertCall[0])).toMatch(/INSERT INTO oauth_codes/);
    const storedCode = insertCall[1][4];
    expect(storedCode).toBe(hashSecret(url.searchParams.get('code')));
  });

  it('redirects to the SPA consent page when the user has not approved the client', async () => {
    clientRowQuery();
    // profile lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId, instance_id: instanceId, jwt_version: 0 }] } as never);
    // consent lookup -> none granted
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    const res = await new Hono().route('/oauth', oauth).request(`/oauth/authorize?${baseParams}`, {
      headers: jwtCookieHeader(),
    });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/oauth/consent');
    expect(loc.searchParams.get('client_id')).toBe(CLIENT_ID);
    // the full authorize URL is carried back so the flow resumes
    expect(loc.searchParams.get('redirect')).toContain('/oauth/authorize');
  });

  it('requires the user to have an active instance', async () => {
    clientRowQuery();
    mockQuery.mockResolvedValueOnce({ rows: [{ id: userId, instance_id: null, jwt_version: 0 }] } as never);
    const res = await new Hono().route('/oauth', oauth).request(`/oauth/authorize?${baseParams}`, {
      headers: jwtCookieHeader(),
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /oauth/consent', () => {
  it('requires an authenticated web session', async () => {
    const res = await new Hono().route('/oauth', oauth).request('/oauth/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('records consent for a known client', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never); // requireAuth users lookup
    mockQuery.mockResolvedValueOnce({ rows: [androidClientRow] } as never); // client lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c' }] } as never); // insert

    const token = jwt.sign({ userId, email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client_id: CLIENT_ID }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });

    const insertCall = mockQuery.mock.calls[2];
    expect(String(insertCall[0])).toMatch(/INSERT INTO oauth_consents/);
  });

  it('rejects an unknown client', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never); // requireAuth users lookup
    mockQuery.mockResolvedValueOnce({ rows: [] } as never); // client lookup

    const token = jwt.sign({ userId, email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client_id: 'nope' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_client' });
  });
});

describe('POST /oauth/token', () => {
  // RFC 7636 test vector: verifier -> S256 challenge
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = Buffer.from(sha256Hex(verifier), 'hex').toString('base64url');
  const client = androidClientRow;
  const code = 'abcd1234abcd1234abcd1234abcd1234abcd12345';

  function mockExchangeCode(recordOverrides: Record<string, unknown> = {}) {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: CLIENT_ID, redirect_uri: REDIRECT, user_id: userId, instance_id: instanceId, scope: ['recipes:read', 'pantry:read'], code_challenge: challenge, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null, ...recordOverrides }] } as never) // lookup
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }] } as never) // atomic consume
      .mockResolvedValueOnce({ rows: [androidClientRow] } as never) // client for name
      .mockResolvedValueOnce({ rows: [{ id: 'tok-minted' }] } as never); // insert api token
  }

  const baseBody = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  };

  it('exchanges a valid code for a pb_ access token', async () => {
    mockExchangeCode();
    const res = await new Hono().route('/oauth', oauth).request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.access_token).toMatch(/^pb_/);
    expect(body.token_type).toBe('Bearer');
    expect(body.scope).toBe('recipes:read pantry:read');
  });

  it('rejects a used (already-exchanged) code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: CLIENT_ID, redirect_uri: REDIRECT, user_id: userId, instance_id: instanceId, scope: ['all'], code_challenge: challenge, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: '2026-08-01T00:00:00Z' }] } as never);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('rejects a code bound to a different client', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: 'ios', redirect_uri: REDIRECT, user_id: userId, instance_id: instanceId, scope: ['all'], code_challenge: challenge, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null }] } as never);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a mismatched redirect_uri', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: CLIENT_ID, redirect_uri: 'pantrybutler://oauth/callback', user_id: userId, instance_id: instanceId, scope: ['all'], code_challenge: challenge, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null }] } as never);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseBody, redirect_uri: 'https://evil.example/cb' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: CLIENT_ID, redirect_uri: REDIRECT, user_id: userId, instance_id: instanceId, scope: ['all'], code_challenge: challenge, expires_at: '2020-01-01T00:00:00Z', used_at: null }] } as never);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a wrong PKCE verifier', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: CLIENT_ID, redirect_uri: REDIRECT, user_id: userId, instance_id: instanceId, scope: ['all'], code_challenge: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f', expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null }] } as never);
    const res = await new Hono().route('/oauth', oauth).request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseBody, code_verifier: 'WRONGverifierWRONGverifierWRONGverifierWRONG12345' }),
    });
    expect(res.status).toBe(400);
  });

  it('consumes the code exactly once even under a double exchange', async () => {
    // first exchange succeeds
    mockExchangeCode();
    const app = new Hono().route('/oauth', oauth);
    const first = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(first.status).toBe(200);

    // second attempt: record now shows used_at set
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'c1', client_id: CLIENT_ID, redirect_uri: REDIRECT, user_id: userId, instance_id: instanceId, scope: ['all'], code_challenge: challenge, expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: '2026-08-01T00:00:00Z' }] } as never);
    const second = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    expect(second.status).toBe(400);
  });
});
