import { useState, useCallback, useRef, useEffect } from 'react';

interface PlaytimeData {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  currentTime: number;
  totalDuration: number;
  progress: number;
  posterPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  quality?: string;
  playbackRate?: number;
}

/**
 * Advanced playtime tracking hook
 * - Saves updates immediately when called
 * - Also saves on page exit for reliability
 */
export function useAdvancedPlaytime() {
  const isSavingRef = useRef(false);
  const lastSaveTimeRef = useRef<{ time: number; timestamp: number } | null>(null);
  const lastPlaytimeDataRef = useRef<PlaytimeData | null>(null);

  /**
   * Synchronous save for use during page unload
   */
  const saveSynchronously = useCallback((data: PlaytimeData) => {
    try {
      const formData = new URLSearchParams();
      formData.append('mediaId', String(data.mediaId));
      formData.append('mediaType', data.mediaType);
      formData.append('title', data.title || '');
      formData.append('currentTime', String(data.currentTime));
      formData.append('totalDuration', String(data.totalDuration));
      formData.append('progress', String(data.progress));
      formData.append('posterPath', data.posterPath || '');
      formData.append('immediate', 'true');
      if (data.seasonNumber !== undefined) formData.append('seasonNumber', String(data.seasonNumber));
      if (data.episodeNumber !== undefined) formData.append('episodeNumber', String(data.episodeNumber));

      // Use sendBeacon for reliable delivery on page unload
      navigator.sendBeacon('/api/watch-history', formData);
      console.log('[Playtime] 🔔 Beacon sent with final progress:', Math.floor(data.currentTime), 's');
    } catch (error) {
      console.error('[Playtime] Beacon send error:', error);
    }
  }, []);

  /**
   * Save a playtime update immediately
   */
  const queueUpdate = useCallback((data: PlaytimeData) => {
    // Always store the latest data for emergency saves
    lastPlaytimeDataRef.current = data;

    // Minimal debounce: only save if time has actually moved
    // This ensures we capture accurate resume positions
    const now = Date.now();
    if (lastSaveTimeRef.current) {
      const timeDiff = Math.abs(data.currentTime - lastSaveTimeRef.current.time);
      
      // Skip ONLY if position hasn't changed at all (within 0.5 seconds tolerance)
      if (timeDiff < 0.5) {
        return; // Exact same position, skip duplicate save
      }
    }
    
    // Avoid duplicate simultaneous requests
    if (isSavingRef.current) return;
    
    isSavingRef.current = true;
    lastSaveTimeRef.current = { time: data.currentTime, timestamp: now };

    fetch('/api/watch-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        immediate: true, // Force immediate write for accurate progress tracking
      }),
    })
      .then((res) => {
        if (!res.ok) {
          console.error('[Playtime] Save failed with status:', res.status);
        } else {
          console.log('[Playtime] ✅ Saved:', Math.floor(data.currentTime), 's, progress:', data.progress.toFixed(1) + '%');
        }
      })
      .catch((error) => {
        console.error('[Playtime] Save error:', error);
      })
      .finally(() => {
        isSavingRef.current = false;
      });
  }, []);

  /**
   * Ensure final save on page exit
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Send final progress via beacon (most reliable on page unload)
      if (lastPlaytimeDataRef.current) {
        console.log('[Playtime] Page unloading - sending final save via beacon');
        saveSynchronously(lastPlaytimeDataRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && lastPlaytimeDataRef.current) {
        console.log('[Playtime] Page hidden - ensuring data persisted via beacon');
        saveSynchronously(lastPlaytimeDataRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveSynchronously]);

  return {
    queueUpdate,
  };
}

/**
 * Hook to track video watching completion
 */
export function useWatchCompletion() {
  const [isWatched, setIsWatched] = useState(false);

  const checkCompletion = useCallback(
    (currentTime: number, duration: number, threshold = 0.9) => {
      const watchedPercentage = currentTime / duration;
      if (watchedPercentage >= threshold && !isWatched) {
        setIsWatched(true);
        return true;
      }
      return false;
    },
    [isWatched]
  );

  return { isWatched, checkCompletion, reset: () => setIsWatched(false) };
}
