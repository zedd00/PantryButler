import { query } from '../db/pool';
import { config } from './config';

// Global application configuration, editable by a superadmin from the admin
// config page. Values live in `system_config` (JSONB); a key's absence means
// "fall back to the environment default" (see config.ts).

export async function getSystemConfigValue<T>(key: string): Promise<T | undefined> {
  const result = await query('SELECT value FROM system_config WHERE config_key = $1', [key]);
  const value = result.rows[0]?.value;
  return value === undefined ? undefined : (value as T);
}

export async function setSystemConfigValue(key: string, value: unknown): Promise<void> {
  await query(
    `INSERT INTO system_config (config_key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

export async function clearSystemConfigValue(key: string): Promise<void> {
  await query('DELETE FROM system_config WHERE config_key = $1', [key]);
}

// Effective email-verification requirement: DB override > env > flag default.
// The flag default ties verification to --enable-admin-features, so a feature
// disabled at the process level means no verification unless a superadmin
// explicitly opted in via the config page.
export async function isEmailVerificationRequired(): Promise<boolean> {
  const override = await getSystemConfigValue<boolean>('require_email_verification');
  if (override !== undefined) return override;
  return config.requireEmailVerification;
}

// Effective public/base URL used in emails and links (e.g. the verification
// link). A superadmin-set value in system_config (external_url) wins over the
// APP_URL / CORS_ORIGIN env defaults, which in turn default to localhost.
export async function getEffectiveAppUrl(): Promise<string> {
  const override = await getSystemConfigValue<string>('external_url');
  if (override && String(override).trim()) {
    return String(override).trim().replace(/\/+$/, '');
  }
  return config.appUrl;
}

export interface EffectiveSmtpConfig {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  from: string;
  secure: boolean;
}

// Effective SMTP transport settings: DB override (per key) > env defaults.
export async function getEffectiveSmtp(): Promise<EffectiveSmtpConfig> {
  const [host, port, username, password, from, secure] = await Promise.all([
    getSystemConfigValue<string>('smtp_host'),
    getSystemConfigValue<number>('smtp_port'),
    getSystemConfigValue<string>('smtp_username'),
    getSystemConfigValue<string>('smtp_password'),
    getSystemConfigValue<string>('smtp_from'),
    getSystemConfigValue<boolean>('smtp_secure'),
  ]);
  return {
    host: host ?? config.smtp.host ?? '',
    port: port ?? config.smtp.port,
    username: username ?? config.smtp.username,
    password: password ?? config.smtp.password,
    from: from ?? config.smtp.from ?? '',
    secure: secure ?? config.smtp.secure,
  };
}

// Which config keys are stored in the database (used to render the admin
// config page, e.g. masking the stored password).
export async function getStoredSmtpOverrides(): Promise<{
  host: string | null;
  port: number | null;
  username: string | null;
  passwordSet: boolean;
  from: string | null;
  secure: boolean | null;
}> {
  const [host, port, username, password, from, secure] = await Promise.all([
    getSystemConfigValue<string>('smtp_host'),
    getSystemConfigValue<number>('smtp_port'),
    getSystemConfigValue<string>('smtp_username'),
    getSystemConfigValue<string>('smtp_password'),
    getSystemConfigValue<string>('smtp_from'),
    getSystemConfigValue<boolean>('smtp_secure'),
  ]);
  return {
    host: host ?? null,
    port: port ?? null,
    username: username ?? null,
    passwordSet: password !== undefined,
    from: from ?? null,
    secure: secure ?? null,
  };
}