import { describe, it, expect, vi } from 'vitest';

const INSECURE = [
  'dev-secret-change-in-production-min-32-chars!!',
  'change-me-in-production',
  'generate-a-random-64-char-string',
  '577a1c275181d034a9bfef43ad38f910f47694574cd55d149c924b4e1cba2732',
  '706943d4abc630b909ea7e9364ff35eaff7a9b9fdde4dddc785a553870bef67d',
];

describe('JWT secret validation', () => {
  it('refuses to boot with any known/insecure JWT_SECRET', async () => {
    for (const secret of INSECURE) {
      vi.resetModules();
      process.env.JWT_SECRET = secret;
      await expect(import('../src/utils/config')).rejects.toThrow(/known, insecure/);
    }
  });

  it('accepts a strong unique JWT_SECRET', async () => {
    vi.resetModules();
    process.env.JWT_SECRET = 'a'.repeat(64);
    const { config } = await import('../src/utils/config');
    expect(config.jwtSecret).toBe('a'.repeat(64));
  });
});

describe('DATABASE_URL production validation', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
  });

  it('refuses to boot in production when DATABASE_URL is unset', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    delete process.env.DATABASE_URL;
    await expect(import('../src/utils/config')).rejects.toThrow(/DATABASE_URL/);
  });

  it('refuses to boot in production when DATABASE_URL uses the changeme placeholder', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.DATABASE_URL = 'postgres://pantrybutler:changeme@localhost:5432/pantrybutler';
    await expect(import('../src/utils/config')).rejects.toThrow(/DATABASE_URL/);
  });

  it('accepts a real DATABASE_URL in production', async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.DATABASE_URL = 'postgres://pantrybutler:realpassword@localhost:5432/pantrybutler';
    const { config } = await import('../src/utils/config');
    expect(config.databaseUrl).toContain('realpassword');
  });

  it('keeps the localhost placeholder default outside production', async () => {
    vi.resetModules();
    process.env.JWT_SECRET = 'a'.repeat(64);
    delete process.env.DATABASE_URL;
    const { config } = await import('../src/utils/config');
    expect(config.databaseUrl).toContain('changeme');
  });
});
