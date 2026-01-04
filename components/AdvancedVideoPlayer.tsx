'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/hooks/useAuth';
import { sourceNameToId } from '@/lib/utils';

interface AdvancedVideoPlayerProps {
  embedUrl: string; // VIDNEST, VIDSRC embed URL
  title?: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  posterPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
  videoSource?: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc'; // Which video source to display counter for
}

const AdvancedVideoPlayer: React.FC<AdvancedVideoPlayerProps> = ({
  embedUrl,
  title = 'Video Player',
  mediaId,
  mediaType,
  posterPath = '',
  seasonNumber,
  episodeNumber,
  initialTime = 0,
  onTimeUpdate,
  videoSource = 'videasy',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Track elapsed time with real-time updates
  const elapsedRef = useRef<number>(0); // Track ONLY new time watched in THIS session (starts at 0, not initialTime)
  const sessionStartRef = useRef<number>(Date.now()); // Track when the player started
  const initialStartRef = useRef<number>(initialTime); // Capture the initial resume timestamp on mount

  useEffect(() => {
    // Reset elapsed time and session start when initialTime changes (new video/episode)
    elapsedRef.current = 0;
    sessionStartRef.current = Date.now();
    initialStartRef.current = initialTime;
  }, [initialTime]);

  useEffect(() => {
    // Update every 1 second for real-time accuracy
    const interval = setInterval(() => {
      // Call onTimeUpdate for all sources (including embed sources like vidnest/vidsrc)
      // to ensure currentPlaybackTime is tracked for accurate cross-source switching
      if (onTimeUpdate) {
        const totalTime = initialTime + elapsedRef.current;
        onTimeUpdate(totalTime);
      }
      // Increment by 1 second for real-time tracking
      elapsedRef.current += 1;
    }, 1000); // Fires every 1 second for real-time updates

    // Capture time immediately before page unload
    const handleBeforeUnload = () => {
      if (elapsedRef.current > 0 && onTimeUpdate) {
        const totalTime = initialTime + elapsedRef.current;
        console.log('[AdvancedVideoPlayer] Unload event - saving final time:', totalTime, 's');
        onTimeUpdate(totalTime);
      }
    };

    // Also save when user switches tabs - but keep player alive (don't reload)
    const handleVisibilityChange = () => {
      if (document.hidden && elapsedRef.current > 0 && onTimeUpdate) {
        const totalTime = initialTime + elapsedRef.current;
        console.log('[AdvancedVideoPlayer] Tab hidden - saving time:', totalTime, 's (player stays alive)');
        onTimeUpdate(totalTime);
        // Note: We do NOT unmount or reload the player here - it stays alive in the background
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTimeUpdate, videoSource, initialTime]);

  // Resume hint removed for VIDNEST — player auto-resumes from the saved timestamp

  const durationRef = useRef<number>(0);

  // Auto-save refs
  const lastSaveTimeRef = useRef(0);
  const embedLoadedRef = useRef(false);

  // Save playtime to database
  const savePlaytime = useCallback(async (time: number) => {
    if (!user || !embedUrl) return;

    try {
      const masked = sourceNameToId(videoSource);
      console.log('[AdvancedVideoPlayer] Saving playtime', { mediaId, mediaType, time, source: masked ? `Source ${masked}` : 'unknown' });
      const response = await fetch('/api/watch-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          mediaType,
          currentTime: time,
          progress: durationRef.current > 0 ? (time / durationRef.current) * 100 : 0,
          totalDuration: durationRef.current,
          posterPath,
          seasonNumber,
          episodeNumber,
          source: videoSource, // ensure source is recorded for embed saves
          immediate: true, // persist immediately for accuracy
        }),
      });

      if (!response.ok) {
        console.error('Failed to save playtime');
      }
    } catch (error) {
      console.error('Error saving playtime:', error);
    }
  }, [user, embedUrl, mediaId, mediaType, posterPath, seasonNumber, episodeNumber]);

  // Auto-save every 10 seconds (only for embed sources: videasy, vidlink)
  useEffect(() => {
    if (!user || (videoSource !== 'videasy' && videoSource !== 'vidlink')) return;

    const interval = setInterval(() => {
      if (elapsedRef.current > 0 && (elapsedRef.current - lastSaveTimeRef.current) > 10) {
        const totalTime = initialTime + elapsedRef.current;
        savePlaytime(totalTime);
        lastSaveTimeRef.current = elapsedRef.current;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [savePlaytime, user, videoSource, initialTime]);

  // Save on page unload (only for embed sources: videasy, vidlink)
  useEffect(() => {
    if (videoSource !== 'videasy' && videoSource !== 'vidlink') return;

    const handleBeforeUnload = async () => {
      if (elapsedRef.current > 0) {
        const totalTime = initialTime + elapsedRef.current;
        await savePlaytime(totalTime);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [savePlaytime, videoSource, initialTime]);



  // Load iframe and listen for messages (VIDNEST can post progress events)
  useEffect(() => {
    const handleLoad = () => {
      embedLoadedRef.current = true;

      // DISABLED: VidKing auto-resume disabled to prevent timestamp glitching
      if (initialTime > 0 && embedUrl.includes('vidking')) {
        console.log('Source 3: Auto-resume DISABLED - preventing timestamp glitches');
      }
    };

    const handleMessage = (evt: MessageEvent) => {
      // Only consider messages that look like VIDNEST progress events
      try {
        const data = evt.data;
        if (!data) return;

        // VIDNEST may send different message shapes; handle common ones defensively
        const progress = typeof data.currentTime === 'number' ? data.currentTime : (typeof data.progress === 'number' ? data.progress : undefined);
        const type = (typeof data.type === 'string' ? data.type.toLowerCase() : undefined);

        if ((type === 'vidnest:progress' || type === 'progress' || type === 'timeupdate') && typeof progress === 'number') {
          // Throttle saves: only save if delta > 5s since last save
          const delta = Math.abs(progress - (initialStartRef.current + elapsedRef.current));
          if (delta > 5) {
            console.log('[AdvancedVideoPlayer] Source 3 postMessage progress received', { mediaId, progress });
            // Update local elapsedRef so future autosave math makes sense
            // Note: Do not mutate initialStartRef here (it's mount-only), instead compute a best-effort totalTime
            const totalTime = progress;
            // Save immediately for embed players
            savePlaytime(totalTime);
            // Also update elapsedRef roughly so unload/save handlers have a good baseline
            elapsedRef.current = Math.max(elapsedRef.current, Math.floor(totalTime - initialStartRef.current));
          }
        }
      } catch (e) {
        // ignore malformed postMessage data
      }
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleLoad);
      window.addEventListener('message', handleMessage);

      return () => {
        iframe.removeEventListener('load', handleLoad);
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [initialTime, embedUrl, mediaId, savePlaytime]);

  // Memoize embed URL - append VIDNEST resume params (mount-only) so iframe auto-resumes
  const stableEmbedUrl = useMemo(() => {
    if (!embedUrl) return embedUrl;

    // Only append params for VIDNEST (source 3) and only use the initial start time captured on mount
    // VidSrc (source 4) doesn't support resume parameters
    if (embedUrl.includes('vidnest') && initialStartRef.current > 0) {
      const separator = embedUrl.includes('?') ? '&' : '?';
      // For movies use startAt, for TV use progress (per VIDNEST docs)
      const param = mediaType === 'movie' ? `startAt=${Math.floor(initialStartRef.current)}` : `progress=${Math.floor(initialStartRef.current)}`;
      const urlWithParam = `${embedUrl}${separator}${param}`;
      console.log('[AdvancedVideoPlayer] Using Source 3 resume URL:', urlWithParam);
      return urlWithParam;
    }
    return embedUrl;
  }, [embedUrl, mediaType]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black`}
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Resume badge removed — VIDNEST auto-resumes at the saved timestamp */}
      
      {/* Embed Player - Full size with native controls */}
      <iframe
        ref={iframeRef}
        src={stableEmbedUrl}
        className="w-full h-full rounded-lg"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        frameBorder="0"
        title={title}
        scrolling="no"
        style={{ display: 'block', overflow: 'hidden' }}
      />
    </div>
  );
};

export default AdvancedVideoPlayer;
