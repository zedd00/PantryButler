import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { requireAuth, requireJwt, type AuthVariables } from '../middleware/auth';
import { canAccessInstance } from '../utils/membership';
import { generateApiToken } from '../utils/tokens';
import { normalizeScopes, scopeSubset } from '../utils/scopes';
import { config } from '../utils/config';
import { createFailureLimiter } from '../utils/rate-limit';
import { clientIp } from '../utils/client-ip';
import { logError } from '../utils/log';

const tokens = new Hono<{ Variables: AuthVariables }>();

// Failures-only: only rejected mint attempts consume the budget, so a user
// creating tokens (a legitimate action) is never throttled.
const tokenMintLimiter = createFailureLimiter(20, 15 * 60 * 1000);

tokens.use('*', requireAuth);

// Mint a new API token. Requires a real instance_id and a scope subset of the
// caller's allowed scopes. JWT (web-session) only — a token must not mint
// sibling tokens. Returns the plaintext token exactly once.
tokens.post(
  '/',
  requireJwt,
  zValidator(
    'json',
    z.object({
      instance_id: z.string().uuid('Invalid instance ID'),
      name: z.string().min(1).max(100),
      scopes: z.array(z.string()).max(20).optional(),
      expires_at: z.string().datetime({ offset: true }).optional(),
    })
  ),
  async (c) => {
    try {
      const ip = clientIp(c);
      if (tokenMintLimiter.isBlocked(ip)) {
        return c.json({ error: 'Too many requests, please try again later' }, 429);
      }

      const userId = c.get('userId');
      const { instance_id, name, scopes, expires_at } = c.req.valid('json');

      if (!(await canAccessInstance(userId, instance_id))) {
        tokenMintLimiter.recordFailure(ip);
        return c.json({ error: 'Forbidden: not a member of this instance' }, 403);
      }

      const normalized = normalizeScopes(scopes ?? ['all']);
      if (normalized.length === 0) {
        tokenMintLimiter.recordFailure(ip);
        return c.json({ error: 'Invalid scopes requested' }, 400);
      }
      const callerScopes: string[] = c.get('scopes') ?? ['all'];
      if (!scopeSubset(normalized, callerScopes)) {
        tokenMintLimiter.recordFailure(ip);
        return c.json({ error: 'Requested scopes exceed caller privileges' }, 403);
      }

      if (expires_at) {
        const ttl = new Date(expires_at).getTime() - Date.now();
        if (ttl <= 0 || ttl > config.apiTokenMaxTtlMs) {
          tokenMintLimiter.recordFailure(ip);
          return c.json({ error: 'expires_at must be between now and 1 year' }, 400);
        }
      }

      // A superadmin bypasses the membership check, so the target instance must
      // still exist — otherwise the insert below would violate the FK and 500.
      const instanceExists = await query('SELECT 1 FROM instances WHERE id = $1', [instance_id]);
      if (instanceExists.rows.length === 0) {
        tokenMintLimiter.recordFailure(ip);
        return c.json({ error: 'Instance not found' }, 404);
      }

      const { token, hash } = generateApiToken();
      const result = await query(
        `INSERT INTO api_tokens (user_id, instance_id, token_hash, name, scopes, expires_at, created_from_ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, instance_id, name, scopes, expires_at, created_at`,
        [userId, instance_id, hash, name, normalized, expires_at || null, clientIp(c)]
      );

      return c.json({
        token, // plaintext, shown once
        ...result.rows[0],
      }, 201);
    } catch (err) {
      logError('Create token error', err);
      return c.json({ error: 'Failed to create token' }, 500);
    }
  }
);

// List caller's tokens. JWT callers list all their tokens; a token caller sees
// only its own record (for self-inspection).
tokens.get('/', async (c) => {
  try {
    const userId = c.get('userId');

    if (c.get('authType') === 'token') {
      const tokenId = c.get('tokenId');
      const result = await query(
        `SELECT id, instance_id, name, scopes, expires_at, created_at, last_used_at, revoked_at
         FROM api_tokens WHERE id = $1`,
        [tokenId]
      );
      return c.json(result.rows[0] ?? null);
    }

    const result = await query(
      `SELECT id, instance_id, name, scopes, expires_at, created_at, last_used_at, revoked_at
       FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return c.json(result.rows);
  } catch (err) {
    logError('List tokens error', err);
    return c.json({ error: 'Failed to fetch tokens' }, 500);
  }
});

// Revoke a single token. The owning user (JWT) may revoke any of their tokens;
// a token itself may revoke its own row (self-revocation, e.g. the extension's
// Disconnect). Tokens can never revoke siblings.
tokens.delete('/:id', async (c) => {
  try {
    const userId = c.get('userId');
    const authType = c.get('authType');
    const tokenId = c.req.param('id');

    const existing = await query('SELECT * FROM api_tokens WHERE id = $1', [tokenId]);
    if (existing.rows.length === 0) {
      return c.json({ error: 'Token not found' }, 404);
    }
    const target = existing.rows[0];
    if (target.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (authType === 'token' && c.get('tokenId') !== tokenId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const callerScopes: string[] = c.get('scopes') ?? ['all'];
    if (!scopeSubset(target.scopes, callerScopes)) {
      return c.json({ error: 'Insufficient scope to revoke token' }, 403);
    }

    await query('UPDATE api_tokens SET revoked_at = NOW(), revoked_reason = $1 WHERE id = $2', [
      authType === 'token' ? 'revoked by the token itself' : 'revoked by user',
      tokenId,
    ]);
    return c.json({ message: 'Token revoked' });
  } catch (err) {
    logError('Revoke token error', err);
    return c.json({ error: 'Failed to revoke token' }, 500);
  }
});

// Revoke all of the caller's tokens in one shot. JWT (web-session) only.
tokens.delete('/', requireJwt, async (c) => {
  try {
    const userId = c.get('userId');

    await query('UPDATE api_tokens SET revoked_at = NOW(), revoked_reason = $1 WHERE user_id = $2', [
      'revoked all',
      userId,
    ]);
    return c.json({ message: 'All tokens revoked' });
  } catch (err) {
    logError('Revoke all tokens error', err);
    return c.json({ error: 'Failed to revoke tokens' }, 500);
  }
});

export { tokens };
