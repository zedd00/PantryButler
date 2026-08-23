import { query } from '../db/pool';
import { config } from './config';

export type OAuthClientRow = {
  id: string;
  client_id: string;
  name: string;
  redirect_uri: string;
  default_scopes: string[];
  is_dev: boolean;
};

// Pre-registered clients. The web extension registers its real ID at runtime;
// the dev-wildcard entry below only matches when oauthDevClients is enabled.
// Android/iOS use a custom-scheme redirect which requires exact matching.
export const DEFAULT_OAUTH_CLIENTS: Array<{
  client_id: string;
  name: string;
  redirect_uri: string;
  default_scopes: string;
  is_dev: boolean;
}> = [
  {
    client_id: 'web-extension',
    name: 'Pantry Butler Browser Extension',
    redirect_uri: 'moz-extension://*/src/oauth/callback.html',
    default_scopes: 'recipes:read,recipes:write',
    is_dev: true,
  },
  {
    client_id: 'android',
    name: 'Pantry Butler Android',
    redirect_uri: 'pantrybutler://oauth/callback',
    default_scopes: 'all',
    is_dev: false,
  },
  {
    client_id: 'ios',
    name: 'Pantry Butler iOS',
    redirect_uri: 'pantrybutler://oauth/callback',
    default_scopes: 'all',
    is_dev: false,
  },
];

// Glob-style matching: `moz-extension://*/src/oauth/callback.html` matches the
// extension's OAuth callback page for any extension UUID. Exact match is always
// required in production; wildcard matching is only honoured for dev clients
// (is_dev). Wildcards are restricted to scheme+authority so a dev client cannot
// point a redirect at an arbitrary host, and the callback path is fixed.
export function redirectMatches(pattern: string, actual: string, allowWildcard: boolean): boolean {
  if (pattern === actual) return true;
  if (!allowWildcard || !pattern.includes('*')) return false;
  if (!/^[a-z][a-z0-9+.-]*:\/\/.*$/.test(pattern)) return false;
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}$`).test(actual);
}

// Idempotent: upsert the default clients so a fresh database has a working set,
// and reflect config drift on subsequent starts.
export async function seedOAuthClients(): Promise<void> {
  for (const client of DEFAULT_OAUTH_CLIENTS) {
    const active = client.is_dev ? config.oauthDevClients : true;
    if (!active) continue;
    await query(
      `INSERT INTO oauth_clients (client_id, name, redirect_uri, default_scopes, is_dev)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (client_id) DO UPDATE SET
         name = EXCLUDED.name,
         redirect_uri = EXCLUDED.redirect_uri,
         default_scopes = EXCLUDED.default_scopes,
         is_dev = EXCLUDED.is_dev`,
      [client.client_id, client.name, client.redirect_uri, client.default_scopes.split(','), client.is_dev]
    );
  }
}

export async function getOAuthClient(clientId: string): Promise<OAuthClientRow | null> {
  const result = await query('SELECT * FROM oauth_clients WHERE client_id = $1', [clientId]);
  return result.rows[0] ?? null;
}
