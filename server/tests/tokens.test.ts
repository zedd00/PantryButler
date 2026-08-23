import { describe, it, expect } from 'vitest';
import {
  generateApiToken,
  generateAuthCode,
  hashSecret,
  verifyPkce,
  timingSafeEqual,
  sha256Hex,
  API_TOKEN_PREFIX,
} from '../src/utils/tokens';

describe('api token generation & hashing', () => {
  it('prefixes secrets with pb_ and stores only a SHA-256 hash', () => {
    const { token, hash } = generateApiToken();
    expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(API_TOKEN_PREFIX.length + 40);
    expect(hash).toBe(hashSecret(token));
    expect(hash).toHaveLength(64); // sha256 hex
    expect(hash).not.toBe(token);
  });

  it('produces a unique secret per call', () => {
    const a = generateApiToken();
    const b = generateApiToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('reproduces the same hash for the same secret (lookup by rehash)', () => {
    const { token, hash } = generateApiToken();
    expect(hashSecret(token)).toBe(hash);
  });
});

describe('one-time authorization codes', () => {
  it('generates a code stored as its hash', () => {
    const { code, hash } = generateAuthCode();
    expect(code.length).toBeGreaterThan(20);
    expect(hash).toBe(hashSecret(code));
  });
});

describe('PKCE S256 verification', () => {
  // RFC 7636 appendix B example vector.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = sha256Hex(''); // placeholder, replaced below

  it('accepts the canonical RFC 7636 verifier/challenge pair', () => {
    const { createHash } = require('node:crypto') as typeof import('node:crypto');
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce(verifier, expected)).toBe(true);
  });

  it('rejects a wrong verifier', () => {
    const { createHash } = require('node:crypto') as typeof import('node:crypto');
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce('wrong-verifier-0000000000000000', expected)).toBe(false);
  });

  it('rejects empty inputs', () => {
    expect(verifyPkce('', 'x'.repeat(43))).toBe(false);
    expect(verifyPkce('x'.repeat(43), '')).toBe(false);
  });

  it('rejects non-base64url challenge (won\'t match)', () => {
    expect(verifyPkce(verifier, '!!!!not-valid!!!!')).toBe(false);
  });

  it('keeps challenge comparison constant-time against length mismatch', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
  });
});

describe('sha256Hex', () => {
  it('produces a stable 64-char hex digest', () => {
    const a = sha256Hex('hello');
    const b = sha256Hex('hello');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(sha256Hex('hello')).not.toBe(sha256Hex('hellp'));
  });
});
