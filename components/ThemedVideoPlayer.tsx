'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { PlayCircle, PauseCircle, Volume2, VolumeX, Maximize } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth'; // Import the useAuth hook
import { trackFrameLoad, getCachedMetrics, prefetchVidkingResources, clearExpiredCache } from '@/lib/videoPerformance';

interface ThemedVideoPlayerProps {
  src: string; // The URL of the video file (e.g., .mp4, .webm)
  poster?: string; // Optional poster image
  autoplay?: boolean; // Whether the video should start playing automatically
  initialTime?: number; // Optional: Start playback from a specific time in seconds
  title?: string; // Optional: A descriptive title for accessibility
  mediaId: number; // Required for watch history
  mediaType: 'movie' | 'tv'; // Required for watch history
  posterPath?: string; // Optional: Poster path for watch history
  seasonNumber?: number; // Optional: Season number for TV shows
  episodeNumber?: number; // Optional: Episode number for TV shows
  onTimeUpdate?: (time: number) => void; // Optional: Callback when playback time updates
}

const ThemedVideoPlayer: React.FC<ThemedVideoPlayerProps> = ({
  src, // Renamed from videoSrc to src
  poster,
  autoplay = true,
  initialTime = 0,
  title = 'Video Player',
  mediaId,
  mediaType,
  posterPath = '',
  seasonNumber,
  episodeNumber,
  onTimeUpdate,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the video container
  const lastUpdateTimeRef = useRef<number>(0); // Ref for tracking last watch history update
  const embedLoadedRef = useRef<boolean>(false); // Track if embed has loaded
  const iframeRef = useRef<HTMLIFrameElement>(null); // Ref for the iframe
  const initialTimeSetRef = useRef<boolean>(false); // Track if we've initialized playtime tracking with initial time
  const lastTrackedTimeRef = useRef<number>(0); // Track last time we recorded for playtime
  const embedPlayerIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined); // Track embed player interval
  const latestEmbedDataRef = useRef<{ progress: number; currentTime: number; duration: number } | null>(null); // Store latest embed data
  const userHasInteractedRef = useRef<boolean>(false); // Track if user has manually seeked

  // Memoize src to prevent unnecessary iframe reloads
  const stableSrc = useMemo(() => src, [src]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true); // Controls visibility
  const [isHovering, setIsHovering] = useState(false); // Track mouse hover
  const [embedProgress, setEmbedProgress] = useState(0);
  const [embedCurrentTime, setEmbedCurrentTime] = useState(0);
  const [embedDuration, setEmbedDuration] = useState(0);
  const { user } = useAuth(); // Get current user for watch history
  const [iframeReady, setIframeReady] = useState(false); // Track if iframe is ready
  const iframePreloadRef = useRef<HTMLIFrameElement | null>(null); // For preloading iframe

  // Preload iframe in the background for faster loading
  useEffect(() => {
    if (!stableSrc.includes('vidking') && !stableSrc.includes('vidnest')) return;
    
    // Clear expired cache entries
    clearExpiredCache();
    
    // Prefetch vidking resources
    prefetchVidkingResources();
    
    // Check if we have cached metrics
    const cachedMetrics = getCachedMetrics(mediaId);
    const isCached = cachedMetrics !== null;
    
    const startTime = Date.now();
    
    // Create a hidden preload iframe to warm up the embed
    const preloadFrame = document.createElement('iframe');
    preloadFrame.src = stableSrc;
    preloadFrame.style.display = 'none';
    preloadFrame.style.width = '1px';
    preloadFrame.style.height = '1px';
    preloadFrame.allow = 'autoplay';
    
    const onLoadComplete = () => {
      const endTime = Date.now();
      trackFrameLoad(mediaId, startTime, endTime, isCached);
      console.log(`Preload frame loaded in ${endTime - startTime}ms (cached: ${isCached})`);
    };
    
    preloadFrame.onload = onLoadComplete;
    preloadFrame.onerror = onLoadComplete; // Track even if there's an error
    
    document.body.appendChild(preloadFrame);
    iframePreloadRef.current = preloadFrame;
    
    // Clean up the preload iframe after 5 seconds
    const timeoutId = setTimeout(() => {
      if (iframePreloadRef.current && iframePreloadRef.current.parentNode) {
        document.body.removeChild(iframePreloadRef.current);
      }
    }, 5000);
    
    return () => {
      clearTimeout(timeoutId);
      if (iframePreloadRef.current && iframePreloadRef.current.parentNode) {
        try {
          document.body.removeChild(iframePreloadRef.current);
        } catch (e) {
          // Already removed
        }
      }
    };
  }, [stableSrc, mediaId]);

  // Function to toggle play/pause
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        // Attempt to play and catch potential errors (e.g., browser autoplay policy)
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('Autoplay prevented or playback failed:', error);
            // You might want to show a custom play button here if autoplay fails
            setIsPlaying(false); // Ensure UI reflects paused state
          });
        }
      }
      // The onPlay and onPause event handlers will update the isPlaying state.
    }
  }, [isPlaying]);

  // Update current time
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      onTimeUpdate?.(videoRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  // Set duration when metadata loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVolume(videoRef.current.volume); // Initialize volume from video element
      setIsMuted(videoRef.current.muted); // Initialize mute state
    }
  }, []);

  // Seek video
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      userHasInteractedRef.current = true; // Mark that user has manually seeked
    }
  };

  // Adjust volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newVolume = parseFloat(e.target.value);
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      } else if (newVolume === 0 && !isMuted) {
        setIsMuted(true);
        videoRef.current.muted = true;
      }
    }
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      // If unmuting from 0 volume, set volume to a default (e.g., 0.5)
      if (isMuted && volume === 0) {
        videoRef.current.volume = 0.5;
        setVolume(0.5);
      }
    }
  };

  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle 'H' key press to toggle controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'H') {
        setShowControls((prev) => !prev);
      }
      // Spacebar to play/pause
      if (event.key === ' ' && videoRef.current && document.activeElement !== videoRef.current) {
        event.preventDefault(); // Prevent scrolling
        togglePlayPause();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayPause]);

  // Auto-hide controls when not hovering and playing
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying && !isHovering && showControls) {
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000); // Hide after 3 seconds of inactivity
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, isHovering, showControls]);

  // Reset player state when episode/movie changes (for embed players)
  useEffect(() => {
    if (src.includes('vidking') || src.includes('vidnest') || src.includes('embed')) {
      // Reset states for new content
      setIsLoading(true);
      embedLoadedRef.current = false;
      setEmbedProgress(0);
      setEmbedCurrentTime(0);
      setEmbedDuration(0);
      latestEmbedDataRef.current = null;
      lastUpdateTimeRef.current = 0;
      console.log('Reset player state for new content:', { mediaId, seasonNumber, episodeNumber });
    }
  }, [src, mediaId, seasonNumber, episodeNumber]);

  // Autoplay when the component mounts or src changes
  useEffect(() => {
    // Reset interaction tracking for new video
    userHasInteractedRef.current = false;

    // Skip all video logic for embed URLs
    if (src.includes('vidking') || src.includes('vidnest') || src.includes('embed')) {
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Only attempt autoplay if the autoplay prop is true
    if (autoplay) {
      // Ensure video is muted for reliable autoplay across browsers
      video.muted = true; // Explicitly mute the video element
      setIsMuted(true);

      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Autoplay started successfully
          setIsPlaying(true); // Update state immediately
        }).catch(error => {
          console.warn('Autoplay prevented:', error); // Log the error
          setIsPlaying(false); // Ensure state reflects that it's not playing
        });
      }
    }

    // Event listeners for internal state management
    const handleCanPlayThrough = () => setIsLoading(false); // Hide loading spinner once video can play
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const handlePlay = () => { // Explicitly handle play event to update state
      setIsPlaying(true);
      // If autoplay was successful and video was muted, unmute if volume > 0
      if (video.muted && volume > 0) {
        video.muted = false;
        setIsMuted(false);
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error('Video playback error:', video?.error, e);
      setIsLoading(false); // Hide loading on error
      // You might want to display an error message to the user
    };

    // Handle page visibility changes - when returning to tab, sync player state
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, don't do anything special - video continues in background
        return;
      }
      // Page is now visible
      // For embed players, immediately clear loading if it has loaded
      if (src.includes('vidking') || src.includes('vidnest') || src.includes('embed')) {
        if (embedLoadedRef.current) {
          setIsLoading(false);
        }
        return;
      }
      // For direct video players
      const video = videoRef.current;
      if (video && !video.paused) {
        setIsPlaying(true);
        setIsLoading(false);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('play', handlePlay); // Listen for actual play event
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up event listeners
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [src, autoplay, volume, handleLoadedMetadata, handleTimeUpdate]); // Added autoplay, initialTime, volume to dependencies

  // Separate effect to apply initial time when metadata is loaded (only once per video)
  // NOTE: Skip this for embed players - they handle progress via URL parameters
  useEffect(() => {
    // Skip for embed players - Vidking/VIDNEST handle progress via URL parameter
    if (src.includes('vidking') || src.includes('vidnest') || src.includes('embed')) {
      return;
    }

    const video = videoRef.current;
    if (!video || userHasInteractedRef.current) {
      return; // Don't apply if user has already interacted
    }

    // When initialTime changes, reset the flag to allow it to be set
    const applyInitialTime = () => {
      if (video.duration > 0 && initialTime > 0 && initialTime < video.duration) {
        video.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
    };

    if (video.duration > 0) {
      // Duration already available, apply immediately
      applyInitialTime();
    } else {
      // Wait for loadedmetadata event
      video.addEventListener('loadedmetadata', applyInitialTime, { once: true });
      return () => {
        video.removeEventListener('loadedmetadata', applyInitialTime);
      };
    }
  }, [initialTime, src]);

  const isEmbedPlayer = src.includes('vidking') || src.includes('vidnest') || src.includes('embed');

  const sendWatchHistoryUpdate = useCallback(async (
    currentProgress: number,
    currentPlayedTime: number,
    currentTotalDuration: number,
    currentMediaType: 'movie' | 'tv', // Add mediaType here
    totalPlayedSeconds: number = 0 // Add this parameter with default
  ) => {
    const now = Date.now();
    
    // Only send if at least 10 seconds have passed since last update to reduce API calls
    if (now - lastUpdateTimeRef.current < 10000) {
      console.log('Throttled - skipping update. Time since last:', now - lastUpdateTimeRef.current);
      return;
    }

    if (user && mediaId && currentMediaType) { // Use currentMediaType here
      try {
        lastUpdateTimeRef.current = now;
        console.log('Sending watch history update:', { 
          mediaId, 
          mediaType: currentMediaType, 
          progress: currentProgress, 
          currentPlayedTime, 
          currentTotalDuration,
          totalPlayedSeconds,
          seasonNumber,
          episodeNumber
        });
        
        const response = await fetch('/api/watch-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId,
            mediaType: currentMediaType, // Use currentMediaType
            title,
            posterPath,
            progress: currentProgress,
            currentTime: Math.floor(currentPlayedTime),
            totalDuration: Math.floor(currentTotalDuration),
            totalPlayedSeconds: Math.floor(totalPlayedSeconds),
            seasonNumber: seasonNumber || undefined,
            episodeNumber: episodeNumber || undefined,
            finished: false,
          }),
        });
        
        if (!response.ok) {
          console.error('Watch history API error:', response.status, response.statusText);
        } else {
          const data = await response.json();
          console.log('Watch history saved successfully:', data);
        }
      } catch (error) {
        console.error('Failed to update watch history:', error);
      }
    } else {
      console.log('Skipping watch history update - missing user/mediaId', { user: !!user, mediaId, currentMediaType });
    }
  }, [user, mediaId, title, posterPath, seasonNumber, episodeNumber]); // Dependencies for useCallback


  // Effect for handling embed players - send initial progress on load
  useEffect(() => {
    if (!isEmbedPlayer) return;

    // Get the current source to validate messages
    const currentSource = stableSrc.includes('vidnest') ? 'vidnest' : 'vidking';
    console.log(`[Watch History] Setting up message listener for source: ${currentSource}`);

    const handleMessage = (event: MessageEvent) => {
      // Only log if this looks like a player message
      if (typeof event.data === 'string' && event.data.includes('PLAYER_EVENT')) {
        console.log("Message received from embed player:", event.data);
      }
      
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'PLAYER_EVENT' && message.data) {
            const { event: playerEvent, id, mediaType: eventMediaType, progress, currentTime: eventCurrentTime, duration: eventDuration, season: embedSeason, episode: embedEpisode } = message.data;
            console.log("Extracted progress from embed player:", { playerEvent, id, eventMediaType, progress, eventCurrentTime, eventDuration, embedSeason, episodeNumber, source: currentSource });
            
            // Check if this message is for our media
            if (String(id) === String(mediaId) && eventMediaType === mediaType) {
              // For TV shows, use the season/episode from the embed player message if available
              const effectiveSeasonNumber = embedSeason ?? seasonNumber;
              const effectiveEpisodeNumber = embedEpisode ?? episodeNumber;
              setEmbedProgress(progress);
              setEmbedCurrentTime(eventCurrentTime);
              setEmbedDuration(eventDuration);
              
              // Store the latest data
              latestEmbedDataRef.current = {
                progress,
                currentTime: eventCurrentTime,
                duration: eventDuration
              };
              
              // Determine if this is an important event that needs immediate DB write
              // seeked, pause, ended events should be saved immediately to prevent data loss
              const isImportantEvent = ['seeked', 'pause', 'ended'].includes(playerEvent);
              
              // For embed players, send to database
              if (user && mediaId && eventMediaType) {
                console.log('Saving embed player progress to database with season:', effectiveSeasonNumber, 'episode:', effectiveEpisodeNumber, 'immediate:', isImportantEvent);
                fetch('/api/watch-history', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    mediaId,
                    mediaType: eventMediaType,
                    title,
                    posterPath,
                    progress: progress,
                    currentTime: Math.floor(eventCurrentTime),
                    totalDuration: Math.floor(eventDuration),
                    totalPlayedSeconds: 0,
                    seasonNumber: effectiveSeasonNumber,
                    episodeNumber: effectiveEpisodeNumber,
                    finished: playerEvent === 'ended',
                    immediate: isImportantEvent, // Write immediately for important events
                  }),
                }).then(response => {
                  if (!response.ok) {
                    console.error('Watch history API error:', response.status);
                  } else {
                    console.log('Embed player progress saved to database', isImportantEvent ? '(immediate)' : '(batched)');
                  }
                }).catch(error => {
                  console.error('Failed to save embed player progress:', error);
                });
              }
            }
          }
        } catch (e) {
          console.error("Error parsing message from embed player:", e);
        }
      }
    };

    // Function to save current progress immediately (for page unload/visibility change)
    const saveProgressImmediately = () => {
      const latestData = latestEmbedDataRef.current;
      if (latestData && user && mediaId && mediaType) {
        console.log('Saving progress immediately before leaving page:', latestData);
        // Use sendBeacon for reliable delivery during page unload
        const payload = JSON.stringify({
          mediaId,
          mediaType,
          title,
          posterPath,
          progress: latestData.progress,
          currentTime: Math.floor(latestData.currentTime),
          totalDuration: Math.floor(latestData.duration),
          totalPlayedSeconds: 0,
          seasonNumber: seasonNumber || undefined,
          episodeNumber: episodeNumber || undefined,
          finished: false,
          immediate: true,
        });
        
        // Try sendBeacon first (more reliable for page unload)
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/watch-history', new Blob([payload], { type: 'application/json' }));
        } else {
          // Fallback to sync fetch
          fetch('/api/watch-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          });
        }
      }
    };

    // Handle visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveProgressImmediately();
      }
    };

    // Handle page unload
    const handleBeforeUnload = () => {
      saveProgressImmediately();
    };

    if (isEmbedPlayer) {
      window.addEventListener("message", handleMessage);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("beforeunload", handleBeforeUnload);
      console.log("Added message listener for embed player");
    }

    return () => {
      if (isEmbedPlayer) {
        window.removeEventListener("message", handleMessage);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        // Save progress when component unmounts (navigation)
        saveProgressImmediately();
      }
      if (embedPlayerIntervalRef.current) {
        clearInterval(embedPlayerIntervalRef.current);
      }
    };
  }, [isEmbedPlayer, user, mediaId, mediaType, title, posterPath, seasonNumber, episodeNumber, stableSrc]);

  // Fallback polling mechanism for embed players that don't support postMessage
  // DISABLED FOR VIDKING - Only for VIDNEST to avoid timestamp glitching
  useEffect(() => {
    if (!isEmbedPlayer || !iframeRef.current) return;
    
    const currentSource = stableSrc.includes('vidnest') ? 'vidnest' : 'vidking';
    
    // DISABLED: Skip fallback polling for VidKing due to timestamp glitching
    if (currentSource === 'vidking') {
      console.log('[Fallback Polling] DISABLED for VidKing - preventing timestamp glitches');
      return;
    }
    
    console.log(`[Fallback Polling] Starting for source: ${currentSource}`);
    
    // For vidnest and other embeds that may not send messages, use a periodic save
    const fallbackInterval = setInterval(() => {
      if (!user || !mediaId) return;
      
      // Store the latest embed data and send it to DB periodically
      if (latestEmbedDataRef.current) {
        const { progress, currentTime, duration } = latestEmbedDataRef.current;
        console.log(`[Fallback Polling] Sending periodic update for ${currentSource}:`, { progress, currentTime, duration });
        
        fetch('/api/watch-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId,
            mediaType,
            title,
            posterPath,
            progress: progress,
            currentTime: Math.floor(currentTime),
            totalDuration: Math.floor(duration),
            totalPlayedSeconds: 0,
            seasonNumber,
            episodeNumber,
            finished: false,
            immediate: false, // Use batch for periodic updates
          }),
        }).then(response => {
          if (!response.ok) {
            console.error(`[Fallback Polling] API error for ${currentSource}:`, response.status);
          } else {
            console.log(`[Fallback Polling] Progress saved for ${currentSource}`, { progress, currentTime, duration });
          }
        }).catch(error => {
          console.error(`[Fallback Polling] Error saving progress for ${currentSource}:`, error);
        });
      }
    }, 30000); // Poll every 30 seconds for sources that don't send messages
    
    return () => {
      clearInterval(fallbackInterval);
    };
  }, [isEmbedPlayer, user, mediaId, mediaType, title, posterPath, seasonNumber, episodeNumber, stableSrc]);


  // Watch history tracking for direct video - uses internal player states
  useEffect(() => {
    if (isEmbedPlayer) return; // This useEffect is only for direct players

    let intervalId: NodeJS.Timeout | undefined;
    let totalPlayedSeconds = 0;

    if (isPlaying && user) {
      intervalId = setInterval(() => {
        const calculatedProgress = (duration > 0 ? (currentTime / duration) * 100 : 0);
        
        // Track actual playtime - only count seconds that were actually played
        // If this is the first time, set the reference point
        if (!initialTimeSetRef.current && initialTime > 0) {
          initialTimeSetRef.current = true;
          lastTrackedTimeRef.current = currentTime;
        } else if (initialTimeSetRef.current) {
          // Calculate the delta and only add if it makes sense (within 1 second of real time)
          const timeDelta = currentTime - lastTrackedTimeRef.current;
          if (timeDelta > 0 && timeDelta < 5) { // 5 second threshold to avoid big jumps
            totalPlayedSeconds += timeDelta;
          }
          lastTrackedTimeRef.current = currentTime;
        } else {
          // No initial time was set, just track regularly
          if (currentTime > 0) {
            totalPlayedSeconds += 10; // Increment by 10 seconds (the interval duration)
          }
        }
        
        console.log("Direct player update:", { isPlaying, currentTime, duration, calculatedProgress, totalPlayedSeconds });
        sendWatchHistoryUpdate(
          calculatedProgress,
          currentTime,
          duration,
          mediaType, // Pass mediaType
          totalPlayedSeconds
        );
      }, 10000); // Check and send update every 10 seconds
    } else if (intervalId) {
      clearInterval(intervalId);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Send a final update for direct player on cleanup
      if (!isEmbedPlayer && user && mediaId) {
        sendWatchHistoryUpdate(
          (duration > 0 ? (currentTime / duration) * 100 : 0),
          currentTime,
          duration,
          mediaType // Pass mediaType
        );
      }
    };
  }, [isEmbedPlayer, isPlaying, user, mediaId, mediaType, currentTime, duration, sendWatchHistoryUpdate]);


  // Manage controls visibility when paused
  useEffect(() => {
    if (!isPlaying) {
      // If autoplay was intended and failed (video is paused),
      // we want a clean screen initially. Controls will show on hover.
      // If autoplay was false, or user manually paused, show controls.
      if (!autoplay || isHovering) { // If autoplay is false, or if user is hovering, show controls
        setShowControls(true);
      } else { // If autoplay is true and it's paused (failed), and not hovering, keep controls hidden
        setShowControls(false);
      }
    }
  }, [isPlaying, autoplay, isHovering]); // Added autoplay and isHovering to dependencies

  return (
    <div // Added aspect-video to ensure 16:9 ratio
      ref={containerRef}
      className="relative w-full h-[600px] bg-black group"
      onMouseEnter={() => { setIsHovering(true); setShowControls(true); }}
      onMouseLeave={() => setIsHovering(false)}
    >
      {src.includes('vidking') || src.includes('vidnest') || src.includes('embed') ? (
        // For embed URLs, use an iframe with vidking/vidnest controls
        // Key includes full src URL to force remount when source/progress changes
        <iframe
          key={src}
          ref={iframeRef}
          src={stableSrc}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media"
          title={title}
          loading="eager"
          scrolling="no"
          style={{ overflow: 'hidden', border: 'none' }}
          onLoad={() => {
            console.log('Iframe loaded, initializing player');
            const cachedMetrics = getCachedMetrics(mediaId);
            if (!cachedMetrics) {
              // Track main frame load if not already cached
              trackFrameLoad(mediaId, Date.now(), Date.now(), false);
            }
            setIsLoading(false);
            embedLoadedRef.current = true;
            setIframeReady(true);
            console.log('Iframe ready - embedLoadedRef set to true');
            
            // Attempt to inject script to seek the vidking player  
            // Some embedded players allow window.postMessage or direct methods
            if (initialTime > 0 && iframeRef.current) {
              console.log('Attempting to seek embed player to:', initialTime, 'seconds');
              // Try multiple times with increasing delays as the player initializes
              [2000, 3000, 4000].forEach((delay, index) => {
                setTimeout(() => {
                  if (!iframeRef.current?.contentWindow) return;
                  
                  try {
                    // Try standard postMessage seek
                    iframeRef.current.contentWindow.postMessage({
                      type: 'SEEK',
                      time: initialTime,
                    }, '*');
                    
                    // Also try alternative message format
                    iframeRef.current.contentWindow.postMessage({
                      action: 'seek',
                      seconds: initialTime,
                    }, '*');
                    
                    // Try HTML5 seeking if player exposes it
                    const contentWindow = iframeRef.current.contentWindow as any;
                    if (contentWindow?.player) {
                      if (typeof contentWindow.player.seek === 'function') {
                        contentWindow.player.seek(initialTime);
                      }
                      if (typeof contentWindow.player.currentTime === 'number') {
                        contentWindow.player.currentTime = initialTime;
                      }
                    }
                    
                    console.log(`Seek attempt ${index + 1} sent to iframe at ${delay}ms`);
                  } catch (e) {
                    console.warn(`Seek attempt ${index + 1} failed:`, e);
                  }
                }, delay);
              });
            }
            
            // Send initial watch history entry when embed loads
            if (user && mediaId && mediaType) {
              console.log('Sending initial watch history entry for embed player');
              fetch('/api/watch-history', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  mediaId,
                  mediaType,
                  title,
                  posterPath,
                  progress: 0,
                  currentTime: 0,
                  totalDuration: 0,
                  totalPlayedSeconds: 0,
                  seasonNumber: seasonNumber || undefined,
                  episodeNumber: episodeNumber || undefined,
                  finished: false,
                }),
              }).then(response => {
                if (!response.ok) {
                  console.error('Initial watch history entry failed:', response.status);
                } else {
                  console.log('Initial watch history entry created');
                }
              }).catch(error => {
                console.error('Failed to create initial watch history entry:', error);
              });
            }
          }}
          onError={() => {
            setIsLoading(false);
          }}
        />
      ) : (
        // For direct video files, use the video element
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          onClick={togglePlayPause}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full h-full object-contain"
          muted
          title={title}
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      )}

    </div>
  );
};

export default ThemedVideoPlayer;