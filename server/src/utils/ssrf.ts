import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { request as httpRequest, type IncomingHttpHeaders } from 'http';
import { request as httpsRequest } from 'https';

export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 5;
export const FETCH_TIMEOUT_MS = 10000;

function ipToUint32(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function isBlockedIpv4(ip: string): boolean {
  const n = ipToUint32(ip);
  const inRange = (a: number, b: number) => n >= a && n <= b;
  return (
    inRange(0x00000000, 0x00ffffff) || // 0.0.0.0/8
    inRange(0x0a000000, 0x0affffff) || // 10.0.0.0/8
    inRange(0x7f000000, 0x7fffffff) || // 127.0.0.0/8
    inRange(0xa9fe0000, 0xa9feffff) || // 169.254.0.0/16
    inRange(0xac100000, 0xac1fffff) || // 172.16.0.0/12
    inRange(0xc0a80000, 0xc0a8ffff) || // 192.168.0.0/16
    inRange(0x64400000, 0x647fffff) || // 100.64.0.0/10 (CGNAT)
    inRange(0xc0000000, 0xc00000ff) || // 192.0.0.0/24
    inRange(0xc6120000, 0xc613ffff) || // 198.18.0.0/15 (benchmarking)
    inRange(0xe0000000, 0xefffffff) || // 224.0.0.0/4 (multicast)
    inRange(0xf0000000, 0xffffffff)    // 240.0.0.0/4 (reserved)
  );
}

// Parse an IPv6 address into 8 hextets, expanding `::` and folding an optional
// dotted-decimal IPv4 tail. Returns null on malformed input.
function parseIpv6(ip: string): number[] | null {
  const lower = ip.toLowerCase();
  const parts = lower.split('::');
  if (parts.length > 2) return null;

  const left = parts[0] === '' ? [] : parts[0].split(':');
  const right = parts.length === 2 && parts[1] !== '' ? parts[1].split(':') : [];

  const hextets: number[] = [];
  const push = (chunk: string): boolean => {
    if (chunk.includes('.')) {
      const octets = chunk.split('.').map(Number);
      if (octets.length !== 4 || octets.some((o) => !Number.isFinite(o) || o < 0 || o > 255)) {
        return false;
      }
      hextets.push(((octets[0] << 8) | octets[1]) >>> 0, ((octets[2] << 8) | octets[3]) >>> 0);
      return true;
    }
    const value = parseInt(chunk, 16);
    if (!Number.isFinite(value) || value < 0 || value > 0xffff) return false;
    hextets.push(value);
    return true;
  };

  for (const part of left) {
    if (!push(part)) return null;
  }
  const leftCount = hextets.length;
  if (parts.length === 2) {
    for (const part of right) {
      if (!push(part)) return null;
    }
  }
  const total = hextets.length;
  if (total > 8) return null;
  if (parts.length === 2) {
    const zeros = 8 - total;
    if (zeros < 0) return null;
    return [...hextets.slice(0, leftCount), ...new Array(zeros).fill(0), ...hextets.slice(leftCount)];
  }
  return total === 8 ? hextets : null;
}

function hextetsToIpv4(h: number[]): string {
  return `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
}

export function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1' || lower === '0:0:0:0:0:0:0:0' || lower === '0:0:0:0:0:0:0:1') {
    return true; // unspecified / loopback
  }

  const h = parseIpv6(lower);
  if (!h) return true; // malformed → treat as blocked

  // IPv4-embedded encodings can smuggle private/loopback IPv4 addresses past a
  // plain dotted-decimal check, so always decode and re-check the embedded IPv4.
  const ipv4Mapped = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff;
  const ipv4Compatible = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0;
  if (ipv4Mapped || ipv4Compatible) {
    if (isBlockedIpv4(hextetsToIpv4(h))) return true;
  }

  // 6to4 (2002::/16): IPv4 lives in hextets 1-2.
  if (h[0] === 0x2002) {
    const embedded = `${h[1] >> 8}.${h[1] & 0xff}.${h[2] >> 8}.${h[2] & 0xff}`;
    if (isBlockedIpv4(embedded)) return true;
  }

  // Teredo (2001::/32): the server IPv4 is hextets 2-3 XOR 0xffff.
  if (h[0] === 0x2001 && h[1] === 0x0000) {
    const server = `${(h[2] ^ 0xffff) >> 8}.${(h[2] ^ 0xffff) & 0xff}.${(h[3] ^ 0xffff) >> 8}.${(h[3] ^ 0xffff) & 0xff}`;
    if (isBlockedIpv4(server)) return true;
  }

  // NAT64 (64:ff9b::/96): IPv4 lives in the last 32 bits.
  if (h[0] === 0x0064 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0) {
    if (isBlockedIpv4(hextetsToIpv4(h))) return true;
  }

  const first = h[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 (site-local)
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
  return false;
}

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true; // unknown → treat as blocked
}

export async function resolveHostBlocked(hostname: string): Promise<boolean> {
  if (!hostname) return true;
  try {
    const result = await lookup(hostname, { all: true, verbatim: true });
    if (result.length === 0) return true;
    return result.some((entry) => isBlockedAddress(entry.address));
  } catch {
    return true; // resolution failure → blocked
  }
}

export class BlockedUrlError extends Error {}
export class TooLargeError extends Error {}

export interface PinnedFetchResponse {
  ok: boolean;
  status: number;
}

export interface FetchResult {
  response: PinnedFetchResponse;
  bytes: Buffer;
  contentType: string;
}

// Resolve a hostname once and return the IPs that survive the private/loopback
// blocklist. An empty result means every answer was blocked (or resolution
// failed), so callers reject the request.
async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  const result = await lookup(hostname, { all: true, verbatim: true });
  if (result.length === 0) return [];
  if (result.some((entry) => isBlockedAddress(entry.address))) return [];
  return result.map((entry) => entry.address);
}

// Raw single-hop GET against a specific IP, with the real hostname carried in
// the Host header / TLS SNI so virtual-hosted sites resolve correctly. Pinning
// the connection to an address that was verified public *before* the request
// closes the DNS-rebinding TOCTOU window that a bare fetch() leaves open.
async function fetchPinned(
  url: string,
  pinnedAddresses: string[],
  timeoutMs: number,
): Promise<{ status: number; headers: IncomingHttpHeaders; bytes: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const requestModule = isHttps ? httpsRequest : httpRequest;
    const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;
    const path = parsed.pathname + parsed.search;
    const baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; PantryButler/1.0; +https://pantrybutler.com)',
      'Accept-Encoding': 'identity',
      Host: parsed.host,
    };

    let idx = 0;
    const attempt = (): void => {
      if (idx >= pinnedAddresses.length) {
        reject(new BlockedUrlError('Could not connect to target'));
        return;
      }
      const address = pinnedAddresses[idx++];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const req = requestModule(
        {
          hostname: address,
          port,
          path,
          method: 'GET',
          headers: baseHeaders,
          servername: isHttps ? parsed.hostname : undefined,
          signal: controller.signal,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let total = 0;
          res.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_RESPONSE_BYTES) {
              clearTimeout(timeoutId);
              res.destroy();
              reject(new TooLargeError('Response too large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            clearTimeout(timeoutId);
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              bytes: Buffer.concat(chunks),
            });
          });
          res.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
        },
      );

      req.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timeoutId);
        // Try the next resolved address only for transient connection failures;
        // DNS/TLS errors on the hostname itself are fatal.
        if (
          err.code === 'ECONNREFUSED' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ECONNRESET' ||
          err.code === 'ENOTFOUND' ||
          err.code === 'EHOSTUNREACH' ||
          err.code === 'ENETUNREACH' ||
          err.code === 'EAI_AGAIN'
        ) {
          attempt();
        } else {
          reject(err);
        }
      });

      req.end();
    };

    attempt();
  });
}

export async function fetchPublicCapped(url: string): Promise<FetchResult> {
  let currentUrl = url;
  let redirects = MAX_REDIRECTS;

  for (;;) {
    const parsed = new URL(currentUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BlockedUrlError('Invalid protocol');
    }

    // Resolve once and pin. If any answer is private/loopback the hostname is
    // rejected outright; the eventual connection only ever uses the addresses
    // verified here, so a rebinding DNS server cannot slip a private address in
    // after the check.
    const pinned = await resolvePublicAddresses(parsed.hostname);
    if (pinned.length === 0) {
      throw new BlockedUrlError('Target address is blocked');
    }

    const { status, headers, bytes } = await fetchPinned(currentUrl, pinned, FETCH_TIMEOUT_MS);

    if (status >= 300 && status < 400) {
      const location = headers.location;
      if (!location || Array.isArray(location) || redirects <= 0) {
        throw new BlockedUrlError('Too many redirects');
      }
      redirects -= 1;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    const contentType = headers['content-type'] || 'application/octet-stream';
    return {
      response: { ok: status >= 200 && status < 300, status },
      bytes,
      contentType: Array.isArray(contentType) ? contentType[0] : contentType,
    };
  }
}