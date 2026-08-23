import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || '';

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set to a strong, unique value (32+ random characters)');
}

// Known insecure, forgeable JWT secrets must never be accepted. These include
// the placeholder values that ship in the repo templates (a known signing
// secret lets anyone mint tokens for any user, including the superadmin).
const INSECURE_JWT_SECRETS = [
  'dev-secret-change-in-production-min-32-chars!!',
  'change-me-in-production',
  'generate-a-random-64-char-string',
  // Real-looking secrets that were historically committed to the env template
  // docker/.env.2container (visible in public git history). Any install still
  // carrying one is forgeable — refuse to boot so the startup scripts rotate.
  '577a1c275181d034a9bfef43ad38f910f47694574cd55d149c924b4e1cba2732',
  '706943d4abc630b909ea7e9364ff35eaff7a9b9fdde4dddc785a553870bef67d',
];

if (INSECURE_JWT_SECRETS.includes(jwtSecret)) {
  throw new Error('JWT_SECRET is set to a known, insecure value. Set a strong, unique secret.');
}

// The placeholder credentials below exist only for local development. Silently
// connecting to a production database with the well-known `changeme` password
// would be a serious security hazard, so hard-fail in production (mirroring the
// JWT_SECRET handling above).
const databaseUrl = process.env.DATABASE_URL || 'postgres://pantrybutler:changeme@localhost:5432/pantrybutler';

if (nodeEnv === 'production' && (!process.env.DATABASE_URL || databaseUrl.includes('changeme'))) {
  throw new Error('DATABASE_URL must be set to a strong, non-default value in production');
}

export const config = {
  nodeEnv,
  port: parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10),
  databaseUrl,
  jwtSecret,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  appUrl: process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
  publicDir: process.env.PUBLIC_DIR || path.resolve(__dirname, '../public'),
  setupDir: process.env.SETUP_DIR || path.resolve(__dirname, '../../../setup'),
  enableAdminFeatures: process.env.ENABLE_ADMIN_FEATURES === 'true',
  // Email verification for instance creators. Defaults to tracking the
  // admin-features switch (feature off → no verification required); the
  // REQUIRE_EMAIL_VERIFICATION env var can decouple it, and a superadmin can
  // override either from the admin config page (stored in system_config).
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION
    ? process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
    : process.env.ENABLE_ADMIN_FEATURES === 'true',
  // SMTP transport defaults (env-configured; overridable from the admin
  // config page via system_config).
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    username: process.env.SMTP_USERNAME || null,
    password: process.env.SMTP_PASSWORD || null,
    from: process.env.SMTP_FROM || null,
    secure: process.env.SMTP_SECURE === 'true',
  },
  // OAuth / API access
  authCodeTtlMs: parseInt(process.env.AUTH_CODE_TTL_MS || '300000', 10),
  apiTokenMaxTtlMs: parseInt(process.env.API_TOKEN_MAX_TTL_MS || '31536000000', 10), // 1 year
  oauthDevClients: process.env.OAUTH_DEV_CLIENTS === 'true' || nodeEnv !== 'production',
};
