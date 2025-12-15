// Simple in-memory cache with TTL support
interface CacheItem<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheItem<any>>();

// Default TTLs in milliseconds
export const CACHE_TTL = {
  TMDB_DETAILS: 48 * 60 * 60 * 1000, // 48 hours for movie/TV details
  TMDB_SEARCH: 24 * 60 * 60 * 1000,   // 24 hours for search results
  TMDB_LOGOS: 7 * 24 * 60 * 60 * 1000, // 7 days for logos
  CAST_DETAILS: 48 * 60 * 60 * 1000,  // 48 hours for cast
  TRAILER: 7 * 24 * 60 * 60 * 1000,   // 7 days for trailers
};

/**
 * Get item from cache if it exists and hasn't expired
 */
export function getFromCache<T>(key: string): T | null {
  const item = cache.get(key);
  
  if (!item) {
    return null;
  }

  // Check if cache has expired
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }

  return item.data as T;
}

/**
 * Set item in cache with TTL
 */
export function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL.TMDB_DETAILS): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

/**
 * Clear specific cache entry
 */
export function clearCache(key: string): void {
  cache.delete(key);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Get cache size info
 */
export function getCacheStats(): { size: number; keys: string[] } {
  const keys = Array.from(cache.keys());
  return {
    size: keys.length,
    keys,
  };
}

/**
 * Clean expired items from cache (run periodically)
 */
export function cleanExpiredCache(): number {
  let cleaned = 0;
  const now = Date.now();

  const entries = Array.from(cache.entries());
  for (const [key, item] of entries) {
    if (now > item.expires) {
      cache.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Periodically clean expired cache every hour
if (typeof window === 'undefined') {
  // Only run on server side
  setInterval(() => {
    const cleaned = cleanExpiredCache();
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired entries`);
    }
  }, 60 * 60 * 1000); // Every hour
}
