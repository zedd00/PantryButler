import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
const { compareMock } = vi.hoisted(() => ({ compareMock: vi.fn() }));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(
    async (fn: (client: { query: typeof queryMock }) => unknown) => fn({ query: queryMock })
  ),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: compareMock },
}));

import jwt from 'jsonwebtoken';
import { buildApp } from '../src/index';

function loginPayload(remember_me?: boolean) {
  return { email: 'user@example.com', password: 'secret123', ...(remember_me !== undefined ? { remember_me } : {}) };
}

describe('/api/auth/login remember_me', () => {
  beforeEach(() => {
    queryMock.mockReset();
    compareMock.mockReset();
    compareMock.mockResolvedValue(true);
    queryMock.mockResolvedValue({
      rows: [{ id: 'user-1', email: 'user@example.com', password_hash: 'h', jwt_version: 0 }],
    } as never);
  });

  it('issues a 30-day token when remember_me is true', async () => {
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload(true)),
    });
    expect(res.status).toBe(200);
    const payload = jwt.decode((await res.json()).token) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
  });

  it('issues a 24-hour token when remember_me is false', async () => {
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload(false)),
    });
    expect(res.status).toBe(200);
    const payload = jwt.decode((await res.json()).token) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
  });

  it('keeps the long session when remember_me is absent (older clients)', async () => {
    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload()),
    });
    expect(res.status).toBe(200);
    const payload = jwt.decode((await res.json()).token) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
  });
});