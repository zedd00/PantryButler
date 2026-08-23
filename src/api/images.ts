export function proxiedImage(url?: string | null): string | undefined {
  if (!url) return undefined;

  // Never proxy local / data / blob URLs.
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  let parsed: URL;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    return url;
  }

  // Same-origin images need no proxy.
  if (parsed.origin === window.location.origin) return url;

  // Proxy external http(s) images through the server so public-page visitors
  // never contact a third-party host (SSRF-hardened server-side).
  return `/api/images/proxy?url=${encodeURIComponent(parsed.href)}`;
}