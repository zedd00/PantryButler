import { describe, it, expect, vi, afterEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(
    async (fn: (client: { query: typeof queryMock }) => unknown) => fn({ query: queryMock })
  ),
}));

describe('CSP connect-src', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    vi.resetModules();
  });

  it('includes the localhost entries outside production (dev/test)', async () => {
    vi.resetModules();
    process.env.JWT_SECRET = 'a'.repeat(64);
    delete process.env.DATABASE_URL;
    const { buildApp } = await import('../src/index');
    queryMock.mockResolvedValue({ rows: [{ ok: 1 }] } as never);
    const res = await buildApp().request('/api/health');
    const csp = res.headers.get('content-security-policy') || '';
    expect(csp).toContain('connect-src');
    expect(csp).toContain('http://localhost:8000');
  });

  it('omits the localhost entries in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.DATABASE_URL = 'postgres://pantrybutler:realpassword@localhost:5432/pantrybutler';
    const { buildApp } = await import('../src/index');
    queryMock.mockResolvedValue({ rows: [{ ok: 1 }] } as never);
    const res = await buildApp().request('/api/health');
    const csp = res.headers.get('content-security-policy') || '';
    expect(csp).toContain('connect-src');
    expect(csp).not.toContain('localhost');
  });
});