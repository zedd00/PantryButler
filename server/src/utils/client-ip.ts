// Client IP resolution for rate limiting and audit logging.
//
// X-Forwarded-For / X-Real-IP are attacker-controlled on a directly reachable
// server, so they are only honored when the direct socket peer is a configured
// trusted reverse proxy. With no trusted proxy configured (the default for a
// self-hosted single server) the socket remote address is used directly.
import type { Context } from 'hono';

const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function socketPeer(c: Context): string {
  const env = c.env as Record<string, unknown> | undefined;
  const incoming = env?.incoming as
    | { socket?: { remoteAddress?: string }; remoteAddress?: string }
    | undefined;
  return incoming?.socket?.remoteAddress || incoming?.remoteAddress || '';
}

export function clientIp(c: Context): string {
  const peer = socketPeer(c);
  if (peer && TRUSTED_PROXIES.has(peer)) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return c.req.header('x-real-ip') || peer;
  }
  return peer || 'unknown';
}
