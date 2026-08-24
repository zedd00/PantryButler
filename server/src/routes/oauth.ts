import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config } from '../utils/config';
import { getOAuthClient, redirectMatches } from '../utils/oauth-clients';
import { generateAuthCode, generateApiToken, hashSecret, verifyPkce } from '../utils/tokens';
import { normalizeScopes, scopeSubset } from '../utils/scopes';
import { createFailureLimiter } from '../utils/rate-limit';
import { clientIp } from '../utils/client-ip';
import { logError } from '../utils/log';
import { requireAuth, requireJwt, type AuthVariables, type JwtPayload } from '../middleware/auth';

const oauth = new Hono<{ Variables: AuthVariables }>();

// Failures-only: only rejected token exchanges (invalid_grant) consume the
// budget, so legitimate code exchanges are never throttled.
const tokenExchangeLimiter = createFailureLimiter(20, 15 * 60 * 1000);

// Send the user to the web app's login page, carrying the full authorize URL
// back so the flow resumes after a successful login. Base is the web origin
// (CORS_ORIGIN) rather than the API origin, since the login page is part of
// the SPA served to browsers.
function redirectToLogin(c: import('hono').Context): Response {
  const authorizeUrl = new URL(c.req.url);
  const loginUrl = new URL('/login', config.corsOrigin);
  loginUrl.searchParams.set('redirect', authorizeUrl.toString());
  return c.redirect(loginUrl.toString());
}

const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url().max(2048),
  scope: z.string().max(1024).optional(),
  state: z.string().max(1024).optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
});

oauth.get('/authorize', zValidator('query', authorizeSchema), async (c) => {
  try {
    const params = c.req.valid('query');
    const authorizeUrl = new URL(c.req.url);
    const client = await getOAuthClient(params.client_id);
    if (!client) {
      return c.json({ error: 'invalid_client' }, 400);
    }
    // The extension's moz-extension://* redirect is scheme-locked, so it is
    // safe to honour its wildcard in production without enabling dev clients
    // globally (which would also flip matching for any future dev client).
    const allowWildcard = client.is_dev && (config.oauthDevClients || client.redirect_uri.startsWith('moz-extension://'));
    if (!redirectMatches(client.redirect_uri, params.redirect_uri, allowWildcard)) {
      return c.json({ error: 'redirect_uri mismatch' }, 400);
    }

    const scopes = normalizeScopes(params.scope ? params.scope.split(' ') : undefined);
    if (scopes.length === 0 || !scopeSubset(scopes, client.default_scopes)) {
      return c.json({ error: 'invalid_scope' }, 400);
    }

    const session = getCookie(c, 'pb_session');
    if (!session) {
      return redirectToLogin(c);
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(session, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    } catch {
      return redirectToLogin(c);
    }

    const profile = await query(
      'SELECT p.id, p.instance_id, u.jwt_version FROM profiles p JOIN users u ON u.id = p.id WHERE p.id = $1',
      [decoded.userId]
    );
    if (profile.rows.length === 0) {
      return c.json({ error: 'user_not_found' }, 401);
    }
    // Keep the OAuth session cookie in step with every other JWT consumer: a
    // password change bumps jwt_version, and this cookie must not keep minting
    // authorization codes after revocation.
    if ((decoded.jwtVersion ?? 0) !== profile.rows[0].jwt_version) {
      return redirectToLogin(c);
    }
    const instanceId = profile.rows[0].instance_id;
    if (!instanceId) {
      return c.json({ error: 'no_active_instance' }, 403);
    }

    // Consent gate: the user must have explicitly approved this client from the
    // SPA before any code is issued. This blocks login-CSRF / clickjacking of
    // the authorization step — an attacker cannot silently mint a code for a
    // client the user never consented to.
    const consent = await query(
      'SELECT 1 FROM oauth_consents WHERE user_id = $1 AND client_id = $2',
      [decoded.userId, client.client_id]
    );
    if (consent.rows.length === 0) {
      const consentUrl = new URL('/oauth/consent', config.corsOrigin);
      consentUrl.searchParams.set('client_id', client.client_id);
      consentUrl.searchParams.set('client_name', client.name);
      consentUrl.searchParams.set('redirect', authorizeUrl.toString());
      return c.redirect(consentUrl.toString());
    }

    const { code, hash } = generateAuthCode();
    await query(
      `INSERT INTO oauth_codes (client_id, user_id, instance_id, redirect_uri, code_hash, scope, code_challenge, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        client.client_id,
        decoded.userId,
        instanceId,
        params.redirect_uri,
        hash,
        scopes,
        params.code_challenge,
        new Date(Date.now() + config.authCodeTtlMs),
      ]
    );

    const redirect = new URL(params.redirect_uri);
    redirect.searchParams.set('code', code);
    if (params.state) redirect.searchParams.set('state', params.state);
    return c.redirect(redirect.toString());
  } catch (err) {
    logError('OAuth authorize error', err);
    return c.json({ error: 'Authorization failed' }, 500);
  }
});

const consentSchema = z.object({
  client_id: z.string().min(1),
});

// Records explicit user approval of an OAuth client. Called from the SPA
// consent page with a web-session Bearer token (never a cookie), so there is
// no CSRF surface — an attacker cannot forge a cross-site request that carries
// the victim's Authorization header.
oauth.post('/consent', requireAuth, requireJwt, zValidator('json', consentSchema), async (c) => {
  try {
    const { client_id } = c.req.valid('json');
    const client = await getOAuthClient(client_id);
    if (!client) {
      return c.json({ error: 'invalid_client' }, 400);
    }
    await query(
      `INSERT INTO oauth_consents (user_id, client_id) VALUES ($1, $2)
       ON CONFLICT (user_id, client_id) DO NOTHING`,
      [c.get('userId'), client_id]
    );
    return c.json({ success: true });
  } catch (err) {
    logError('OAuth consent error', err);
    return c.json({ error: 'Failed to record consent' }, 500);
  }
});

const tokenSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  redirect_uri: z.string().url().max(2048),
  client_id: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
});

oauth.post('/token', zValidator('json', tokenSchema, (result, c) => {
  if (!result.success) {
    // Don't echo zod's field-level details to the wire; the standard OAuth
    // error shape is enough and avoids leaking schema internals.
    return c.json({ error: 'invalid_request' }, 400);
  }
  return undefined;
}), async (c) => {
  try {
    const ip = clientIp(c);
    if (tokenExchangeLimiter.isBlocked(ip)) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    const body = c.req.valid('json');
    const codeHash = hashSecret(body.code);

    const result = await query(
      'SELECT * FROM oauth_codes WHERE code_hash = $1',
      [codeHash]
    );
    const record = result.rows[0];
    const reject = (): Response => {
      tokenExchangeLimiter.recordFailure(ip);
      return c.json({ error: 'invalid_grant' }, 400);
    };
    if (!record || record.used_at) {
      return reject();
    }
    if (record.client_id !== body.client_id) {
      return reject();
    }
    if (record.redirect_uri !== body.redirect_uri) {
      return reject();
    }
    if (new Date(record.expires_at) <= new Date()) {
      return reject();
    }
    if (!verifyPkce(body.code_verifier, record.code_challenge)) {
      return reject();
    }

    // Single-use: consume atomically so a code can only be exchanged once.
    const consumed = await query(
      'UPDATE oauth_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id',
      [record.id]
    );
    if (consumed.rows.length === 0) {
      return reject();
    }

    const client = await getOAuthClient(record.client_id);
    const { token, hash } = generateApiToken();
    await query(
      `INSERT INTO api_tokens (user_id, instance_id, token_hash, name, scopes, created_from_ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.user_id,
        record.instance_id,
        hash,
        client ? `OAuth: ${client.name}` : 'OAuth client',
        record.scope,
        clientIp(c),
      ]
    );

    return c.json({
      access_token: token,
      token_type: 'Bearer',
      scope: record.scope.join(' '),
    });
  } catch (err) {
    logError('OAuth token error', err);
    return c.json({ error: 'Token exchange failed' }, 500);
  }
});

export { oauth };

// Periodic sweep (req. #13): drop used and expired one-time codes so the table
// cannot grow unbounded. Called at server start; the code-expiry boundary is
// checked on every exchange regardless, so this is just hygiene.
export async function purgeExpiredOAuthCodes(): Promise<void> {
  try {
    await query('DELETE FROM oauth_codes WHERE used_at IS NOT NULL OR expires_at < NOW()');
  } catch (err) {
    logError('Failed to purge expired OAuth codes', err);
  }
}
