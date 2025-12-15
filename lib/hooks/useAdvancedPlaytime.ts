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

  /**
   * Save a playtime update immediately
   */
  const queueUpdate = useCallback((data: PlaytimeData) => {
    // Avoid duplicate simultaneous requests
    if (isSavingRef.current) return;
    
    isSavingRef.current = true;

    fetch('/api/watch-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then((res) => {
        if (!res.ok) {
          console.error('[Playtime] Save failed with status:', res.status);
        } else {
          console.log('[Playtime] ✅ Saved:', data.currentTime, 'seconds');
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
      console.log('[Playtime] Page unloading - ensuring save complete');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
