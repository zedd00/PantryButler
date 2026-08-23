import crypto from 'crypto';

export const API_TOKEN_PREFIX = 'pb_';

// Random raw bytes -> base64url secret.
function randomSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateApiToken(): { token: string; hash: string } {
  const token = API_TOKEN_PREFIX + randomSecret();
  return { token, hash: hashSecret(token) };
}

// Random one-time authorization code (opaque, high entropy).
export function generateAuthCode(): { code: string; hash: string } {
  const code = randomSecret();
  return { code, hash: hashSecret(code) };
}

// RFC 7636 S256 challenge verification.
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const digest = crypto.createHash('sha256').update(verifier).digest('base64url');
  return timingSafeEqual(digest, challenge);
}

// Constant-time string comparison.
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// API token secrets are stored as SHA-256 hashes only. Choice of SHA-256 (vs
// HMAC): tokens are ~256 bits of CSPRNG entropy, so a plain digest is not
// brute-forceable; HMAC adds no security and couples token validity to
// JWT_SECRET rotation.
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
