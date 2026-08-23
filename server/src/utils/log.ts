import type { Context, Next } from 'hono';

// Centralised log scrubbing (security req.: "log scrubbing rule for the `pb_`
// prefix, never log request bodies containing them"). Every structured log
// helper in this file funnels its output through `scrubSecret` so a `pb_`
// token, JWT, OAuth code, or PKCE verifier can never reach the log stream,
// even if it ends up inside an error message or stack trace.

const SECRET_PATTERNS: RegExp[] = [
  // Long-lived API tokens: pb_<43-char base64url>
  /pb_[A-Za-z0-9_-]{40,}/g,
  // One-time OAuth auth codes: 43-char base64url
  /\b[A-Za-z0-9_-]{43}\b/g,
  // JWTs: header.payload.signature
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // PKCE verifier/challenge values in URLs or bodies
  /(code_verifier|code_challenge)(["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]{40,}/g,
  // Authorization bearer header values
  /(Bearer|bearer)\s+[A-Za-z0-9._~+/=-]{20,}/g,
  // pb_session cookie values (JWT)
  /pb_session=[A-Za-z0-9._-]+/g,
];

const REDACTED = '[REDACTED]';

export function scrubSecret(value: string): string {
  let out = value;
  for (const re of SECRET_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, (match) => {
      // Keep a stable prefix so logs remain greppable (e.g. `pb_` → `pb_[REDACTED]`)
      const prefix = match.startsWith('pb_') ? 'pb_' : '';
      return prefix + REDACTED;
    });
  }
  return out;
}

// Redact a single value (string or something containing strings) without
// dropping non-sensitive structure. Errors are reduced to name + message, with
// the message scrubbed.
export function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubSecret(value);
  if (value instanceof Error) {
    const message = scrubSecret(value.message);
    return `${value.name}: ${message}`;
  }
  if (value instanceof URL) return scrubSecret(value.toString());
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = scrubValue(val);
    }
    return out;
  }
  return value;
}

export function scrubMessage(label: string, ...args: unknown[]): string {
  const parts = args.map((a) => {
    if (typeof a === 'string') return a;
    return JSON.stringify(scrubValue(a));
  });
  return `${label} ${parts.join(' ')}`.trim();
}

// Route error logger: scrub before emitting.
export function logError(label: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(scrubMessage(`${label}:`, err));
}

// Hono request logger that prints method + path with the query string
// scrubbed. Replaces the default `logger()` which prints the raw URL
// (including any `code`, `state`, `code_challenge` query params).
export function scrubbedLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, url } = c.req;
    const path = scrubUrlPath(url);
    await next();
    const ms = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`${method} ${path} ${c.res.status} ${ms}ms`);
  };
}

// Strip or redact query parameters that can carry secrets before a URL is
// logged. `code`/`state`/`code_challenge`/`code_verifier`/`access_token`
// values are redacted; everything else is preserved for debuggability.
export function scrubUrlPath(rawUrl: string): string {
  const url = new URL(rawUrl);
  const sensitive = ['code', 'state', 'code_challenge', 'code_verifier', 'access_token', 'token'];
  for (const key of sensitive) {
    if (url.searchParams.has(key)) url.searchParams.set(key, REDACTED);
  }
  return url.pathname + url.search;
}
