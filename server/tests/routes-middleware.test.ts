import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(
    async (fn: (client: { query: typeof queryMock }) => unknown) => fn({ query: queryMock })
  ),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() },
}));

import jwt from 'jsonwebtoken';
import { config } from '../src/utils/config';
import { buildApp } from '../src/index';

const mockQuery = queryMock;

function superToken(userId = 'user-1'): string {
  return jwt.sign({ userId, email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('L1: trailing-slash normalization on /api/*', () => {
  it('redirects GET /api/recipes/ to /api/recipes with 308', async () => {
    const res = await buildApp().request('/api/recipes/');
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get('location') as string).pathname).toBe('/api/recipes');
  });

  it('redirects POST /api/recipes/ preserving the method (308, not 303)', async () => {
    const res = await buildApp().request('/api/recipes/', { method: 'POST', body: '{}' });
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get('location') as string).pathname).toBe('/api/recipes');
  });

  it('leaves canonical paths untouched', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ok: 1 }] } as never);
    const res = await buildApp().request('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('L3: profile update rejects unexpected fields', () => {
  it('rejects a role-escalation attempt with 400 instead of ignoring it', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never);
    const res = await buildApp().request('/api/profiles/user-1', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${superToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'superadmin' }),
    });
    expect(res.status).toBe(400);
  });

  it('still accepts the allowed fields', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', jwt_version: 0 }] } as never) // auth lookup
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', display_name: 'Renamed' }] } as never); // update
    const res = await buildApp().request('/api/profiles/user-1', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${superToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ display_name: 'Renamed' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('M1: registration rate limit', () => {
  it('throttles rapid registrations after the per-IP budget', async () => {
    const app = buildApp();
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM users')) return { rows: [] } as never;
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'u1', email: 'a@b.c', created_at: 'now', jwt_version: 0 }] } as never;
      }
      return { rows: [] } as never;
    });

    const attempt = (email: string) =>
      app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });

    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      lastStatus = (await attempt(`mass${i}@test.local`)).status;
    }
    expect(lastStatus).toBe(429);
  }, 20000);
});

describe('#4: /setup/* seed-file server is closed once users exist', () => {
  it('returns the gate 404 once users exist', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '2' }] } as never);
    const res = await buildApp().request('/setup/nutrition_foods.json');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('#5: /oauth/token hides validation details', () => {
  it('returns a generic invalid_request instead of field-level zod errors', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = await buildApp().request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
    expect(JSON.stringify(body)).not.toContain('grant_type');
  });
});

describe('#8: setup file path traversal containment', () => {
  it('rejects a traversal filename escaping the setup dir', async () => {
    mockQuery.mockResolvedValue({ rows: [{ role: 'superadmin', jwt_version: 0 }] } as never);
    const res = await buildApp().request('/api/setup/files/..%2Fsetup_evil%2Fx.json', {
      headers: { Authorization: `Bearer ${superToken()}` },
    });
    expect(res.status).toBe(400);
  });
});

describe('request body size limit', () => {
  it('rejects oversized request bodies with 413 before parsing', async () => {
    const big = JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(11 * 1024 * 1024) });
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    expect(res.status).toBe(413);
  });

  it('still accepts normal-sized bodies', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(401); // unknown user
  });
});

describe('embed CORS: public endpoints are open to any origin', () => {
  it('GET /api/recipes/public/:slug returns Access-Control-Allow-Origin: *', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = await buildApp().request('/api/recipes/public/does-not-exist', {
      headers: { origin: 'https://example-blog.com' },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    // Credentialed routes must NOT broaden their origin.
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('GET /api/images/proxy returns Access-Control-Allow-Origin: * even on validation errors', async () => {
    const res = await buildApp().request('/api/images/proxy', {
      headers: { origin: 'https://example-blog.com' },
    });
    expect(res.status).toBe(400); // missing ?url= fails zod validation, no network call
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('authenticated API still reflects the configured corsOrigin only', async () => {
    const res = await buildApp().request('/api/recipes?instance_id=inst-1', {
      headers: { origin: 'https://example-blog.com', Authorization: `Bearer ${superToken()}` },
    });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });
});

describe('malformed JSON bodies are rejected cleanly', () => {
  it('returns 400 (not a generic 500) for syntactically invalid JSON', async () => {
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  it('still delivers valid JSON bodies to the route handlers', async () => {
    // Valid JSON reaches the login handler: with no user row mocked, the
    // handler answers 401 invalid-credentials — anything else (especially
    // "Invalid JSON body") would mean the pre-parse middleware misfired.
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'secret123' }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid email or password');
  });

  it('lets bodyless requests with a JSON Content-Type through (DELETE pattern)', async () => {
    // Clients commonly send Content-Type: application/json on DELETE with an
    // empty body; that must not be mistaken for malformed JSON.
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const res = await buildApp().request('/api/admin/instances/some-id', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken()}` },
    });
    const body = await res.json();
    expect(body.error).not.toBe('Invalid JSON body');
  });
});
