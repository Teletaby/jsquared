/**
 * Calculate watch progress percentage
 * @param currentTime Current playback time in seconds
 * @param totalDuration Total duration in seconds
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(currentTime: number, totalDuration: number): number {
  if (!totalDuration || totalDuration === 0) {
    return 0;
  }
  return Math.round((currentTime / totalDuration) * 100);
}

/**
 * Format time for display
 * @param seconds Time in seconds
 * @returns Formatted string (e.g., "1:23:45")
 */
export function formatTime(seconds: number): string {
  if (!seconds) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Determine if content is finished based on progress
 * @param progress Progress percentage (0-100)
 * @returns Boolean indicating if content is considered finished
 */
export function isContentFinished(progress: number): boolean {
  return progress >= 90; // 90% or more watched
}

/**
 * Format duration from minutes to hours and minutes
 * @param minutes Duration in minutes
 * @returns Formatted string (e.g., "1h 44m" or "44m")
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes === 0) return '0m';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

/**
 * Fetch the current video source setting from the server
 * @returns Promise<'videasy' | 'vidlink' | 'vidnest'> The current video source
 */
export async function getVideoSourceSetting(): Promise<'videasy' | 'vidlink' | 'vidnest'> {
  try {
    const res = await fetch('/api/admin/maintenance');
    if (!res.ok) {
      return 'videasy'; // Default to videasy if fetch fails
    }
    const data = await res.json();
    return data.videoSource || 'videasy';
  } catch (error) {
    console.error('Error fetching video source setting:', error);
    return 'videasy'; // Default to videasy on error
  }
}

/**
 * Map source name to numeric id used in URLs: videasy=1, vidlink=2, vidnest=3
 */
export function sourceNameToId(source?: string | null): string | undefined {
  if (!source) return undefined;
  const map: Record<string, string> = { videasy: '1', vidlink: '2', vidnest: '3' };
  return map[source] || undefined;
}

/**
 * Map numeric id back to source name
 */
export function sourceIdToName(id?: string | null): 'videasy' | 'vidlink' | 'vidnest' | undefined {
  if (!id) return undefined;
  const map: Record<string, 'videasy' | 'vidlink' | 'vidnest'> = { '1': 'videasy', '2': 'vidlink', '3': 'vidnest' };
  return map[id] || undefined;
}

/**
 * Manage per-media explicit source in sessionStorage to avoid global overrides when the user clicks
 * a resume link for a specific item. Falls back to the global `jsc_explicit_source` for backward compatibility.
 */
export function setExplicitSourceForMedia(mediaId: number | string, source: string) {
  try {
    const key = `jsc_explicit_source_${mediaId}`;
    const atKey = `jsc_explicit_source_at_${mediaId}`;
    sessionStorage.setItem(key, source);
    sessionStorage.setItem(atKey, new Date().toISOString());
  } catch (e) {
    // ignore storage errors
  }
}

export function getExplicitSourceForMedia(mediaId: number | string, fallbackToGlobal: boolean = true): string | null {
  try {
    const key = `jsc_explicit_source_${mediaId}`;
    const val = sessionStorage.getItem(key);
    if (val) return val;
    // Backwards-compatibility: fall back to global key if requested
    if (fallbackToGlobal) return sessionStorage.getItem('jsc_explicit_source');
    return null;
  } catch (e) {
    return null;
  }
}