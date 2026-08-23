import { describe, it, expect } from 'vitest';
import { scrubSecret, scrubValue, scrubUrlPath, scrubbedLogger } from '../src/utils/log';
import type { Context } from 'hono';

describe('log scrubbing (security req: pb_ prefix never in logs)', () => {
  it('redacts pb_-prefixed API tokens but keeps the prefix for greppability', () => {
    const token = `pb_${'a'.repeat(43)}`;
    expect(scrubSecret(`minted token: ${token}`)).toBe('minted token: pb_[REDACTED]');
    expect(scrubSecret(token)).not.toContain('a'.repeat(40));
  });

  it('redacts one-time auth codes (43-char base64url) and JWTs', () => {
    const code = 'a'.repeat(43);
    expect(scrubSecret(`code=${code}`)).not.toContain('a'.repeat(40));

    const jwt = `eyJabc.defghijk.${'x'.repeat(30)}`;
    const scrubbed = scrubSecret(`cookie pb_session=${jwt}`);
    expect(scrubbed).not.toContain('eyJ');
    expect(scrubbed).toContain('[REDACTED]');
  });

  it('redacts PKCE verifier/challenge values by key', () => {
    const verifier = 'V'.repeat(60);
    const out = scrubSecret(`code_verifier=${verifier}`);
    expect(out).not.toContain(verifier);
  });

  it('scrubs error objects down to a redacted name+message', () => {
    const token = `pb_${'b'.repeat(43)}`;
    const err = new Error(`lookup failed with token ${token}`);
    const out = scrubValue(err);
    expect(String(out)).not.toContain('b'.repeat(40));
    expect(String(out)).toContain('Error: lookup failed with token pb_[REDACTED]');
  });

  it('recursively scrubs nested object values', () => {
    const token = `pb_${'c'.repeat(43)}`;
    const out = scrubValue({ outer: { inner: [token] }, safe: 42 });
    expect(JSON.stringify(out)).not.toContain('c'.repeat(40));
    expect(JSON.stringify(out)).toContain('pb_[REDACTED]');
    expect(JSON.stringify(out)).toContain('"safe":42');
  });

  it('redacts sensitive query params while preserving the rest of the URL', () => {
    const raw = 'https://example.com/oauth/authorize?client_id=abc&code=SECRETCODE&state=xyz';
    const out = scrubUrlPath(raw);
    expect(out).not.toContain('SECRETCODE');
    expect(out).toContain('client_id=abc');
    expect(out).toContain('state=%5BREDACTED%5D');
  });
});

describe('scrubbedLogger middleware', () => {
  it('logs a path without leaking query values', async () => {
    const logs: string[] = [];
    const orig = console.log;
    // eslint-disable-next-line no-console
    console.log = (msg: string) => logs.push(msg);
    const c = {
      req: { method: 'GET', url: 'http://localhost/oauth/authorize?code=LEAK', path: '/oauth/authorize' },
      res: { status: 200 },
    } as unknown as Context;
    const next = async () => {};
    try {
      await scrubbedLogger()(c, next);
    } finally {
      // eslint-disable-next-line no-console
      console.log = orig;
    }
    expect(logs.join('\n')).toContain('GET /oauth/authorize');
    expect(logs.join('\n')).not.toContain('LEAK');
  });
});
