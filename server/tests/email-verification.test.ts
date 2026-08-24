import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const { queryMock, compareMock, hashMock, sendEmailMock, TEST_JWT_SECRET } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  compareMock: vi.fn(),
  hashMock: vi.fn(),
  sendEmailMock: vi.fn(),
  TEST_JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
}));

vi.mock('../src/db/pool', () => ({
  query: queryMock,
  pool: { query: queryMock },
  withTransaction: vi.fn(
    async (fn: (client: { query: typeof queryMock }) => unknown) => fn({ query: queryMock })
  ),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: hashMock, compare: compareMock },
}));

vi.mock('../src/utils/mailer', () => ({
  sendEmail: sendEmailMock,
}));

// Config is fixed at import time; we mock the module so tests can control the
// admin-features flag / verification default without touching process.env.
vi.mock('../src/utils/config', () => ({
  config: {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'postgres://test',
    jwtSecret: TEST_JWT_SECRET,
    corsOrigin: 'http://localhost:3000',
    appUrl: 'http://localhost:3000',
    publicDir: '/nonexistent',
    setupDir: '/nonexistent',
    enableAdminFeatures: true,
    requireEmailVerification: true,
    smtp: { host: null, port: 587, username: null, password: null, from: null, secure: false },
    authCodeTtlMs: 300000,
    apiTokenMaxTtlMs: 31536000000,
    oauthDevClients: true,
  },
}));

import { buildApp } from '../src/index';
import { config } from '../src/utils/config';

const mockedConfig = vi.mocked(config);

type DbHandler = { match: (sql: string) => boolean; result: () => unknown };

function mockDb(handlers: DbHandler[]) {
  queryMock.mockReset();
  queryMock.mockImplementation((sql: string, _params: unknown[]) => {
    const hit = handlers.find((h) => h.match(sql));
    if (hit) return hit.result() as never;
    return { rows: [], rowCount: 0 } as never;
  });
}

function verificationOverride(override: boolean | undefined): DbHandler {
  return {
    match: (sql) => sql.includes('system_config'),
    result: () =>
      override === undefined ? { rows: [], rowCount: 0 } : { rows: [{ value: override }] },
  };
}

function rows(items: Record<string, unknown>[]) {
  return { rows: items, rowCount: items.length };
}

function row(item: Record<string, unknown>) {
  return rows([item]);
}

function superadminToken(): string {
  return jwt.sign({ userId: 'sadmin', email: 'sa@example.com', jwtVersion: 0 }, TEST_JWT_SECRET);
}

function superadminProfileHandler(): DbHandler {
  return {
    match: (sql) => sql.includes('profiles p JOIN users u'),
    result: () => row({ role: 'superadmin', jwt_version: 0 }),
  };
}

beforeEach(() => {
  queryMock.mockReset();
  hashMock.mockReset();
  compareMock.mockReset();
  sendEmailMock.mockReset();
  mockedConfig.enableAdminFeatures = true;
  mockedConfig.requireEmailVerification = true;
});

describe('POST /api/auth/register with email verification required', () => {
  it('defers email verification for instance creators too', async () => {
    mockDb([
      verificationOverride(true),
      {
        match: (sql) => sql.includes('INSERT INTO users'),
        result: () => row({ id: 'u1', email: 'creator@example.com' }),
      },
      { match: (sql) => sql.includes('email_verification_tokens'), result: () => row({ id: 't1' }) },
    ]);

    const res = await buildApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Creator@Example.com', password: 'secret123', instance_name: 'My Kitchen' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    // Instance creators now also verify their email (no longer auto-verified).
    expect(body.requiresEmailVerification).toBe(true);
    expect(body.email).toBe('creator@example.com');
    // Instance creation stays deferred until the address is confirmed.
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('handle_new_user'), expect.anything());
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'creator@example.com', subject: expect.stringContaining('Verify') })
    );
  });

  it('still defers email verification for registrations without an instance', async () => {
    mockDb([
      verificationOverride(true),
      {
        match: (sql) => sql.includes('INSERT INTO users'),
        result: () => row({ id: 'u1', email: 'member@example.com' }),
      },
      { match: (sql) => sql.includes('email_verification_tokens'), result: () => row({ id: 't1' }) },
    ]);

    const res = await buildApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Member@Example.com', password: 'secret123' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.requiresEmailVerification).toBe(true);
    expect(body.email).toBe('member@example.com');
    // Instance creation deferred — handle_new_user must NOT have run.
    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('handle_new_user'), expect.anything());
    // A verification email is sent to the normalized address.
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'member@example.com', subject: expect.stringContaining('Verify') })
    );
  });

  it('does not require verification when the DB override is false', async () => {
    mockDb([
      verificationOverride(false),
      {
        match: (sql) => sql.includes('INSERT INTO users'),
        result: () => row({ id: 'u1', email: 'creator@example.com', created_at: new Date(), jwt_version: 0 }),
      },
      { match: (sql) => sql.includes('handle_new_user'), result: () => row({}) },
    ]);

    const res = await buildApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@example.com', password: 'secret123', instance_name: 'My Kitchen' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.requiresEmailVerification).toBeUndefined();
    expect(body.token).toBeTruthy();
    // Instance created immediately in this mode.
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('handle_new_user'), expect.anything());
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/verify-email', () => {
  it('verifies the email, creates the instance, and signs the user in', async () => {
    mockDb([
      {
        match: (sql) => sql.includes('FROM email_verification_tokens'),
        result: () =>
          row({
            user_id: 'u1',
            expires_at: new Date(Date.now() + 60_000),
            consumed_at: null,
            email: 'creator@example.com',
            pending_instance_name: 'My Kitchen',
            email_verified_at: null,
          }),
      },
      {
        match: (sql) => sql.includes('UPDATE email_verification_tokens'),
        result: () => ({ rows: [], rowCount: 1 }),
      },
      { match: (sql) => sql.includes('UPDATE users SET email_verified_at'), result: () => ({ rows: [], rowCount: 1 }) },
      { match: (sql) => sql.includes('handle_new_user'), result: () => row({}) },
      {
        match: (sql) => sql.includes('SELECT id, email, jwt_version FROM users WHERE id'),
        result: () => row({ id: 'u1', email: 'creator@example.com', jwt_version: 0 }),
      },
    ]);

    const res = await buildApp().request('/api/auth/verify-email?token=rawtoken123');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.id).toBe('u1');
    // Deferred instance creation runs at verify time with the pending name.
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('handle_new_user'), ['u1', 'creator@example.com', 'My Kitchen']);
  });

  it('rejects a used token', async () => {
    mockDb([
      {
        match: (sql) => sql.includes('FROM email_verification_tokens'),
        result: () =>
          row({
            user_id: 'u1',
            expires_at: new Date(Date.now() + 60_000),
            consumed_at: new Date(),
            email: 'creator@example.com',
            pending_instance_name: null,
            email_verified_at: null,
          }),
      },
    ]);

    const res = await buildApp().request('/api/auth/verify-email?token=rawtoken123');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_or_used');
  });

  it('rejects an expired token', async () => {
    mockDb([
      {
        match: (sql) => sql.includes('FROM email_verification_tokens'),
        result: () =>
          row({
            user_id: 'u1',
            expires_at: new Date(Date.now() - 1000),
            consumed_at: null,
            email: 'creator@example.com',
            pending_instance_name: null,
            email_verified_at: null,
          }),
      },
    ]);

    const res = await buildApp().request('/api/auth/verify-email?token=rawtoken123');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('expired');
  });
});

describe('POST /api/auth/login verification gate', () => {
  it('blocks an unverified creator when verification is required', async () => {
    compareMock.mockResolvedValue(true);
    mockDb([
      verificationOverride(true),
      {
        match: (sql) => sql.includes('SELECT id, email, password_hash, jwt_version, email_verified_at FROM users'),
        result: () =>
          row({ id: 'u1', email: 'creator@example.com', password_hash: 'h', jwt_version: 0, email_verified_at: null }),
      },
    ]);

    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@example.com', password: 'secret123' }),
    });

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('email_not_verified');
  });

  it('lets an unverified user in when verification is not currently required', async () => {
    compareMock.mockResolvedValue(true);
    mockDb([
      verificationOverride(false),
      {
        match: (sql) => sql.includes('SELECT id, email, password_hash, jwt_version, email_verified_at FROM users'),
        result: () =>
          row({ id: 'u1', email: 'creator@example.com', password_hash: 'h', jwt_version: 0, email_verified_at: null }),
      },
      { match: (sql) => sql.includes('UPDATE profiles SET last_login'), result: () => row({}) },
    ]);

    const res = await buildApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@example.com', password: 'secret123' }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).token).toBeTruthy();
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('issues a fresh token and emails it to an unverified user', async () => {
    mockDb([
      verificationOverride(true),
      {
        match: (sql) => sql.includes('SELECT id, email, email_verified_at FROM users'),
        result: () => row({ id: 'u1', email: 'creator@example.com', email_verified_at: null }),
      },
      { match: (sql) => sql.includes('email_verification_tokens'), result: () => row({ id: 't1' }) },
    ]);

    const res = await buildApp().request('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@example.com' }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('does not send mail when verification is not required (same success response)', async () => {
    mockDb([verificationOverride(false)]);

    const res = await buildApp().request('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@example.com' }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('/api/admin/config superadmin management', () => {
  it('returns the effective config to a superadmin', async () => {
    mockDb([superadminProfileHandler(), verificationOverride(undefined)]);

    const res = await buildApp().request('/api/admin/config', {
      headers: { Authorization: `Bearer ${superadminToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.require_email_verification).toBe(true);
    expect(body.require_email_verification_override).toBeNull();
    expect(body.smtp.host).toBeNull();
    expect(body.smtp.passwordSet).toBe(false);
  });

  it('persists the DB override and SMTP settings', async () => {
    mockDb([superadminProfileHandler(), verificationOverride(undefined)]);

    const res = await buildApp().request('/api/admin/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${superadminToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        require_email_verification: false,
        smtp: { host: 'smtp.example.com', port: 2525, username: 'apikey', from: 'no-reply@example.com', secure: true },
      }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO system_config'),
      ['require_email_verification', 'false']
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO system_config'),
      ['smtp_host', '"smtp.example.com"']
    );
  });

  it('rejects non-superadmins', async () => {
    mockDb([
      {
        match: (sql) => sql.includes('profiles p JOIN users u'),
        result: () => row({ role: 'user', jwt_version: 0 }),
      },
    ]);

    const res = await buildApp().request('/api/admin/config', {
      headers: { Authorization: `Bearer ${superadminToken()}` },
    });
    expect(res.status).toBe(403);
  });

  it('is disabled when admin features are off (403 even for superadmins)', async () => {
    mockedConfig.enableAdminFeatures = false;
    const res = await buildApp().request('/api/admin/config', {
      headers: { Authorization: `Bearer ${superadminToken()}` },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Admin features are disabled');
  });
});
