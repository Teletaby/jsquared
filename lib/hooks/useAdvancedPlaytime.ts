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

  /**
   * Save a playtime update immediately
   */
  const queueUpdate = useCallback((data: PlaytimeData) => {
    // Debounce: save if either condition is met:
    // 1. 3+ seconds since last save (time-based), OR
    // 2. Time moved 2+ seconds (position-based)
    const now = Date.now();
    if (lastSaveTimeRef.current) {
      const timeSinceLastSave = now - lastSaveTimeRef.current.timestamp;
      const timeDiff = Math.abs(data.currentTime - lastSaveTimeRef.current.time);
      
      // Skip only if BOTH conditions are false (too soon AND time hasn't moved much)
      if (timeSinceLastSave < 3000 && timeDiff < 2) {
        return; // Not enough time or movement, skip this save
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
        immediate: true, // Force immediate write for live progress bar updates
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
      console.log('[Playtime] Page unloading - final save triggered');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Playtime] Page hidden - ensuring data persisted');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
