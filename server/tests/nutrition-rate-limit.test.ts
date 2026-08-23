import { describe, it, expect, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(
    async (fn: (client: { query: typeof queryMock }) => unknown) => fn({ query: queryMock })
  ),
}));

import { buildApp } from '../src/index';

describe('public nutrition endpoints rate limiting', () => {
  it('throttles GET /api/nutrition/foods after the per-minute budget', async () => {
    queryMock.mockResolvedValue({ rows: [] } as never);
    const app = buildApp();

    let lastStatus = 0;
    for (let i = 0; i < 61; i++) {
      lastStatus = (await app.request('/api/nutrition/foods')).status;
    }

    // 60 requests succeed (budget), the 61st is rejected.
    expect(lastStatus).toBe(429);
  });
});