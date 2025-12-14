'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import io from 'socket.io-client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Copy, Check, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import Header from '@/components/Header';

interface VideoState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
}

const ReceiverContent = () => {
  const [roomId, setRoomId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const remoteConnectedRef = useRef(false);
  const [videoState, setVideoState] = useState<VideoState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 1,
  });
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const roomIdRef = useRef<string>('');
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Generate room ID and socket connection
  useEffect(() => {
    // Check if socket already exists (prevent reconnecting on refresh)
    if (socketRef.current?.connected) {
      console.log('Socket already connected, skipping initialization');
      return;
    }

    console.log('ReceiverContent mounted, setting up room...');
    
    // Generate or retrieve room ID
    let newRoomId = roomId;
    if (!newRoomId) {
      newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(newRoomId);
      console.log('Generated room ID:', newRoomId);
    } else {
      console.log('Using existing room ID:', newRoomId);
    }
    
    // Store in ref for use in other functions
    roomIdRef.current = newRoomId;

    // Generate QR Code with link to remote
    const remoteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/remote?roomId=${newRoomId}`;
    QRCode.toDataURL(remoteUrl, (err, url) => {
      if (err) {
        console.error('QR Code generation error:', err);
        return;
      }
      setQrCodeUrl(url);
    });

    // Initialize Socket.IO connection
    const socket = io();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Receiver connected to server, socket ID:', socket.id);
      setIsConnected(true);
      console.log('Receiver emitting join-room with ID:', newRoomId);
      socket.emit('join-room', newRoomId);
    });

    // Listen for room status updates
    socket.on('room-status', (status) => {
      console.log('=== ROOM STATUS UPDATE ===');
      console.log('Status:', status);
      console.log('ClientCount:', status.clientCount);
      const hasRemote = status.clientCount > 1;
      console.log('Setting remoteConnected to:', hasRemote);
      setRemoteConnected(hasRemote);
      remoteConnectedRef.current = hasRemote;
    });

    // Periodically check room status
    const statusCheckInterval = setInterval(() => {
      console.log('Periodic check: requesting room status for', newRoomId);
      socket.emit('check-room-status', newRoomId);
    }, 500);

    // Listen for remote control commands
    socket.on('remote-control', (data) => {
      console.log('Receiver got remote-control event:', data);
      const action = data.action;
      console.log('Extracted action:', action);
      if (action) {
        setRemoteConnected(true);
        handleRemoteCommand(action);
      } else {
        console.error('No action in remote-control data');
      }
    });

    socket.on('disconnect', () => {
      console.log('Receiver disconnected from server');
      clearInterval(statusCheckInterval);
      setIsConnected(false);
      setRemoteConnected(false);
    });

    // Also listen for user-left events
    socket.on('user-left', () => {
      console.log('User left event received');
      remoteConnectedRef.current = false;
      setRemoteConnected(false);
    });

    // Don't disconnect on unmount - only when user explicitly clicks disconnect
    return () => {
      // Empty cleanup - socket will persist
      clearInterval(statusCheckInterval);
      console.log('ReceiverContent component unmounted but socket persists');
    };
  }, []);

  const handleRemoteCommand = (action: any) => {
    console.log('handleRemoteCommand called with:', action);
    
    // Handle load-video separately since video element might not exist yet
    if (action.type === 'load-video') {
      console.log('Loading video:', action.payload);
      loadVideo(action.payload);
      return;
    }
    
    // For other commands, video element must exist
    if (!videoRef.current) {
      console.warn('videoRef not available - video might not be loaded yet');
      return;
    }

    switch (action.type) {
      case 'play':
        console.log('Playing video');
        videoRef.current.play();
        setVideoState((prev) => ({ ...prev, isPlaying: true }));
        break;
      case 'pause':
        console.log('Pausing video');
        videoRef.current.pause();
        setVideoState((prev) => ({ ...prev, isPlaying: false }));
        break;
      case 'seek':
        console.log('Seeking to:', action.payload);
        videoRef.current.currentTime = action.payload;
        break;
      case 'volume':
        console.log('Setting volume to:', action.payload);
        videoRef.current.volume = action.payload;
        setVideoState((prev) => ({ ...prev, volume: action.payload }));
        break;
      case 'rewind':
        console.log('Rewinding 10 seconds');
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - action.payload);
        break;
      case 'forward':
        console.log('Forwarding 10 seconds');
        videoRef.current.currentTime = videoRef.current.currentTime + action.payload;
        break;
      default:
        console.warn('Unknown action:', action.type);
    }
  };

  const loadVideo = async (videoData: any) => {
    try {
      console.log('=== loadVideo called ===');
      console.log('Loading video:', videoData);
      
      let videoSource = '';
      
      try {
        if (videoData.type === 'movie') {
          console.log('Fetching movie:', videoData.id);
          const response = await fetch(`/api/video/movie/${videoData.id}`);
          const data = await response.json();
          console.log('Movie API response:', data);
          // Use actual video URL if available, otherwise use trailer
          videoSource = data.videoUrl || data.trailerUrl || '';
        } else if (videoData.type === 'tv') {
          console.log('Fetching TV show:', videoData.id);
          const response = await fetch(`/api/video/tv/${videoData.id}`);
          const data = await response.json();
          console.log('TV API response:', data);
          // Use actual video URL if available, otherwise use trailer
          videoSource = data.videoUrl || data.trailerUrl || '';
        }
      } catch (apiError) {
        console.error('Error calling video API:', apiError);
        videoSource = '';
      }

      // If no source from API, show a message
      if (!videoSource) {
        console.warn('No video source available from API');
        videoSource = ''; // Will show error in video player
      }

      // For Watch TV remote feature, convert Vidking URLs to VidSrc for better quality and support
      if (videoSource.includes('vidking.net')) {
        console.log('Converting Vidking URL to VidSrc for Watch TV feature...');
        
        if (videoData.type === 'tv') {
          // Extract season and episode from Vidking URL
          // Format: https://www.vidking.net/embed/tv/{tvId}/{season}/{episode}?autoPlay=true...
          const urlParts = videoSource.split('/');
          const season = urlParts[urlParts.indexOf('tv') + 2] || '1';
          const episode = urlParts[urlParts.indexOf('tv') + 3]?.split('?')[0] || '1';
          videoSource = `https://vidsrc.icu/embed/tv/${videoData.id}/${season}/${episode}`;
          console.log('Converted TV to VidSrc:', videoSource);
        } else if (videoData.type === 'movie') {
          // Convert movie Vidking to VidSrc
          videoSource = `https://vidsrc.icu/embed/movie/${videoData.id}`;
          console.log('Converted movie to VidSrc:', videoSource);
        }
      }

      console.log('Setting video source to:', videoSource);
      setCurrentVideo({
        title: videoData.title,
        type: videoData.type,
        url: videoSource,
      });

      // Determine video type and notify remote
      const isIframe = videoSource.includes('vidking.net/embed') || videoSource.includes('vidsrc.icu/embed');
      const videoType = isIframe ? 'iframe' : 'direct';
      console.log('Video source:', videoSource);
      console.log('Is Iframe player:', isIframe);
      console.log('Video type determined:', videoType);
      
      // Emit video type to remote via socket
      if (socketRef.current) {
        console.log('Emitting video-type-update to room:', roomIdRef.current, 'type:', videoType);
        console.log('Socket connected:', socketRef.current.connected);
        socketRef.current.emit('video-type-update', { roomId: roomIdRef.current, videoType });
        console.log('video-type-update emitted');
      } else {
        console.warn('Socket not available for video-type-update');
      }

      console.log('Video set. currentVideo state updated. Video type:', videoType);

      // Reset video state
      setVideoState({
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        volume: 1,
      });
    } catch (error) {
      console.error('Error loading video:', error);
    }
  };

  // Request fullscreen when video loads
  useEffect(() => {
    if (currentVideo && fullscreenRef.current) {
      console.log('Requesting fullscreen...');
      if (fullscreenRef.current.requestFullscreen) {
        fullscreenRef.current.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      }
    }
  }, [currentVideo]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const newState = {
        ...videoState,
        currentTime: videoRef.current.currentTime,
        duration: videoRef.current.duration,
      };
      setVideoState(newState);

      // Emit video state to remote
      if (socketRef.current) {
        socketRef.current.emit('video-state-update', {
          roomId: roomIdRef.current,
          state: newState,
        });
      }
    }
  }, [videoState]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleReset = () => {
    setCurrentVideo(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleDisconnect = () => {
    console.log('User clicked disconnect, closing socket...');
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setRoomId('');
    setQrCodeUrl('');
    setCurrentVideo(null);
    setIsConnected(false);
    setRemoteConnected(false);
    router.push('/');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 overflow-y-auto">
      {/* Video Display - Takes full screen when video is loaded */}
      {currentVideo ? (
        <div ref={fullscreenRef} className="w-full h-screen fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
          {currentVideo.url ? (
            <>
              {currentVideo.url.includes('youtube.com/embed') || currentVideo.url.includes('vidking.net/embed') || currentVideo.url.includes('vidsrc.icu/embed') ? (
                // YouTube or Vidking embed
                <iframe
                  src={currentVideo.url}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={currentVideo.title}
                />
              ) : (
                // Direct video file
                <video
                  ref={videoRef}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onPlay={() => setVideoState((prev) => ({ ...prev, isPlaying: true }))}
                  onPause={() => setVideoState((prev) => ({ ...prev, isPlaying: false }))}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setVideoState((prev) => ({
                        ...prev,
                        duration: videoRef.current!.duration,
                      }));
                    }
                  }}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                >
                  <source src={currentVideo.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="absolute top-4 right-4 p-3 rounded-lg bg-red-600/80 hover:bg-red-700 transition-colors z-10"
                title="Back to home"
              >
                <RotateCcw size={24} />
              </button>
            </>
          ) : (
            <div className="text-center text-white">
              <p className="text-2xl mb-4">Loading: {currentVideo.title}</p>
              <p className="text-gray-400 mb-4">Waiting for video source...</p>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Go Back
              </button>
            </div>
          )}
        </div>
      ) : (
        /* QR Code and Setup Screen */
        <>
          <Header />
          <div className="w-full flex flex-col items-center pt-4 px-4">
          <div className="text-center mb-8 lg:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-2 lg:mb-4">J² TV Remote</h1>
            <p className="text-gray-400 text-sm sm:text-base md:text-lg">Setup your TV screen</p>
            
            {/* Connection Status */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi size={18} className="text-green-400" />
                    <span className="text-sm text-green-400">Receiver Ready</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={18} className="text-red-400" />
                    <span className="text-sm text-red-400">Disconnected</span>
                  </>
                )}
              </div>
              <div className="w-px h-4 bg-gray-600"></div>
              <div className="flex items-center gap-2">
                {remoteConnected ? (
                  <>
                    <Wifi size={18} className="text-green-400" />
                    <span className="text-sm text-green-400">Remote Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={18} className="text-gray-500" />
                    <span className="text-sm text-gray-500">No Remote Yet</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 w-full max-w-5xl">
            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-2xl p-6 md:p-8 lg:p-10">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 md:mb-6 lg:mb-8">Scan to Control</h2>
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code" 
                  className="w-full max-w-sm rounded-lg border-4 border-blue-500/50"
                />
              ) : (
                <div className="w-full max-w-sm h-64 bg-gray-800 rounded-lg animate-pulse" />
              )}
              <p className="mt-6 text-sm text-gray-400 text-center">
                Scan this QR code on another device to start controlling
              </p>
            </div>

            {/* Code Section */}
            <div className="flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-2xl p-6 md:p-8 lg:p-10">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 md:mb-6 lg:mb-8">Or Enter Code</h2>
              <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
                <div className="flex items-center justify-center mb-4 md:mb-6">
                  <code className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold tracking-widest text-blue-400 px-4 sm:px-6 py-3 sm:py-4 md:py-5 bg-gray-800/50 rounded-lg border-2 border-blue-500/50 w-full text-center">
                    {roomId}
                  </code>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="w-full py-2 md:py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm md:text-base"
                >
                  {copiedCode ? (
                    <>
                      <Check size={20} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={20} />
                      Copy Code
                    </>
                  )}
                </button>
              </div>
              <p className="mt-6 text-sm text-gray-400 text-center">
                Go to the remote control page and enter this code to connect
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 md:mt-10 lg:mt-12 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-4 md:p-6 lg:p-8 w-full max-w-2xl">
            <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-3 md:mb-4 lg:mb-6">How it works:</h3>
            <ol className="space-y-2 text-gray-300 text-xs sm:text-sm md:text-base">
              <li className="flex items-start">
                <span className="text-blue-400 font-bold mr-3">1.</span>
                <span>Share the QR code or code with someone on another device</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 font-bold mr-3">2.</span>
                <span>They open the remote control page and scan the QR code or enter the code</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 font-bold mr-3">3.</span>
                <span>They can search, select, and control movies/shows on this screen</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 font-bold mr-3">4.</span>
                <span>Your screen displays the full video while they control playback</span>
              </li>
            </ol>
          </div>

          {/* Disconnect Button */}
          <div className="mt-8 md:mt-10 lg:mt-12 flex justify-center w-full">
            <button
              onClick={handleDisconnect}
              className="px-4 md:px-6 lg:px-8 py-2 md:py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-xs sm:text-sm md:text-base font-semibold"
            >
              Disconnect & Reset
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default ReceiverContent;
