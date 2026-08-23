import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFailureLimiter, createRateLimiter } from '../src/utils/rate-limit';

describe('createFailureLimiter (failures-only auth throttling)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not block a fresh key', () => {
    const limiter = createFailureLimiter(3, 60_000);
    expect(limiter.isBlocked('ip:user@example.com')).toBe(false);
  });

  it('blocks only after `max` recorded failures', () => {
    const limiter = createFailureLimiter(3, 60_000);
    const key = 'ip:user@example.com';
    expect(limiter.isBlocked(key)).toBe(false);
    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(false);
    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(false);
    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);
  });

  it('isBlocked is a pure peek and never consumes the budget', () => {
    const limiter = createFailureLimiter(3, 60_000);
    const key = 'a';
    for (let i = 0; i < 100; i++) {
      limiter.isBlocked(key);
    }
    expect(limiter.isBlocked(key)).toBe(false);
  });

  it('keeps keys independent', () => {
    const limiter = createFailureLimiter(2, 60_000);
    const bad = 'ip:bad@example.com';
    const good = 'ip:good@example.com';
    limiter.recordFailure(bad);
    limiter.recordFailure(bad);
    expect(limiter.isBlocked(bad)).toBe(true);
    expect(limiter.isBlocked(good)).toBe(false);
  });

  it('expires the bucket after the window elapses', () => {
    const limiter = createFailureLimiter(2, 60_000);
    const key = 'ip:user@example.com';
    limiter.recordFailure(key);
    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);

    vi.advanceTimersByTime(60_001);
    expect(limiter.isBlocked(key)).toBe(false);
    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(false);
  });

  it('successes never recorded => unlimited attempts stay unblocked', () => {
    const limiter = createFailureLimiter(5, 60_000);
    const key = 'ip:user@example.com';
    for (let i = 0; i < 100; i++) {
      // A successful login does not call recordFailure.
      expect(limiter.isBlocked(key)).toBe(false);
    }
  });

  it('createRateLimiter (volume endpoints) still counts every call', () => {
    const limiter = createRateLimiter(3, 60_000);
    const key = 'ip';
    expect(limiter(key)).toBe(true);
    expect(limiter(key)).toBe(true);
    expect(limiter(key)).toBe(true);
    expect(limiter(key)).toBe(false);
  });
});
