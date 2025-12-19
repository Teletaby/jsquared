'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Loader } from 'lucide-react';

interface VideasyPlayerProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
  posterPath?: string;
}

const VideasyPlayer: React.FC<VideasyPlayerProps> = ({
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

  // Log when component mounts with the initial start time (mount-only)
  useEffect(() => {
    console.log(`🎬 [VideasyPlayer] Mounted with initialTime: ${initialStartRef.current}s, mediaId: ${mediaId}`);
  }, [mediaId]);

  // Capture the initial start time once on mount to avoid remounting the iframe if the parent updates saved progress
  const initialStartRef = useRef<number>(initialTime);

  // Construct VIDEASY embed URL
  const embedUrl = useMemo(() => {
    const colorParam = 'E50914'; // Match your red theme
    
    if (mediaType === 'movie') {
      // For movies: https://player.videasy.net/movie/movie_id
      let url = `https://player.videasy.net/movie/${mediaId}?color=${colorParam}&overlay=true&autoplay=true`;
      
      // Add progress parameter if user has saved progress (only the initial value)
      if (initialStartRef.current > 0) {
        url += `&progress=${Math.floor(initialStartRef.current)}`;
      }
      
      return url;
    } else {
      // For TV shows: https://player.videasy.net/tv/show_id/season/episode
      if (!seasonNumber || !episodeNumber) {
        return null;
      }
      
      let url = `https://player.videasy.net/tv/${mediaId}/${seasonNumber}/${episodeNumber}?color=${colorParam}&overlay=true&autoplay=true`;
      
      // Add progress parameter if user has saved progress (only the initial value)
      if (initialStartRef.current > 0) {
        url += `&progress=${Math.floor(initialStartRef.current)}`;
      }
      
      return url;
    }
  }, [mediaId, mediaType, seasonNumber, episodeNumber]);

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    console.log(`🎬 [VideasyPlayer] Iframe loaded. Initial time: ${initialStartRef.current}s`);
    
    // Try to send autoplay/play message to VIDEASY iframe after it loads
    if (iframeRef.current) {
      setTimeout(() => {
        try {
          if (iframeRef.current?.contentWindow) {
            // Send play message to VIDEASY
            const playMessage = {
              type: 'PLAY',
            };
            iframeRef.current.contentWindow.postMessage(JSON.stringify(playMessage), 'https://player.videasy.net');
            console.log(`▶️ [VideasyPlayer] Sent PLAY message to VIDEASY`);
          }
        } catch (error) {
          console.log('[VideasyPlayer] Could not send play message:', error);
        }
      }, 500); // Wait 500ms for iframe to be fully ready
    }
    
    // Try to send seek message to VIDEASY iframe after it loads
    if (initialStartRef.current > 0 && iframeRef.current) {
      setTimeout(() => {
        try {
          if (iframeRef.current?.contentWindow) {
            // Send seek message to VIDEASY
            const seekMessage = {
              type: 'SEEK',
              data: {
                time: initialStartRef.current,
              }
            };
            iframeRef.current.contentWindow.postMessage(JSON.stringify(seekMessage), 'https://player.videasy.net');
            console.log(`📍 [VideasyPlayer] Sent SEEK message to VIDEASY: ${initialStartRef.current}s`);
          }
        } catch (error) {
          console.log('[VideasyPlayer] Could not send seek message:', error);
        }
      }, 1000); // Wait 1 second for iframe to be fully ready
    }
  }, []);

  // Listen for real-time progress messages from VIDEASY player
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        let data;
        
        // Handle both string and object formats
        if (typeof event.data === 'string') {
          data = JSON.parse(event.data);
        } else if (typeof event.data === 'object' && event.data !== null) {
          data = event.data;
        } else {
          return;
        }

        // Check if this is a PLAYER_EVENT from VIDEASY
        if (data.type === 'PLAYER_EVENT' && data.data && data.data.event === 'timeupdate') {
          const playerData = data.data;
          const currentTime = playerData.currentTime;
          
          if (currentTime !== undefined && onTimeUpdate) {
            messageReceivedRef.current = true;
            lastSavedTimeRef.current = currentTime;
            console.log(`📍 [VideasyPlayer] Message received - ${Math.floor(currentTime)}s / ${playerData.duration}s`);
            // Call callback on every message - let the hook handle debouncing
            onTimeUpdate(currentTime);
          }
        }
      } catch {
        // Silently ignore non-JSON or non-player messages
      }
    };

    console.log('🔌 [VideasyPlayer] Setting up message listener');
    window.addEventListener('message', handleMessage);
    
    // Save progress before leaving (page unload, not tab switch)
    const handleBeforeUnload = () => {
      console.log('⏹️ [VideasyPlayer] Page unloading, saving final progress:', lastSavedTimeRef.current);
      if (lastSavedTimeRef.current > 0 && onTimeUpdate) {
        onTimeUpdate(lastSavedTimeRef.current);
      }
    };

    // Save when user switches tabs - but keep player alive (don't reload)
    const handleVisibilityChange = () => {
      if (document.hidden && lastSavedTimeRef.current > 0 && onTimeUpdate) {
        console.log('👁️ [VideasyPlayer] Page hidden, saving progress:', lastSavedTimeRef.current);
        onTimeUpdate(lastSavedTimeRef.current);
        // Note: We do NOT unmount or reload the player here - it stays alive in the background
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('🔌 [VideasyPlayer] Cleaning up listeners');
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTimeUpdate]);

  // Fallback: If VIDEASY doesn't send postMessage events, use a periodic heartbeat
  // to ensure progress is being saved even if the player doesn't support postMessage
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout | null = null;
    const startTime = Date.now();
    const initialPlaybackTime = initialTime || 0;

    // Wait 5 seconds to see if we get any messages from VIDEASY
    const waitTimer = setTimeout(() => {
      if (!messageReceivedRef.current) {
        console.warn('⚠️ [VideasyPlayer] No postMessage from VIDEASY detected - using heartbeat fallback');
        
        // Start heartbeat - assume constant playback and send updates
        heartbeatInterval = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const currentTime = initialPlaybackTime + elapsedSeconds;
          
          if (onTimeUpdate) {
            console.log(`📊 [VideasyPlayer] Heartbeat: ${currentTime}s`);
            onTimeUpdate(currentTime);
            lastSavedTimeRef.current = currentTime;
          }
        }, 10000); // Send heartbeat every 10 seconds
      } else {
        console.log('✅ [VideasyPlayer] postMessage working - heartbeat not needed');
      }
    }, 5000);

    return () => {
      clearTimeout(waitTimer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [initialTime, onTimeUpdate]);

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
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-[#E50914] animate-spin" />
            <p className="text-white text-sm">Loading player...</p>
          </div>
        </div>
      )}

      {/* VIDEASY Embed */}
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

export default VideasyPlayer;
