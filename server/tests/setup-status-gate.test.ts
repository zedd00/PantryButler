import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import jwt from 'jsonwebtoken';

vi.mock('../src/db/pool', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (fn: (client: never) => unknown) =>
    fn({ query: async () => ({ rows: [], rowCount: 0 }) } as never)),
}));

import { query } from '../src/db/pool';
import { config } from '../src/utils/config';
import { requireSuperAdmin } from '../src/middleware/auth';

const mockQuery = vi.mocked(query);

// Replicates the gate added to GET /api/setup/status and /api/admin/validate:
// pre-bootstrap (no users) the endpoint stays open; once users exist it
// requires a valid superadmin session.
function makeStatusApp(gateOnHasUsers: boolean): Hono {
  const app = new Hono();
  app.get('/status', async (c) => {
    const profileResult = await query('SELECT COUNT(*) FROM profiles');
    const hasUsers = parseInt((profileResult as { rows: { count: string }[] }).rows[0].count, 10) > 0;
    if (gateOnHasUsers && hasUsers) {
      const denied = await requireSuperAdmin(c, async () => {});
      if (denied) return denied;
    }
    return c.json({ success: true, userCount: parseInt((profileResult as { rows: { count: string }[] }).rows[0].count, 10) });
  });
  return app;
}

// Standalone schema check mirroring the calendar meal_type enum fix.
function calendarSchemaApp(): Hono {
  const schema = z.object({
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  });
  const app = new Hono();
  app.post('/momentos-meals', zValidator('json', schema), (c) => c.json(c.req.valid('json')));
  return app;
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('setup/admin count gate after bootstrap', () => {
  it('is open when no users exist (first-boot bootstrap flow)', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '0' }] } as never);
    const res = await makeStatusApp(true).request('/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userCount).toBe(0);
  });

  it('rejects unauthenticated callers once users exist', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '2' }] } as never);
    const res = await makeStatusApp(true).request('/status');
    expect(res.status).toBe(401);
  });

  it('rejects a non-superadmin user once users exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] } as never) // profile count
      .mockResolvedValueOnce({ rows: [{ role: 'user', jwt_version: 0 }] } as never); // role lookup
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
    const res = await makeStatusApp(true).request('/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('allows a superadmin user once users exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] } as never) // profile count
      .mockResolvedValueOnce({ rows: [{ role: 'superadmin', jwt_version: 0 }] } as never); // role lookup
    const token = jwt.sign({ userId: 'user-1', email: 'a@b.c', jwtVersion: 0 }, config.jwtSecret);
    const res = await makeStatusApp(true).request('/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).userCount).toBe(2);
  });

  it('stays open regardless of users when gateOnHasUsers is disabled (legacy behavior)', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: '5' }] } as never);
    const res = await makeStatusApp(false).request('/status');
    expect(res.status).toBe(200);
  });
});

describe('calendar meal_type enum (snack alignment)', () => {
  it('accepts snack', async () => {
    const res = await calendarSchemaApp().request('/momentos-meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_type: 'snack' }),
    });
    expect(res.status).toBe(200);
  });

  it('still rejects an unknown meal type', async () => {
    const res = await calendarSchemaApp().request('/momentos-meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_type: 'brunch' }),
    });
    expect(res.status).toBe(400);
  });
});