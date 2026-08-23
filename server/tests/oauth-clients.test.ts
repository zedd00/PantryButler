import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/pool', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (fn: (client: never) => unknown) =>
    fn({ query: async () => ({ rows: [], rowCount: 0 }) } as never)),
}));

import { query } from '../src/db/pool';
import {
  redirectMatches,
  DEFAULT_OAUTH_CLIENTS,
  seedOAuthClients,
  getOAuthClient,
} from '../src/utils/oauth-clients';

const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockQuery.mockReset();
});

describe('redirectMatches', () => {
  it('matches an exact redirect uri', () => {
    expect(redirectMatches('pantrybutler://oauth/callback', 'pantrybutler://oauth/callback', false)).toBe(true);
  });

  it('rejects an exact mismatch', () => {
    expect(redirectMatches('pantrybutler://oauth/callback', 'pantrybutler://oauth/callback2', false)).toBe(false);
    expect(redirectMatches('https://app.example/cb', 'https://evil.example/cb', false)).toBe(false);
  });

  it('does not honour wildcards for production (allowWildcard=false)', () => {
    expect(redirectMatches('moz-extension://*/', 'moz-extension://abc-123/', false)).toBe(false);
  });

  it('honours a wildcard for dev clients', () => {
    expect(redirectMatches('moz-extension://*/', 'moz-extension://abc-123/', true)).toBe(true);
  });

  it('matches the extension OAuth callback path for any extension UUID', () => {
    const pattern = 'moz-extension://*/src/oauth/callback.html';
    expect(redirectMatches(pattern, 'moz-extension://abc-123/src/oauth/callback.html', true)).toBe(true);
    expect(redirectMatches(pattern, 'moz-extension://def-456/src/oauth/callback.html', true)).toBe(true);
    // callback path is fixed: no wildcard into arbitrary paths
    expect(redirectMatches(pattern, 'moz-extension://abc-123/evil.html', true)).toBe(false);
  });

  it('restricts wildcard to the scheme+authority (no arbitrary hosts)', () => {
    expect(redirectMatches('moz-extension://*/', 'https://evil.example/cb', true)).toBe(false);
    expect(redirectMatches('moz-extension://*/', 'http://evil.example/abc', true)).toBe(false);
  });

  it('rejects non-:// schemes (javascript:, data:, file:)', () => {
    expect(redirectMatches('moz-extension://*/', 'javascript:alert(1)', true)).toBe(false);
    expect(redirectMatches('moz-extension://*/', 'data:text/html,x', true)).toBe(false);
    expect(redirectMatches('moz-extension://*/', 'file:///etc/passwd', true)).toBe(false);
  });
});

describe('default client registry', () => {
  it('defines web-extension, android and ios clients', () => {
    const ids = DEFAULT_OAUTH_CLIENTS.map((c) => c.client_id);
    expect(ids).toContain('web-extension');
    expect(ids).toContain('android');
    expect(ids).toContain('ios');
  });

  it('marks web-extension as a dev client with limited default scope', () => {
    const ext = DEFAULT_OAUTH_CLIENTS.find((c) => c.client_id === 'web-extension');
    expect(ext?.is_dev).toBe(true);
    expect(ext?.default_scopes).toBe('recipes:read,recipes:write');
    expect(ext?.redirect_uri).toBe('moz-extension://*/src/oauth/callback.html');
  });

  it('marks android/ios as production clients with "all" scope', () => {
    for (const id of ['android', 'ios']) {
      const client = DEFAULT_OAUTH_CLIENTS.find((c) => c.client_id === id);
      expect(client?.is_dev).toBe(false);
      expect(client?.default_scopes).toBe('all');
      expect(client?.redirect_uri).toBe('pantrybutler://oauth/callback');
    }
  });
});

describe('seedOAuthClients (DB-backed)', () => {
  it('upserts each active default client idempotently', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);
    await seedOAuthClients();
    // Every call goes to the DB; at minimum the production clients are inserted.
    expect(mockQuery).toHaveBeenCalled();
    const calls = mockQuery.mock.calls.map((c) => c[0]);
    const joined = calls.join('\n');
    expect(joined).toMatch(/INSERT INTO oauth_clients/);
    expect(joined).toMatch(/ON CONFLICT \(client_id\)/);
  });
});

describe('getOAuthClient (DB-backed)', () => {
  it('returns null when no client matches', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    expect(await getOAuthClient('missing')).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('oauth_clients'), ['missing']);
  });

  it('returns the row when a client matches', async () => {
    mockQuery.mockResolvedValue({ rows: [{ client_id: 'android', name: 'Android', is_dev: false }] } as never);
    const client = await getOAuthClient('android');
    expect(client?.client_id).toBe('android');
    expect(client?.is_dev).toBe(false);
  });
});
