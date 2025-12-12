'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { PlayCircle, PauseCircle, Volume2, VolumeX, Maximize } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth'; // Import the useAuth hook

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
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      onTimeUpdate?.(videoRef.current.currentTime);
    }
  };

  // Set duration when metadata loads
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVolume(videoRef.current.volume); // Initialize volume from video element
      setIsMuted(videoRef.current.muted); // Initialize mute state

      // Apply initialTime if provided and valid
      if (initialTime > 0 && initialTime < videoRef.current.duration) {
        videoRef.current.currentTime = initialTime;
      }
    }
  };

  // Seek video
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
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

  // Autoplay when the component mounts or src changes
  useEffect(() => {
    // Skip all video logic for embed URLs
    if (src.includes('vidking') || src.includes('embed')) {
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
      if (src.includes('vidking') || src.includes('embed')) {
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [src, autoplay, initialTime, volume]); // Added autoplay, initialTime, volume to dependencies

  const isEmbedPlayer = src.includes('vidking') || src.includes('embed');

  const sendWatchHistoryUpdate = useCallback(async (
    currentProgress: number,
    currentPlayedTime: number,
    currentTotalDuration: number,
    currentMediaType: 'movie' | 'tv' // Add mediaType here
  ) => {
    const now = Date.now();
    
    // Only send if at least 30 seconds have passed since last update to reduce API calls
    if (now - lastUpdateTimeRef.current < 30000) {
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
            seasonNumber: seasonNumber || undefined,
            episodeNumber: episodeNumber || undefined,
            finished: false,
          }),
        });
        
        if (!response.ok) {
          console.error('Watch history API error:', response.status, response.statusText);
        } else {
          console.log('Watch history saved successfully');
        }
      } catch (error) {
        console.error('Failed to update watch history:', error);
      }
    }
  }, [user, mediaId, title, posterPath, seasonNumber, episodeNumber]); // Dependencies for useCallback


  // Effect for handling messages from embed players
  useEffect(() => {
          const handleMessage = (event: MessageEvent) => {
            console.log("Message received from embed player:", event); // Log the raw event
            if (typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data);
                console.log("Parsed message from embed player:", message); // Log the parsed message
                if (message.type === 'PLAYER_EVENT' && message.data) {
                  const { event: playerEvent, id, mediaType: eventMediaType, progress, currentTime: eventCurrentTime, duration: eventDuration } = message.data;
                  console.log("Extracted progress from embed player:", { playerEvent, id, eventMediaType, progress, eventCurrentTime, eventDuration });
                  console.log("Matching condition for embed player:", { currentMediaId: mediaId, eventId: id, currentMediaType: mediaType, eventMediaType: eventMediaType, match: String(id) === String(mediaId) && eventMediaType === mediaType });
                  if (String(id) === String(mediaId) && eventMediaType === mediaType) {
                    setEmbedProgress(progress);
                    setEmbedCurrentTime(eventCurrentTime);
                    setEmbedDuration(eventDuration);

                    if (playerEvent === 'timeupdate' || playerEvent === 'seeked' || playerEvent === 'play') {
                      sendWatchHistoryUpdate(progress, eventCurrentTime, eventDuration, eventMediaType);
                    }
                  }
                }
              } catch (e) {
                console.error("Error parsing message from embed player:", e);
              }
            }
          };

    if (isEmbedPlayer) {
      window.addEventListener("message", handleMessage);
    }

    return () => {
      if (isEmbedPlayer) {
        window.removeEventListener("message", handleMessage);
      }
    };
  }, [isEmbedPlayer, mediaId, mediaType, sendWatchHistoryUpdate]);


  // Watch history tracking for direct video - uses internal player states
  useEffect(() => {
    if (isEmbedPlayer) return; // This useEffect is only for direct players

    let intervalId: NodeJS.Timeout | undefined;

    if (isPlaying && user) {
      intervalId = setInterval(() => {
        const calculatedProgress = (duration > 0 ? (currentTime / duration) * 100 : 0);
        console.log("Direct player update:", { isPlaying, currentTime, duration, calculatedProgress });
        sendWatchHistoryUpdate(
          calculatedProgress,
          currentTime,
          duration,
          mediaType // Pass mediaType
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
      {src.includes('vidking') || src.includes('embed') ? (
        // For embed URLs, use an iframe with vidking controls
        <iframe
          key={`iframe-${mediaId}-${mediaType}`}
          ref={iframeRef}
          src={stableSrc}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay"
          title={title}
          onLoad={() => {
            setIsLoading(false);
            embedLoadedRef.current = true;
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
        >
          Your browser does not support the video tag.
        </video>
      )}

    </div>
  );
};

export default ThemedVideoPlayer;