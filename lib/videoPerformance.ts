/**
 * Video Performance Optimization and Monitoring
 * Tracks iframe load times and implements caching strategies
 */

interface FrameLoadMetrics {
  mediaId: number;
  startTime: number;
  loadTime?: number;
  cached: boolean;
  timestamp: number;
}

const CACHE_KEY = 'video_load_metrics';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached load metrics for a media item
 */
export function getCachedMetrics(mediaId: number): FrameLoadMetrics | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${mediaId}`);
    if (!cached) return null;

    const metrics = JSON.parse(cached) as FrameLoadMetrics;
    const age = Date.now() - metrics.timestamp;

    // Return null if cache is expired
    if (age > CACHE_EXPIRY) {
      localStorage.removeItem(`${CACHE_KEY}_${mediaId}`);
      return null;
    }

    return metrics;
  } catch (e) {
    console.error('Error reading cached metrics:', e);
    return null;
  }
}

/**
 * Track iframe load performance
 */
export function trackFrameLoad(
  mediaId: number,
  startTime: number,
  endTime: number,
  cached: boolean = false
): FrameLoadMetrics {
  const loadTime = endTime - startTime;
  const metrics: FrameLoadMetrics = {
    mediaId,
    startTime,
    loadTime,
    cached,
    timestamp: Date.now(),
  };

  // Cache the metrics
  try {
    localStorage.setItem(`${CACHE_KEY}_${mediaId}`, JSON.stringify(metrics));
  } catch (e) {
    console.error('Error caching metrics:', e);
  }

  // Log performance data
  if (window.performance && (window.performance as any).measureUserAgentSpecificMemory) {
    console.log(`Frame loaded for media ${mediaId}: ${loadTime}ms`, metrics);
  }

  return metrics;
}

/**
 * Get average load time for performance analysis
 */
export function getAverageLoadTime(samples: number = 5): number {
  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(CACHE_KEY)
    );
    const metrics = keys
      .slice(-samples)
      .map((key) => {
        try {
          return JSON.parse(localStorage.getItem(key) || '{}') as FrameLoadMetrics;
        } catch {
          return null;
        }
      })
      .filter((m): m is FrameLoadMetrics => m !== null && m.loadTime !== undefined);

    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (m.loadTime || 0), 0);
    return sum / metrics.length;
  } catch (e) {
    console.error('Error calculating average load time:', e);
    return 0;
  }
}

/**
 * Prefetch DNS and preconnect to vidking.net
 */
export function prefetchVidkingResources(): void {
  if (typeof document === 'undefined') return;

  // Check if link elements already exist
  if (document.querySelector('link[rel="dns-prefetch"][href*="vidking"]')) {
    return;
  }

  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = 'https://www.vidking.net';

  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://www.vidking.net';

  document.head.appendChild(dnsPrefetch);
  document.head.appendChild(preconnect);
}

/**
 * Clear old cache entries
 */
export function clearExpiredCache(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(CACHE_KEY)
    );
    keys.forEach((key) => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}') as FrameLoadMetrics;
        const age = Date.now() - item.timestamp;
        if (age > CACHE_EXPIRY) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.error('Error clearing expired cache:', e);
  }
}
