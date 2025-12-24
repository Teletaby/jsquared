'use client';

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';

interface VidLinkPlayerProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
  posterPath?: string;
}

const VidLinkPlayer: React.FC<VidLinkPlayerProps> = ({
  mediaId,
  mediaType,
  title = 'Video Player',
  seasonNumber,
  episodeNumber,
  initialTime = 0,
  onTimeUpdate,
  posterPath,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Player states
  const [isLoading, setIsLoading] = useState(true);
  const lastSavedTimeRef = useRef(0);
  const messageReceivedRef = useRef(false);
  const lastTimeRef = useRef(0);

  // Log when component mounts with the initial start time (mount-only)
  useEffect(() => {
    console.log(`🎬 [Player 2] Mounted with initialTime: ${initialStartRef.current}s, mediaId: ${mediaId}`);
  }, [mediaId]);

  // Capture the initial start time once on mount to avoid remounting the iframe if the parent updates saved progress
  const initialStartRef = useRef<number>(initialTime);

  // Construct VIDLINK embed URL with color theming and progress support
  const embedUrl = useMemo(() => {
    // Match your red theme from the branding: E50914
    const primaryColor = 'E50914';
    const secondaryColor = 'a2a2a2';
    const iconColor = 'eefdec';

    if (mediaType === 'movie') {
      // For movies: https://vidlink.pro/movie/{tmdbId}
      let url = `https://vidlink.pro/movie/${mediaId}?primaryColor=${primaryColor}&secondaryColor=${secondaryColor}&iconColor=${iconColor}&icons=default&player=default&title=true&poster=true&autoplay=true&muted=false`;

      // Use the initial start time captured on mount (do not react to subsequent prop changes)
      if (initialStartRef.current > 0) {
        url += `&startAt=${Math.floor(initialStartRef.current)}`;
      }

      return url;
    } else {
      // For TV shows: https://vidlink.pro/tv/{tmdbId}/{season}/{episode}
      if (!seasonNumber || !episodeNumber) {
        return null;
      }

      let url = `https://vidlink.pro/tv/${mediaId}/${seasonNumber}/${episodeNumber}?primaryColor=${primaryColor}&secondaryColor=${secondaryColor}&iconColor=${iconColor}&icons=default&player=default&title=true&poster=true&autoplay=true&muted=false`;

      // Use the initial start time captured on mount (do not react to subsequent prop changes)
      if (initialStartRef.current > 0) {
        url += `&startAt=${Math.floor(initialStartRef.current)}`;
      }

      return url;
    }
  }, [mediaId, mediaType, seasonNumber, episodeNumber]);

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    console.log(`🎬 [Player 2] Iframe loaded. Initial time: ${initialStartRef.current}s`);
  }, []);

  // Listen for progress messages from VidLink player and localStorage updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from VidLink
      if (event.origin !== 'https://vidlink.pro') return;

      try {
        const data = event.data;

        // Handle MEDIA_DATA - Watch progress from VidLink
        if (data?.type === 'MEDIA_DATA') {
          const mediaData = data.data;
          console.log(`📍 [Player 2] MEDIA_DATA received:`, mediaData);

          // Extract progress from media data
          if (mediaData.progress && mediaData.progress.watched !== undefined) {
            const currentTime = mediaData.progress.watched;
            messageReceivedRef.current = true;
            lastSavedTimeRef.current = currentTime;
            lastTimeRef.current = currentTime;

            if (onTimeUpdate && currentTime !== undefined) {
              console.log(`📍 [Player 2] Progress: ${Math.floor(currentTime)}s / ${mediaData.progress.duration}s`);
              onTimeUpdate(currentTime);
            }
          }
        }

        // Handle PLAYER_EVENT - Real-time player events
        if (data?.type === 'PLAYER_EVENT') {
          const eventData = data.data;
          console.log(`📍 [Player 2] PLAYER_EVENT: ${eventData.event}`, eventData);

          // Track timeupdate events
          if (eventData.event === 'timeupdate' && eventData.currentTime !== undefined) {
            messageReceivedRef.current = true;
            lastSavedTimeRef.current = eventData.currentTime;
            lastTimeRef.current = eventData.currentTime;

            if (onTimeUpdate) {
              // Debounce updates - only call every 5 seconds
              if (Math.abs(eventData.currentTime - lastTimeRef.current) >= 5 || eventData.event === 'ended') {
                console.log(`📍 [Player 2] timeupdate: ${Math.floor(eventData.currentTime)}s`);
                onTimeUpdate(eventData.currentTime);
              }
            }
          }

          // Handle pause/ended events - save immediately
          if ((eventData.event === 'pause' || eventData.event === 'ended') && eventData.currentTime !== undefined) {
            lastSavedTimeRef.current = eventData.currentTime;
            if (onTimeUpdate) {
              console.log(`📍 [Player 2] ${eventData.event} at ${Math.floor(eventData.currentTime)}s`);
              onTimeUpdate(eventData.currentTime);
            }
          }
        }
      } catch {
        // Silently ignore non-JSON or non-player messages
      }
    };

    console.log('🔌 [Player 2] Setting up message listener for Source 2');
    window.addEventListener('message', handleMessage);

    // Save progress before leaving (page unload, not tab switch)
    const handleBeforeUnload = () => {
      console.log('⏹️ [Player 2] Page unloading, saving final progress:', lastSavedTimeRef.current);
      if (lastSavedTimeRef.current > 0 && onTimeUpdate) {
        onTimeUpdate(lastSavedTimeRef.current);
      }
    };

    // Save when user switches tabs - but keep player alive (don't reload)
    const handleVisibilityChange = () => {
      if (document.hidden && lastSavedTimeRef.current > 0 && onTimeUpdate) {
        console.log('👁️ [Player 2] Page hidden, saving progress:', lastSavedTimeRef.current);
        onTimeUpdate(lastSavedTimeRef.current);
        // Note: We do NOT unmount or reload the player here - it stays alive in the background
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('🔌 [Player 2] Cleaning up listeners');
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTimeUpdate]);
    // React to changes in initialTime prop (e.g., resume link supplied time after player mounted)
    useEffect(() => {
      if (!iframeRef.current) return;
      const t = Math.floor(initialTime || 0);
      if (!(t > 0 && Math.abs(t - lastSavedTimeRef.current) > 1)) return;

      const performSeek = async () => {
        // If page is hidden, wait until visible to avoid reloading/playing in background
        if (document.visibilityState !== 'visible') {
          console.log('[Player 2] Page hidden - deferring seek until visible');
          const handleVis = () => {
            if (document.visibilityState === 'visible') {
              document.removeEventListener('visibilitychange', handleVis);
              performSeek();
            }
          };
          document.addEventListener('visibilitychange', handleVis);
          return;
        }

        try {
          // Try to postMessage a SEEK command first (non-reloading, best-effort)
          if (iframeRef.current?.contentWindow) {
            const seekMsg = { type: 'SEEK', data: { time: t } };
            iframeRef.current.contentWindow.postMessage(seekMsg, 'https://vidlink.pro');
            console.log(`[Player 2] Attempted postMessage SEEK to Source 2: ${t}s`);
            lastSavedTimeRef.current = t;
            if (onTimeUpdate) onTimeUpdate(t);
            return;
          }
        } catch (e) {
          console.warn('[Player 2] SEEK via postMessage failed', e);
        }

        // Fallback: only update iframe src if postMessage is unavailable/fails
        try {
          const el = iframeRef.current;
          if (!el) throw new Error('iframe missing');
          const url = new URL(el.src);
          url.searchParams.set('startAt', String(t));
          el.src = url.toString();
          console.log(`[Player 2] iframe src updated to include startAt=${t}`);
          lastSavedTimeRef.current = t;
          if (onTimeUpdate) onTimeUpdate(t);
        } catch (e) {
          console.warn('[Player 2] failed to update iframe src for startAt', e);
        }
      };

      performSeek();
    }, [initialTime, onTimeUpdate]);
  // Fallback: If VidLink doesn't send postMessage events, use a periodic heartbeat
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;
    const startTime = Date.now();
    const initialPlaybackTime = initialStartRef.current || 0;

    // Wait 5 seconds to see if we get any messages from VidLink
    const waitTimer = setTimeout(() => {
      if (!messageReceivedRef.current) {
        console.warn('⚠️ [Player 2] No postMessage from Source 2 detected - using heartbeat fallback');

        // Start heartbeat - assume constant playback and send updates
        heartbeatInterval = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const currentTime = initialPlaybackTime + elapsedSeconds;

          if (onTimeUpdate) {
            console.log(`📊 [Player 2] Heartbeat: ${currentTime}s`);
            onTimeUpdate(currentTime);
            lastSavedTimeRef.current = currentTime;
          }
        }, 10000); // Send heartbeat every 10 seconds
      } else {
        console.log('✅ [Player 2] postMessage working - heartbeat not needed');
      }
    }, 5000);

    return () => {
      clearTimeout(waitTimer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [onTimeUpdate]);

  if (!embedUrl) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center rounded-lg">
        <div className="text-center">
          <h2 className="text-2xl text-gray-400 font-bold mb-4">Invalid Content</h2>
          <p className="text-gray-500">Please provide valid media information</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black"
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* VidLink Embed */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full rounded-lg"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        frameBorder="0"
        title={title}
        scrolling="no"
        style={{ display: 'block', overflow: 'hidden' }}
        onLoad={handleLoad}
      />
    </div>
  );
};

export default VidLinkPlayer;
