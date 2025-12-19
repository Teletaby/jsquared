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
    console.log(`🎬 [VidLinkPlayer] Mounted with initialTime: ${initialStartRef.current}s, mediaId: ${mediaId}`);
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
    console.log(`🎬 [VidLinkPlayer] Iframe loaded. Initial time: ${initialStartRef.current}s`);
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
          console.log(`📍 [VidLinkPlayer] MEDIA_DATA received:`, mediaData);

          // Extract progress from media data
          if (mediaData.progress && mediaData.progress.watched !== undefined) {
            const currentTime = mediaData.progress.watched;
            messageReceivedRef.current = true;
            lastSavedTimeRef.current = currentTime;
            lastTimeRef.current = currentTime;

            if (onTimeUpdate && currentTime !== undefined) {
              console.log(`📍 [VidLinkPlayer] Progress: ${Math.floor(currentTime)}s / ${mediaData.progress.duration}s`);
              onTimeUpdate(currentTime);
            }
          }
        }

        // Handle PLAYER_EVENT - Real-time player events
        if (data?.type === 'PLAYER_EVENT') {
          const eventData = data.data;
          console.log(`📍 [VidLinkPlayer] PLAYER_EVENT: ${eventData.event}`, eventData);

          // Track timeupdate events
          if (eventData.event === 'timeupdate' && eventData.currentTime !== undefined) {
            messageReceivedRef.current = true;
            lastSavedTimeRef.current = eventData.currentTime;
            lastTimeRef.current = eventData.currentTime;

            if (onTimeUpdate) {
              // Debounce updates - only call every 5 seconds
              if (Math.abs(eventData.currentTime - lastTimeRef.current) >= 5 || eventData.event === 'ended') {
                console.log(`📍 [VidLinkPlayer] timeupdate: ${Math.floor(eventData.currentTime)}s`);
                onTimeUpdate(eventData.currentTime);
              }
            }
          }

          // Handle pause/ended events - save immediately
          if ((eventData.event === 'pause' || eventData.event === 'ended') && eventData.currentTime !== undefined) {
            lastSavedTimeRef.current = eventData.currentTime;
            if (onTimeUpdate) {
              console.log(`📍 [VidLinkPlayer] ${eventData.event} at ${Math.floor(eventData.currentTime)}s`);
              onTimeUpdate(eventData.currentTime);
            }
          }
        }
      } catch {
        // Silently ignore non-JSON or non-player messages
      }
    };

    console.log('🔌 [VidLinkPlayer] Setting up message listener for VidLink');
    window.addEventListener('message', handleMessage);

    // Save progress before leaving (page unload, not tab switch)
    const handleBeforeUnload = () => {
      console.log('⏹️ [VidLinkPlayer] Page unloading, saving final progress:', lastSavedTimeRef.current);
      if (lastSavedTimeRef.current > 0 && onTimeUpdate) {
        onTimeUpdate(lastSavedTimeRef.current);
      }
    };

    // Save when user switches tabs - but keep player alive (don't reload)
    const handleVisibilityChange = () => {
      if (document.hidden && lastSavedTimeRef.current > 0 && onTimeUpdate) {
        console.log('👁️ [VidLinkPlayer] Page hidden, saving progress:', lastSavedTimeRef.current);
        onTimeUpdate(lastSavedTimeRef.current);
        // Note: We do NOT unmount or reload the player here - it stays alive in the background
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('🔌 [VidLinkPlayer] Cleaning up listeners');
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTimeUpdate]);

  // Fallback: If VidLink doesn't send postMessage events, use a periodic heartbeat
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;
    const startTime = Date.now();
    const initialPlaybackTime = initialStartRef.current || 0;

    // Wait 5 seconds to see if we get any messages from VidLink
    const waitTimer = setTimeout(() => {
      if (!messageReceivedRef.current) {
        console.warn('⚠️ [VidLinkPlayer] No postMessage from VidLink detected - using heartbeat fallback');

        // Start heartbeat - assume constant playback and send updates
        heartbeatInterval = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const currentTime = initialPlaybackTime + elapsedSeconds;

          if (onTimeUpdate) {
            console.log(`📊 [VidLinkPlayer] Heartbeat: ${currentTime}s`);
            onTimeUpdate(currentTime);
            lastSavedTimeRef.current = currentTime;
          }
        }, 10000); // Send heartbeat every 10 seconds
      } else {
        console.log('✅ [VidLinkPlayer] postMessage working - heartbeat not needed');
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
