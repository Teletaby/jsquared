/**
 * Simple in-memory rate limiting
 * For production with multiple servers, use Redis
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

/**
 * Check if a request should be rate limited
 * @param identifier - IP address, user ID, or any unique identifier
 * @param config - Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }

  // Increment counter
  entry.count++;

  if (entry.count > config.maxRequests) {
    return false; // Rate limit exceeded
  }

  return true;
}

/**
 * Get remaining requests for an identifier
 */
export function getRateLimitInfo(identifier: string, config: RateLimitConfig) {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Clear rate limit for an identifier (useful for testing)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Clean up expired entries (run periodically)
 */
export function cleanExpiredRateLimits(): number {
  let cleaned = 0;
  const now = Date.now();

  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Periodically clean expired rate limits every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    const cleaned = cleanExpiredRateLimits();
    if (cleaned > 0) {
      console.log(`[Rate Limit] Cleaned ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}

// Predefined configs for common use cases
export const RATE_LIMITS = {
  SEARCH: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
  CHAT: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
  AUTH: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  API: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
  VIDEO: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
};
