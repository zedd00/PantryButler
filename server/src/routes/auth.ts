import { Hono, type Context } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/pool';
import { config } from '../utils/config';
import { createFailureLimiter, createRateLimiter } from '../utils/rate-limit';
import { clientIp } from '../utils/client-ip';
import { logError } from '../utils/log';
import { sha256Hex } from '../utils/tokens';
import { sendEmail } from '../utils/mailer';
import { isEmailVerificationRequired, getEffectiveAppUrl } from '../utils/system-config';
import { requireAuth, requireJwt, requireResourceScope, type AuthVariables, type JwtPayload } from '../middleware/auth';

const auth = new Hono<{ Variables: AuthVariables }>();

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  instance_name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

// Failures-only throttling for auth. Successful logins/registrations never
// count toward these buckets, so legitimate traffic — including multiple users
// behind one shared NAT IP — is never locked out; only repeated failed
// attempts are throttled. The per-account bucket (keyed on IP + email) makes
// credential-stuffing and account enumeration meaningfully slower even when
// many distinct IPs are available.
const authIpLimiter = createFailureLimiter(20, 15 * 60 * 1000);
const accountAuthLimiter = createFailureLimiter(10, 15 * 60 * 1000);

// Registration counts EVERY attempt (successes included) per IP. The failure
// limiters above only throttle rejected attempts, so without this an attacker
// could mass-register unlimited throwaway accounts from one address. 10
// registrations per 15 minutes per IP is generous for real users (even several
// behind one NAT) while stopping bulk account creation.
const registerIpLimiter = createRateLimiter(10, 15 * 60 * 1000);

// Resending verification links is rate-limited per IP (a handful of resends
// per window covers genuine "didn't arrive / clicked old link" cases while
// stopping link spam to arbitrary addresses).
const resendVerificationLimiter = createRateLimiter(3, 15 * 60 * 1000);

// Email verification tokens: 32 random bytes, stored as SHA-256, valid 24h.
const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function generateVerificationToken(): string {
  return randomBytes(VERIFICATION_TOKEN_BYTES).toString('base64url');
}

async function issueVerificationToken(userId: string): Promise<string> {
  const raw = generateVerificationToken();
  await query(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, sha256Hex(raw), new Date(Date.now() + VERIFICATION_TTL_MS)]
  );
  return raw;
}

async function sendVerificationEmail(email: string, rawToken: string): Promise<void> {
  const link = `${await getEffectiveAppUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: email,
    subject: 'Verify your PantryButler account',
    text: `Welcome to PantryButler!\n\nConfirm your email address to create your kitchen:\n\n${link}\n\nThis link expires in 24 hours.`,
  });
}

// Pre-computed bcrypt hash of a throwaway passphrase, used to equalise the
// login timing for unknown emails (see login handler).
const DUMMY_PASSWORD_HASH = '$2b$12$781PbIePCL78aE9nE9r7w.QPUMFNv2rQ8n90l7Sy4GEVcfjxncBMS';

function generateToken(payload: JwtPayload, expiresInSeconds: number = LONG_SESSION_SECONDS): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: expiresInSeconds });
}

// Session lifetimes, in seconds. "Remember me" logins keep the user signed in
// for the long window; a plain login only lasts the short window (24h).
const LONG_SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SHORT_SESSION_SECONDS = 24 * 60 * 60;     // 24 hours

// Short-lived session cookie used ONLY by /oauth/authorize to prove the user is
// logged in. Deliberately not the primary auth mechanism — /api/* stays
// Bearer-only and stateless. Max-Age mirrors the issued token's lifetime.
function setSessionCookie(c: Context, token: string, maxAgeSeconds: number = LONG_SESSION_SECONDS): void {
  const secure = config.nodeEnv === 'production';
  c.header('Set-Cookie', `pb_session=${token}; HttpOnly; SameSite=Lax; Path=/oauth; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`);
}

auth.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, password, instance_name } = c.req.valid('json');
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(c);
    const accountKey = `${ip}:${normalizedEmail}`;

    if (authIpLimiter.isBlocked(ip) || accountAuthLimiter.isBlocked(accountKey)) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    if (!registerIpLimiter(ip)) {
      return c.json({ error: 'Too many registrations, please try again later' }, 429);
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      authIpLimiter.recordFailure(ip);
      accountAuthLimiter.recordFailure(accountKey);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // When email verification is required, every new registration (including
    // instance creators) takes the deferred path below: the account is created
    // unverified, a verification email is sent, and instance creation is
    // deferred until the address is confirmed (the verify-email route finalizes
    // the instance from pending_instance_name). This matches the README and
    // launchers, which state instance creators must verify their email too.
    if (await isEmailVerificationRequired()) {
      const userResult = await query(
        `INSERT INTO users (email, password_hash, pending_instance_name)
         VALUES ($1, $2, $3) RETURNING id, email`,
        [normalizedEmail, passwordHash, instance_name || null]
      );
      const user = userResult.rows[0];
      const rawToken = await issueVerificationToken(user.id);
      await sendVerificationEmail(user.email, rawToken);
      return c.json({ requiresEmailVerification: true, email: user.email }, 201);
    }

    const userResult = await query(
      'INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, NOW()) RETURNING id, email, created_at, jwt_version',
      [normalizedEmail, passwordHash]
    );
    const user = userResult.rows[0];

    await query('SELECT handle_new_user($1, $2, $3)', [user.id, user.email, instance_name || null]);

    const token = generateToken({ userId: user.id, email: user.email, jwtVersion: user.jwt_version });
    setSessionCookie(c, token);

    return c.json({
      token,
      user: { id: user.id, email: user.email },
    }, 201);
  } catch (err) {
    logError('Registration error', err);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, password, remember_me } = c.req.valid('json');
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(c);
    const accountKey = `${ip}:${normalizedEmail}`;

    if (authIpLimiter.isBlocked(ip) || accountAuthLimiter.isBlocked(accountKey)) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    const result = await query(
      'SELECT id, email, password_hash, jwt_version, email_verified_at FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      // Run a dummy bcrypt compare so unknown emails take ~the same time as a
      // real password check — otherwise the response time is an account-existence
      // oracle for enumeration.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      authIpLimiter.recordFailure(ip);
      accountAuthLimiter.recordFailure(accountKey);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      authIpLimiter.recordFailure(ip);
      accountAuthLimiter.recordFailure(accountKey);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // An unverified instance creator may not sign in while verification is
    // required (the deferral makes the account effectively dormant until the
    // email is confirmed).
    if (!user.email_verified_at && (await isEmailVerificationRequired())) {
      authIpLimiter.recordFailure(ip);
      accountAuthLimiter.recordFailure(accountKey);
      return c.json({ error: 'email_not_verified' }, 403);
    }

    await query(
      'UPDATE profiles SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Absent remember_me (older clients) keeps the previous always-7-day-style
    // long session; an explicit false opts into the short 24h window.
    const sessionSeconds = remember_me === false ? SHORT_SESSION_SECONDS : LONG_SESSION_SECONDS;
    const token = generateToken({ userId: user.id, email: user.email, jwtVersion: user.jwt_version }, sessionSeconds);
    setSessionCookie(c, token, sessionSeconds);

    return c.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    logError('Login error', err);
    return c.json({ error: 'Login failed' }, 500);
  }
});

auth.get('/verify-email', async (c) => {
  try {
    const raw = c.req.query('token');
    if (!raw) {
      return c.json({ error: 'Missing verification token' }, 400);
    }

    const tokenHash = sha256Hex(raw);
    const result = await query(
      `SELECT t.user_id, t.expires_at, t.consumed_at, u.email, u.pending_instance_name, u.email_verified_at
       FROM email_verification_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1`,
      [tokenHash]
    );
    const row = result.rows[0];

    if (!row || row.consumed_at) {
      return c.json({ error: 'invalid_or_used' }, 400);
    }
    if (row.email_verified_at) {
      return c.json({ error: 'already_verified' }, 400);
    }
    if (new Date(row.expires_at) <= new Date()) {
      return c.json({ error: 'expired' }, 400);
    }

    // Consume the token atomically so a concurrent click of the same link
    // cannot create a second instance.
    const consumed = await query(
      'UPDATE email_verification_tokens SET consumed_at = NOW() WHERE token_hash = $1 AND consumed_at IS NULL',
      [tokenHash]
    );
    if (consumed.rowCount === 0) {
      return c.json({ error: 'invalid_or_used' }, 400);
    }

    await query(
      'UPDATE users SET email_verified_at = NOW(), pending_instance_name = NULL WHERE id = $1',
      [row.user_id]
    );

    // Instance creation was deferred from registration; run it now.
    await query('SELECT handle_new_user($1, $2, $3)', [row.user_id, row.email, row.pending_instance_name || null]);

    const userRow = await query('SELECT id, email, jwt_version FROM users WHERE id = $1', [row.user_id]);
    const user = userRow.rows[0];
    const token = generateToken({ userId: user.id, email: user.email, jwtVersion: user.jwt_version });
    setSessionCookie(c, token);

    return c.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    logError('Verify email error', err);
    return c.json({ error: 'Verification failed' }, 500);
  }
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

auth.post('/resend-verification', zValidator('json', resendVerificationSchema), async (c) => {
  try {
    const { email } = c.req.valid('json');
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(c);
    const accountKey = `${ip}:${normalizedEmail}`;

    if (authIpLimiter.isBlocked(ip) || accountAuthLimiter.isBlocked(accountKey)) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }
    if (!resendVerificationLimiter(ip)) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }

    // When verification isn't required there is nothing to resend, but answer
    // identically so the endpoint can't be used to probe the feature state.
    if (!(await isEmailVerificationRequired())) {
      return c.json({ success: true });
    }

    const result = await query(
      'SELECT id, email_verified_at FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    if (user && !user.email_verified_at) {
      // Revoke any outstanding tokens so only the newest link works.
      await query(
        'UPDATE email_verification_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
        [user.id]
      );
      const rawToken = await issueVerificationToken(user.id);
      await sendVerificationEmail(user.email, rawToken);
    }

    return c.json({ success: true });
  } catch (err) {
    logError('Resend verification error', err);
    return c.json({ error: 'Failed to resend verification email' }, 500);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

auth.post('/change-password', requireAuth, requireJwt, zValidator('json', changePasswordSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const { currentPassword, password } = c.req.valid('json');

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // Bump jwt_version so every OTHER token issued before this moment is
    // rejected immediately — a stolen token is dead on password change. Re-issue
    // a fresh token for the current session so the user isn't force-logged-out.
    const updated = await query(
      'UPDATE users SET password_hash = $1, jwt_version = jwt_version + 1 WHERE id = $2 RETURNING jwt_version',
      [passwordHash, userId]
    );

    const token = generateToken({ userId, email: c.get('userEmail'), jwtVersion: updated.rows[0].jwt_version });

    return c.json({ message: 'Password changed successfully', token });
  } catch (err) {
    logError('Change password error', err);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

auth.get('/me', requireAuth, requireResourceScope('profile'), async (c) => {
  try {
    const userId = c.get('userId');

    let profileResult = await query(
      `SELECT p.*, i.name as instance_name
       FROM profiles p
       LEFT JOIN instances i ON p.instance_id = i.id
       WHERE p.id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      const email = c.get('userEmail');
      await query('SELECT handle_new_user($1, $2, NULL)', [userId, email]);
      profileResult = await query(
        `SELECT p.*, i.name as instance_name
         FROM profiles p
         LEFT JOIN instances i ON p.instance_id = i.id
         WHERE p.id = $1`,
        [userId]
      );
      if (profileResult.rows.length === 0) {
        return c.json({ error: 'Profile not found' }, 404);
      }
    }

    // Deterministic instance order: the user's active instance first, then
    // remaining memberships by creation time. Without ORDER BY the row order is
    // heap-arbitrary, and the frontend picks instances[0] as the default active
    // instance — which could point at the wrong kitchen.
    const activeInstanceId = profileResult.rows[0]?.instance_id ?? null;
    const instancesResult = await query(
      `SELECT im.instance_id as id, im.role, i.name, i.created_at
       FROM instance_members im
       JOIN instances i ON im.instance_id = i.id
       WHERE im.user_id = $1
       ORDER BY (im.instance_id = $2) DESC, i.created_at ASC`,
      [userId, activeInstanceId]
    );

    let instances = instancesResult.rows;
    const profile = profileResult.rows[0];

    if (instances.length === 0 && profile.instance_id) {
      const fallback = await query(
        `SELECT id, name, created_at FROM instances WHERE id = $1`,
        [profile.instance_id]
      );
      if (fallback.rows.length > 0) {
        instances = [{
          id: fallback.rows[0].id,
          role: 'admin',
          name: fallback.rows[0].name,
          created_at: fallback.rows[0].created_at,
        }];
      }
    }

    return c.json({
      profile,
      instances,
    });
  } catch (err) {
    logError('Get profile error', err);
    return c.json({ error: 'Failed to load profile' }, 500);
  }
});

const setInstanceSchema = z.object({
  instance_id: z.string().uuid('Invalid instance ID'),
});

auth.put('/instance', requireAuth, requireJwt, zValidator('json', setInstanceSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const { instance_id } = c.req.valid('json');

    const membership = await query(
      'SELECT 1 FROM instance_members WHERE user_id = $1 AND instance_id = $2',
      [userId, instance_id]
    );
    if (membership.rows.length === 0) {
      return c.json({ error: 'Not a member of this instance' }, 403);
    }

    await query('UPDATE profiles SET instance_id = $1, last_login = NOW() WHERE id = $2', [
      instance_id,
      userId,
    ]);

    const result = await query(
      `SELECT p.*, i.name as instance_name
       FROM profiles p
       LEFT JOIN instances i ON p.instance_id = i.id
       WHERE p.id = $1`,
      [userId]
    );

    return c.json({ profile: result.rows[0] });
  } catch (err) {
    logError('Switch instance error', err);
    return c.json({ error: 'Failed to switch instance' }, 500);
  }
});

export { auth };
