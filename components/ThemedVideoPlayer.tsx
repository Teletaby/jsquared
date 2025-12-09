'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PlayCircle, PauseCircle, Volume2, VolumeX, Maximize } from 'lucide-react';

interface ThemedVideoPlayerProps {
  src: string; // The URL of the video file (e.g., .mp4, .webm)
  poster?: string; // Optional poster image
  autoplay?: boolean; // Whether the video should start playing automatically
  initialTime?: number; // Optional: Start playback from a specific time in seconds
  title?: string; // Optional: A descriptive title for accessibility
}

const ThemedVideoPlayer: React.FC<ThemedVideoPlayerProps> = ({
  src, // Renamed from videoSrc to src
  poster,
  autoplay = true,
  initialTime = 0,
  title = 'Video Player',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the video container

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true); // Controls visibility
  const [isHovering, setIsHovering] = useState(false); // Track mouse hover
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

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('play', handlePlay); // Listen for actual play event
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    // Clean up event listeners
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [src, autoplay, initialTime, volume]); // Added autoplay, initialTime, volume to dependencies

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
      className="relative w-full aspect-video bg-black group"
      onMouseEnter={() => { setIsHovering(true); setShowControls(true); }}
      onMouseLeave={() => setIsHovering(false)}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-lg z-10">
          <p>Loading video...</p>
          {/* You can add a spinner here if you have one */}
        </div>
      )}
      <video
        ref={videoRef}
        src={src} // Changed from videoSrc
        poster={poster}
        onClick={togglePlayPause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)} // Keep these for immediate state updates
        onPause={() => setIsPlaying(false)} // Keep these for immediate state updates
        className="w-full h-full object-contain" // Use object-contain to avoid cropping
        muted // Start muted for reliable autoplay
        title={title} // Pass the title prop
        // No 'controls' attribute here, as we're building custom controls
      >
        Your browser does not support the video tag.
      </video>

      {/* Custom Controls Overlay */}
      {/* Only show controls if explicitly requested, or if paused and not loading */}
      {(showControls || (!isPlaying && !isLoading)) && (
        <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300">
          {/* Top overlay for potential title/info */}
          <div className="flex justify-end">
            {/* Could add title here */}
          </div>


          {/* Center Play/Pause Button */}
          <div className="flex-grow flex items-center justify-center">
            <button
              onClick={togglePlayPause}
              className="text-white text-opacity-75 hover:text-opacity-100 transition-opacity duration-200"
            >
              {/* Show large play button if playing (PauseCircle), or if paused and not loading,
                  and only if hovering when paused */}
              {isPlaying ? <PauseCircle size={80} /> : (!isLoading && isHovering ? <PlayCircle size={80} /> : null)}
            </button>
          </div>

          {/* Bottom Controls Bar */}
          <div className="flex items-center gap-4 bg-ui-elements/80 p-2 rounded-lg">
            <button onClick={togglePlayPause} className="text-accent hover:text-white">
              {isPlaying ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
            </button>

            <div className="text-white text-sm">{formatTime(currentTime)}</div>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleProgressChange}
              className="flex-grow h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-accent"
              style={{
                background: `linear-gradient(to right, var(--color-accent) ${((currentTime / duration) * 100) || 0}%, #4b5563 ${((currentTime / duration) * 100) || 0}%)`
              }}
            />
            <div className="text-white text-sm">{formatTime(duration)}</div>

            <button onClick={handleToggleMute} className="text-accent hover:text-white">
              {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-accent"
              style={{
                background: `linear-gradient(to right, var(--color-accent) ${((isMuted ? 0 : volume) * 100)}%, #4b5563 ${((isMuted ? 0 : volume) * 100)}%)`
              }}
            />

            <button onClick={handleToggleFullscreen} className="text-accent hover:text-white">
              <Maximize size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemedVideoPlayer;