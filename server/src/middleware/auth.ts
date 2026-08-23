import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { query } from '../db/pool';
import { hashSecret } from '../utils/tokens';

export type AuthVariables = {
  userId: string;
  userEmail: string;
  instanceId?: string;
  authType?: 'jwt' | 'token';
  scopes?: string[];
  tokenId?: string;
};

export interface JwtPayload {
  userId: string;
  email: string;
  jwtVersion?: number;
}

const JWT_AUTH = 'jwt';
const TOKEN_AUTH = 'token';

async function authenticateJwt(c: Context, raw: string): Promise<Response | void> {
  try {
    const decoded = jwt.verify(raw, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

    const profile = await query(
      'SELECT id, jwt_version FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (profile.rows.length === 0) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
    // Reject tokens minted before the latest password change / revocation.
    if ((decoded.jwtVersion ?? 0) !== profile.rows[0].jwt_version) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    c.set('userId', decoded.userId);
    c.set('userEmail', decoded.email);
    c.set('authType', JWT_AUTH);
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

async function authenticateApiToken(c: Context, raw: string): Promise<Response | void> {
  const tokenHash = hashSecret(raw);

  const result = await query(
    `SELECT t.id, t.user_id, t.instance_id, t.scopes, t.expires_at, t.revoked_at, u.email
     FROM api_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1`,
    [tokenHash]
  );
  const token = result.rows[0];
  if (!token) {
    return c.json({ error: 'Invalid API token' }, 401);
  }
  if (token.revoked_at) {
    return c.json({ error: 'API token revoked' }, 401);
  }
  if (token.expires_at && new Date(token.expires_at) <= new Date()) {
    return c.json({ error: 'API token expired' }, 401);
  }

  const membership = await query(
    'SELECT 1 FROM instance_members WHERE user_id = $1 AND instance_id = $2',
    [token.user_id, token.instance_id]
  );
  if (membership.rows.length === 0) {
    return c.json({ error: 'API token instance access revoked' }, 403);
  }

  // Cross-instance isolation (security req. #10): the token is bound to a
  // single instance. Any caller-supplied instance_id in the query string or
  // JSON body must match, or the request is rejected outright — a token can
  // never be pointed at another instance, even one the user is a member of.
  const bound = token.instance_id;
  const queryInstance = c.req.query('instance_id');
  if (queryInstance && queryInstance !== bound) {
    return c.json({ error: 'Token instance mismatch' }, 403);
  }
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = await c.req.json();
      if (typeof body?.instance_id === 'string' && body.instance_id !== bound) {
        return c.json({ error: 'Token instance mismatch' }, 403);
      }
    } catch {
      // Non-JSON body or parse error; the route's own validator will report it.
    }
  }

  c.set('userId', token.user_id);
  c.set('userEmail', token.email);
  c.set('instanceId', token.instance_id);
  c.set('authType', TOKEN_AUTH);
  c.set('scopes', token.scopes ?? []);
  c.set('tokenId', token.id);

  await query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1', [token.id]);
}

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const result = token.startsWith('pb_') ? await authenticateApiToken(c, token) : await authenticateJwt(c, token);
  if (result) return result;
  await next();
}

// Gate a route to API-token (long-lived) callers only. Useful for endpoints
// that must not be reachable with a short-lived web JWT.
export async function requireApiToken(c: Context, next: Next): Promise<Response | void> {
  if (c.get('authType') !== TOKEN_AUTH) {
    return c.json({ error: 'API token required' }, 403);
  }
  await next();
}

// Gate a route to web-session (JWT) callers only. Used where long-lived token
// privileges must not be self-escalating (e.g. minting/revoking tokens).
export async function requireJwt(c: Context, next: Next): Promise<Response | void> {
  if (c.get('authType') !== JWT_AUTH) {
    return c.json({ error: 'Web session required' }, 403);
  }
  await next();
}

// Require that the caller (JWT user or scoped API token) hold at least one of
// the given scopes. JWT callers are implicitly all-access.
export function requireScope(...allowedScopes: string[]): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next) => {
    if (c.get('authType') === TOKEN_AUTH) {
      const scopes: string[] = c.get('scopes') ?? [];
      if (!scopes.includes('all') && !allowedScopes.some((s) => scopes.includes(s))) {
        return c.json({ error: 'Insufficient scope' }, 403);
      }
    }
    await next();
  };
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Method-aware resource scope guard. Applies `${resource}:read` to reads and
// `${resource}:write` to writes, so a `recipes:read`-only token can list but
// never mutate. `all` grants everything; JWT callers are unimpeded.
export function requireResourceScope(resource: string): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next) => {
    if (c.get('authType') === TOKEN_AUTH) {
      const scopes: string[] = c.get('scopes') ?? [];
      if (scopes.includes('all')) {
        return next();
      }
      const required = READ_METHODS.has(c.req.method) ? `${resource}:read` : `${resource}:write`;
      if (!scopes.includes(required)) {
        return c.json({ error: 'Insufficient scope', required }, 403);
      }
    }
    await next();
  };
}

export async function requireSuperAdmin(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

    const result = await query(
      'SELECT p.role, u.jwt_version FROM profiles p JOIN users u ON u.id = p.id WHERE p.id = $1',
      [decoded.userId]
    );
    if (
      result.rows.length === 0 ||
      result.rows[0].role !== 'superadmin' ||
      (decoded.jwtVersion ?? 0) !== result.rows[0].jwt_version
    ) {
      return c.json({ error: 'Forbidden: Superadmin access required' }, 403);
    }

    c.set('userId', decoded.userId);
    c.set('userEmail', decoded.email);
    return next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

// Returns the caller's user id if the request carries a valid superadmin bearer
// token, otherwise null. Unlike requireSuperAdmin this does not reject the
// request — used to allow privileged bootstrap actions on an already-provisioned
// database while still blocking unauthenticated callers.
export async function getOptionalSuperAdmin(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    const result = await query(
      'SELECT p.role, u.jwt_version FROM profiles p JOIN users u ON u.id = p.id WHERE p.id = $1',
      [decoded.userId]
    );
    return result.rows.length > 0 && result.rows[0].role === 'superadmin' && (decoded.jwtVersion ?? 0) === result.rows[0].jwt_version
      ? decoded.userId
      : null;
  } catch {
    return null;
  }
}
