import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { fetchPublicCapped, TooLargeError, BlockedUrlError, type FetchResult } from '../utils/ssrf';
import { createRateLimiter } from '../utils/rate-limit';
import { clientIp } from '../utils/client-ip';

const images = new Hono();

const proxySchema = z.object({
  url: z.string().url(),
});

// Raster image types only. SVG is intentionally excluded: it can contain
// executable script, and serving it same-origin (as this proxy does) is a
// stored-XSS vector. Recipe images don't need vector graphics.
const IMAGE_CONTENT_TYPES = /^image\/(png|jpe?g|gif|webp|avif|bmp)/i;

// Per-IP limit so the open proxy can't be turned into a free fetch/spam relay,
// plus a tiny in-memory cache (TTL, size-capped) to absorb repeated <img> loads
// of the same URL across visits and users.
const proxyLimiter = createRateLimiter(120, 60 * 1000);
const CACHE_MAX_ENTRIES = 100;
const CACHE_MAX_BYTES = 50 * 1024 * 1024; // ~50 MB total, not 100 × 5 MB
const CACHE_TTL_MS = 5 * 60 * 1000;

const proxyCache = new Map<string, { expiresAt: number; result: FetchResult }>();

function cacheGet(key: string): FetchResult | undefined {
  const entry = proxyCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    proxyCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function cacheSet(key: string, result: FetchResult): void {
  let totalBytes = 0;
  for (const [k, v] of proxyCache) {
    if (v.expiresAt <= Date.now()) {
      proxyCache.delete(k);
      continue;
    }
    totalBytes += v.result.bytes.length;
  }
  if (proxyCache.size >= CACHE_MAX_ENTRIES || totalBytes + result.bytes.length > CACHE_MAX_BYTES) {
    const oldestKey = proxyCache.keys().next().value;
    if (oldestKey) proxyCache.delete(oldestKey);
  }
  proxyCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
}

// Proxies externally-hosted recipe images so that visitors of public recipe
// pages never make requests to third-party hosts (prevents IP/referrer leaks
// to an attacker-controlled image URL). SSRF-hardened via utils/ssrf.
images.get('/proxy', zValidator('query', proxySchema), async (c) => {
  try {
    if (!proxyLimiter(clientIp(c))) {
      return c.json({ error: 'rateLimited', message: 'Too many requests, please try again later' }, 429);
    }

    const { url } = c.req.valid('query');
    const cacheKey = `image:${url}`;

    let fetched = cacheGet(cacheKey);
    if (!fetched) {
      try {
        fetched = await fetchPublicCapped(url);
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return c.json({ error: 'timeout', message: 'Request timed out' }, 408);
        }
        if (error instanceof TooLargeError) {
          return c.json({ error: 'tooLarge', message: 'Image is too large' }, 413);
        }
        if (error instanceof BlockedUrlError) {
          return c.json({ error: 'blockedUrl', message: 'URL is not allowed' }, 403);
        }
        return c.json({ error: 'fetchFailed', message: 'Failed to fetch image' }, 502);
      }
      cacheSet(cacheKey, fetched);
    }

    if (!fetched.response.ok) {
      return c.json({ error: 'fetchFailed', message: `Upstream HTTP ${fetched.response.status}` }, 502);
    }

    const contentType = fetched.contentType.split(';')[0].trim();
    if (!IMAGE_CONTENT_TYPES.test(contentType)) {
      return c.json({ error: 'notImage', message: 'URL did not return an image' }, 415);
    }

    const ext = contentType.split('/')[1] || 'img';
    return new Response(fetched.bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Serve as a download attachment so a top-level navigation to this URL
        // can never render attacker-controlled markup/script in the app origin.
        'Content-Disposition': `attachment; filename="image.${ext}"`,
        // Defense-in-depth: even if a browser ignores Content-Disposition, the
        // sandbox + default-src 'none' CSP prevents script execution.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('Image proxy error:', err);
    return c.json({ error: 'proxyFailed', message: 'Failed to proxy image' }, 500);
  }
});

export { images };
