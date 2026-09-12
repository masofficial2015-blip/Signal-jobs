/**
 * In-memory rate limiter for single-instance Next.js deployments (Railway / Node.js).
 * Uses a sliding-reset window per client key (typically client IP).
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimitConfig) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // Periodic cleanup of expired records every 5 minutes to prevent memory accumulation
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.store.entries()) {
          if (now > record.resetTime) {
            this.store.delete(key);
          }
        }
      }, 5 * 60 * 1000);
      timer.unref?.();
    }
  }

  /**
   * Checks if a request for the given key is within the rate limit.
   * Increments attempt count and returns limit status.
   */
  check(key: string): {
    success: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      const resetTime = now + this.windowMs;
      this.store.set(key, { count: 1, resetTime });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetTime,
        retryAfterSeconds: 0,
      };
    }

    if (record.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfterSeconds,
      };
    }

    record.count += 1;
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - record.count,
      resetTime: record.resetTime,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Resets rate limit for a given key (e.g. after successful authentication).
   */
  reset(key: string): void {
    this.store.delete(key);
  }
}

// Default login rate limiter: 5 attempts per 15 minutes per IP
export const loginRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
});
