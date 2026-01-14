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
  videoSource?: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock'; // Which video source to display counter for
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

  // Track elapsed time with real wall-clock time
  const sessionStartRef = useRef<number>(Date.now()); // Track when the player started (wall-clock time)
  const initialStartRef = useRef<number>(initialTime); // Capture the initial resume timestamp on mount

  useEffect(() => {
    // Reset session start when initialTime changes (new video/episode)
    sessionStartRef.current = Date.now();
    initialStartRef.current = initialTime;
    sourceExplicitlySentRef.current = false; // Reset explicit flag for new content
  }, [initialTime, embedUrl]);

  useEffect(() => {
    // Update every 1 second for real-time accuracy using actual elapsed wall-clock time
    const interval = setInterval(() => {
      // Call onTimeUpdate for all sources (including embed sources like vidnest/vidsrc)
      // to ensure currentPlaybackTime is tracked for accurate cross-source switching
      if (onTimeUpdate) {
        // Calculate actual elapsed time from when player started (in milliseconds, convert to seconds)
        const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        const totalTime = initialTime + elapsedSeconds;
        onTimeUpdate(totalTime);
      }
    }, 1000); // Fires every 1 second for real-time updates

    // Capture time immediately before page unload
    const handleBeforeUnload = () => {
      if (onTimeUpdate) {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        const totalTime = initialTime + elapsedSeconds;
        console.log('[AdvancedVideoPlayer] Unload event - saving final time:', totalTime, 's');
        onTimeUpdate(totalTime);
      }
    };

    // Also save when user switches tabs - but keep player alive (don't reload)
    const handleVisibilityChange = () => {
      if (document.hidden && onTimeUpdate) {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        const totalTime = initialTime + elapsedSeconds;
        if (elapsedSeconds > 0) {
          console.log('[AdvancedVideoPlayer] Tab hidden - saving time:', totalTime, 's (player stays alive)');
          onTimeUpdate(totalTime);
        }
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

  // Resume hint removed for VIDNEST and VIDROCK — players auto-resume from the saved timestamp

  const durationRef = useRef<number>(0);
  const embedLoadedRef = useRef(false);
  const sourceExplicitlySentRef = useRef<boolean>(false); // Track if we've sent the source as explicit for this session

  // Save playtime to database
  const savePlaytime = useCallback(async (time: number) => {
    if (!user || !embedUrl) return;

    try {
      const masked = sourceNameToId(videoSource);
      
      // Mark the first meaningful playback update as explicit to persist source preference
      const isFirstUpdate = !sourceExplicitlySentRef.current && time > initialTime;
      if (isFirstUpdate) {
        sourceExplicitlySentRef.current = true;
        console.log('[AdvancedVideoPlayer] Marking first update as explicit to persist source:', masked ? `Source ${masked}` : 'unknown');
      }
      
      console.log('[AdvancedVideoPlayer] Saving playtime', { mediaId, mediaType, time, source: masked ? `Source ${masked}` : 'unknown', explicit: isFirstUpdate });
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
          explicit: isFirstUpdate, // Mark first update as explicit to persist source preference
        }),
      });

      if (!response.ok) {
        console.error('Failed to save playtime');
      }
    } catch (error) {
      console.error('Error saving playtime:', error);
    }
  }, [user, embedUrl, mediaId, mediaType, posterPath, seasonNumber, episodeNumber, videoSource, initialTime]);

  // Auto-save frequently (every 3 seconds for vidrock, every 10 seconds for others)
  useEffect(() => {
    if (!user || (videoSource !== 'videasy' && videoSource !== 'vidlink' && videoSource !== 'vidrock')) return;

    let lastSaveTime = 0;
    // VidRock needs more frequent saves for accuracy
    const saveInterval = videoSource === 'vidrock' ? 3000 : 10000;
    const minDelta = videoSource === 'vidrock' ? 3 : 10;
    
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (elapsedSeconds > 0 && (elapsedSeconds - lastSaveTime) > minDelta) {
        const totalTime = initialTime + elapsedSeconds;
        console.log(`[AdvancedVideoPlayer] Auto-save triggered for Source ${videoSource === 'vidrock' ? '5' : '1/2'}:`, totalTime, 's');
        savePlaytime(totalTime);
        lastSaveTime = elapsedSeconds;
      }
    }, saveInterval);

    return () => clearInterval(interval);
  }, [savePlaytime, user, videoSource, initialTime]);

  // Save on page unload (for embed sources: videasy, vidlink, vidrock)
  useEffect(() => {
    if (videoSource !== 'videasy' && videoSource !== 'vidlink' && videoSource !== 'vidrock') return;

    const handleBeforeUnload = async () => {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (elapsedSeconds > 0) {
        const totalTime = initialTime + elapsedSeconds;
        const sourceLabel = videoSource === 'vidrock' ? 'Source 5' : `Source ${videoSource === 'vidlink' ? '2' : '1'}`;
        console.log(`[AdvancedVideoPlayer] Unload event - saving final time for ${sourceLabel}:`, totalTime, 's');
        await savePlaytime(totalTime);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        if (elapsedSeconds > 0) {
          const totalTime = initialTime + elapsedSeconds;
          const sourceLabel = videoSource === 'vidrock' ? 'Source 5' : `Source ${videoSource === 'vidlink' ? '2' : '1'}`;
          console.log(`[AdvancedVideoPlayer] Tab hidden - saving time for ${sourceLabel}:`, totalTime, 's');
          // Save immediately without awaiting to ensure it goes through
          savePlaytime(totalTime);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [savePlaytime, videoSource, initialTime]);



  // Load iframe and listen for messages (VIDNEST and VIDROCK send progress events via postMessage)
  useEffect(() => {
    const handleLoad = () => {
      embedLoadedRef.current = true;
      console.log('[AdvancedVideoPlayer] Iframe loaded, ready for postMessage events');
    };

    const handleMessage = (evt: MessageEvent) => {
      // Handle progress events from VIDNEST and VIDROCK
      try {
        const data = evt.data;
        if (!data) return;

        // VidRock sends: { type: 'PLAYER_EVENT', data: { event: 'timeupdate', currentTime: X, duration: Y } }
        if (data.type === 'PLAYER_EVENT' && data.data?.event) {
          const { event: eventType, currentTime, duration } = data.data;
          
          // Only process timeupdate events for progress tracking
          if (eventType === 'timeupdate' && typeof currentTime === 'number') {
            if (duration && typeof duration === 'number') {
              durationRef.current = duration;
            }
            
            // Use VidRock's reported currentTime as source of truth
            const totalTime = currentTime;
            
            // Resync the session start to match the player's reported progress
            sessionStartRef.current = Date.now() - (totalTime - initialStartRef.current) * 1000;
            
            console.log('[AdvancedVideoPlayer] Source 5 (VidRock) postMessage timeupdate:', { mediaId, currentTime, duration });
            // Immediately save to ensure accuracy
            savePlaytime(totalTime);
          }
        }
        // Fallback for VIDNEST events (if they send different structure)
        else if ((data.type === 'vidnest:progress' || data.type === 'progress') && typeof data.progress === 'number') {
          const progress = data.progress;
          const totalTime = progress;
          
          sessionStartRef.current = Date.now() - (totalTime - initialStartRef.current) * 1000;
          
          console.log('[AdvancedVideoPlayer] Source 3 (VIDNEST) postMessage progress:', { mediaId, progress });
          savePlaytime(totalTime);
        }
      } catch (e) {
        console.warn('[AdvancedVideoPlayer] Error processing postMessage:', e);
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

  // Memoize embed URL - append VIDNEST/VIDROCK resume params (mount-only) so iframe auto-resumes
  const stableEmbedUrl = useMemo(() => {
    if (!embedUrl) return embedUrl;

    // Append params for VIDNEST (source 3) and VIDROCK (source 5) using the initial start time captured on mount
    // VidSrc (source 4) doesn't support resume parameters
    if ((embedUrl.includes('vidnest') || embedUrl.includes('vidrock')) && initialStartRef.current > 0) {
      const separator = embedUrl.includes('?') ? '&' : '?';
      // For movies use startAt, for TV use progress (per VIDNEST/VIDROCK docs)
      const param = mediaType === 'movie' ? `startAt=${Math.floor(initialStartRef.current)}` : `progress=${Math.floor(initialStartRef.current)}`;
      const urlWithParam = `${embedUrl}${separator}${param}`;
      const sourceLabel = embedUrl.includes('vidnest') ? 'Source 3' : 'Source 5';
      console.log(`[AdvancedVideoPlayer] Using ${sourceLabel} resume URL:`, urlWithParam);
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
      {/* Resume badge removed — VIDNEST and VIDROCK auto-resume at the saved timestamp */}
      
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
