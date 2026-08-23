// In-memory per-key rate buckets shared by auth, token-mint, OAuth token,
// nutrition, and image-proxy endpoints. Single-process self-hosted app: a Map
// is sufficient; a real deployment behind multiple nodes would need a shared
// store (redis).
//
// Expired buckets are swept once the map grows past a threshold, so the memory
// footprint stays bounded even under a heavy random-IP / random-key flood.
//
// Auth and credential-exchange endpoints use failures-only buckets (see
// `createFailureLimiter`) so legitimate traffic is never throttled; the
// high-volume resource endpoints (nutrition, image proxy) use
// `createRateLimiter`, which counts every request.

const MAX_BUCKETS_BEFORE_SWEEP = 5000;

export type RateLimiter = (key: string) => boolean;

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const sweep = () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  };

  return (key: string): boolean => {
    const now = Date.now();
    if (buckets.size >= MAX_BUCKETS_BEFORE_SWEEP) {
      sweep();
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= max;
  };
}

// Failures-only limiter: `isBlocked` peeks without counting, and only
// `recordFailure` increments the bucket. Used for auth so successful logins /
// registrations never consume the budget — legitimate traffic (including users
// behind a shared NAT IP) is never throttled, only repeated failed attempts.
export interface FailureLimiter {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
}

export function createFailureLimiter(max: number, windowMs: number): FailureLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const sweep = () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  };

  const live = (key: string, now: number): { count: number } | null => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      return null;
    }
    return bucket;
  };

  return {
    isBlocked(key) {
      const bucket = live(key, Date.now());
      return bucket !== null && bucket.count >= max;
    },
    recordFailure(key) {
      const now = Date.now();
      if (buckets.size >= MAX_BUCKETS_BEFORE_SWEEP) {
        sweep();
      }
      const bucket = live(key, now);
      if (bucket) {
        bucket.count += 1;
      } else {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
      }
    },
  };
}
