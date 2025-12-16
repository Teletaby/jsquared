'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  SkipBack,
  SkipForward,
  Loader,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

interface AdvancedVideoPlayerProps {
  embedUrl: string; // VidKing or VidSrc embed URL
  title?: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  posterPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
  videoSource?: 'vidking' | 'vidsrc'; // Which video source to display counter for
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
  videoSource = 'vidking',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Player states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [showResumeHint, setShowResumeHint] = useState(true); // Auto-hide resume hint after 8 seconds

  // Track playtime by periodic saves (since we can't access iframe's currentTime due to CORS)
  const elapsedRef = useRef(0); // Track ONLY new time watched in THIS session (starts at 0, not initialTime)

  useEffect(() => {
    // Reset elapsed time to 0 when initialTime changes (new video/episode)
    elapsedRef.current = 0;
  }, [initialTime]);

  useEffect(() => {
    // Update every 10 seconds for better granularity - this interval must keep running
    const interval = setInterval(() => {
      elapsedRef.current += 10; // Increment by 10 seconds every interval
      
      // Only call onTimeUpdate if it exists AND we're using vidking source
      // VidSrc (source 2) does not support progress tracking
      if (onTimeUpdate && videoSource === 'vidking') {
        const totalTime = initialTime + elapsedRef.current;
        onTimeUpdate(totalTime);
      }
    }, 10000); // Fires every 10 seconds

    // Capture time immediately before page unload
    const handleBeforeUnload = () => {
      if (elapsedRef.current > 0 && onTimeUpdate && videoSource === 'vidking') {
        const totalTime = initialTime + elapsedRef.current;
        onTimeUpdate(totalTime);
      }
    };

    // Also save when user switches tabs
    const handleVisibilityChange = () => {
      if (document.hidden && elapsedRef.current > 0 && onTimeUpdate && videoSource === 'vidking') {
        const totalTime = initialTime + elapsedRef.current;
        onTimeUpdate(totalTime);
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

  // Auto-hide resume hint after 8 seconds
  useEffect(() => {
    // Reset hint visibility whenever initialTime changes
    if (initialTime > 0) {
      setShowResumeHint(true);
      const timer = setTimeout(() => {
        setShowResumeHint(false);
      }, 8000); // Show for 8 seconds
      return () => clearTimeout(timer);
    }
  }, [initialTime]);

  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('auto');
  const [mouseIdleTimer, setMouseIdleTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-save refs
  const lastSaveTimeRef = useRef(0);
  const embedLoadedRef = useRef(false);
  const embedPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Format time helper
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Save playtime to database
  const savePlaytime = useCallback(async (time: number) => {
    if (!user || !embedUrl) return;

    try {
      const response = await fetch('/api/watch-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          mediaType,
          currentTime: time,
          progress: duration > 0 ? (time / duration) * 100 : 0,
          totalDuration: duration,
          posterPath,
          seasonNumber,
          episodeNumber,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save playtime');
      }
    } catch (error) {
      console.error('Error saving playtime:', error);
    }
  }, [user, embedUrl, mediaId, mediaType, duration, posterPath, seasonNumber, episodeNumber]);

  // Auto-save every 10 seconds (only for VidKing source)
  useEffect(() => {
    if (!user || videoSource !== 'vidking') return;

    const interval = setInterval(() => {
      if (currentTime > 0 && currentTime - lastSaveTimeRef.current > 10) {
        savePlaytime(currentTime);
        lastSaveTimeRef.current = currentTime;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentTime, savePlaytime, user, videoSource]);

  // Save on page unload (only for VidKing source)
  useEffect(() => {
    if (videoSource !== 'vidking') return;

    const handleBeforeUnload = async () => {
      if (currentTime > 0) {
        await savePlaytime(currentTime);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentTime, savePlaytime, videoSource]);

  // Handle fullscreen
  const handleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [isFullscreen]);

  // Auto-hide controls after 3 seconds of inactivity
  const handleMouseMove = useCallback(() => {
    setShowControls(true);

    if (mouseIdleTimer) {
      clearTimeout(mouseIdleTimer);
    }

    const timer = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);

    setMouseIdleTimer(timer);
  }, [mouseIdleTimer, isPlaying]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (mouseIdleTimer) {
        clearTimeout(mouseIdleTimer);
      }
    };
  }, [mouseIdleTimer]);

  // Load iframe
  useEffect(() => {
    const handleLoad = () => {
      setIsLoading(false);
      embedLoadedRef.current = true;

      // DISABLED: VidKing auto-resume disabled to prevent timestamp glitching
      if (initialTime > 0 && embedUrl.includes('vidking')) {
        console.log('VidKing: Auto-resume DISABLED - preventing timestamp glitches');
      }
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', () => setIsLoading(false));

      return () => {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', () => setIsLoading(false));
      };
    }
  }, [initialTime, embedUrl]);

  // Memoize embed URL - VidSrc doesn't support time parameters
  // User will need to manually seek to timestamp using player controls
  const stableEmbedUrl = useMemo(() => embedUrl, [embedUrl]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black`}
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Resume indicator badge with instructions - DISABLED FOR VIDKING to prevent glitches */}
      {videoSource === 'vidsrc' && initialTime > 0 && showResumeHint && (
        <div className="absolute bottom-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow-lg flex items-center gap-2 animate-pulse">
          <span>⏱️ Last watched at {Math.floor(initialTime)}s</span>
          <span className="text-xs opacity-90">- Drag progress bar to resume</span>
        </div>
      )}
      
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
