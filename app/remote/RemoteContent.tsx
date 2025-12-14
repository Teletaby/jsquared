'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { Volume2, VolumeX, Play, Pause, Search as SearchIcon, RotateCcw, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

interface Movie {
  id: number;
  title: string;
  name?: string;
  poster_path: string;
  media_type?: string;
}

const RemoteContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('roomId');
  const socketRef = useRef<Socket | null>(null);
  const [volume, setVolume] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(!roomId);
  const [inputCode, setInputCode] = useState('');
  const [actualRoomId, setActualRoomId] = useState(roomId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(100);
  const [isConnected, setIsConnected] = useState(false);
  const [currentVideoType, setCurrentVideoType] = useState<'iframe' | 'direct' | null>(null);

  useEffect(() => {
    if (actualRoomId && actualRoomId !== '') {
      console.log('Remote useEffect triggered with roomId:', actualRoomId);
      console.log('Window location:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
      setShowCodeInput(false);
      
      const socketConfig = {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      };
      console.log('Initializing Socket.IO with config:', socketConfig);
      
      const socket = io(socketConfig);
      socketRef.current = socket;
      
      console.log('Socket.IO client created, attempting connection...');
      
      socket.on('connect', () => {
        console.log('Remote connected to server, socket ID:', socket.id);
        setIsConnected(true);
        console.log('Remote emitting join-room with ID:', actualRoomId);
        socket.emit('join-room', actualRoomId);
      });

      // Listen for room status updates to confirm connection
      socket.on('room-status', (status) => {
        console.log('Remote got room-status:', status);
        console.log('ClientCount:', status.clientCount);
        setIsConnected(true);
      });

      socket.on('video-state-update', (state) => {
        setCurrentTime(state.currentTime || 0);
        setDuration(state.duration || 100);
      });

      socket.on('video-type-update', (type) => {
        console.log('Remote got video-type-update:', type);
        console.log('Setting currentVideoType to:', type);
        setCurrentVideoType(type);
      });

      socket.on('disconnect', () => {
        console.log('Remote disconnected from server');
        setIsConnected(false);
        setCurrentVideoType(null);
      });

      socket.on('connect_error', (error) => {
        console.error('Remote connection error:', error);
        setIsConnected(false);
      });

      socket.on('error', (error) => {
        console.error('Remote socket error:', error);
        setIsConnected(false);
      });

      return () => {
        console.log('Cleaning up remote socket');
        socket.disconnect();
      };
    }
  }, [actualRoomId]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      const trimmedCode = inputCode.trim().toUpperCase();
      console.log('Code submitted:', trimmedCode);
      setActualRoomId(trimmedCode);
      router.push(`/remote?roomId=${trimmedCode}`);
    }
  };

  const sendCommand = (action: any) => {
    if (socketRef.current && actualRoomId) {
      socketRef.current.emit('remote-control', { roomId: actualRoomId, action });
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      sendCommand({ type: 'pause' });
    } else {
      sendCommand({ type: 'play' });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value);
    setCurrentTime(time);
    sendCommand({ type: 'seek', payload: time });
  };

  const handleVolume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(event.target.value);
    setVolume(vol);
    sendCommand({ type: 'volume', payload: vol / 100 });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=multi`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMovie = (movie: Movie) => {
    const mediaType = movie.media_type || 'movie';
    const movieTitle = movie.title || movie.name || 'Unknown';
    
    const command = {
      type: 'load-video',
      payload: {
        id: movie.id,
        title: movieTitle,
        type: mediaType,
        posterPath: movie.poster_path,
        youtubeId: null, // We'll get this from the API
      }
    };
    
    console.log('Sending command:', command);
    sendCommand(command);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (showCodeInput && !actualRoomId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4">
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 left-4 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600 transition-colors"
          title="Go back"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl">
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 md:p-8 lg:p-10 shadow-2xl">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 text-center">TV Remote</h1>
            <p className="text-gray-400 text-center mb-6 md:mb-8 text-sm md:text-base">Enter the code from your TV to start controlling</p>
            
            <form onSubmit={handleCodeSubmit} className="space-y-3 md:space-y-4">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit code"
                className="w-full px-4 md:px-6 py-2 md:py-3 lg:py-4 rounded-lg bg-gray-700/50 border border-gray-600 focus:border-blue-500 focus:outline-none text-white text-center text-lg md:text-xl lg:text-2xl tracking-widest"
                maxLength={6}
              />
              <button
                type="submit"
                className="w-full py-2 md:py-3 lg:py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors duration-200 text-base md:text-lg lg:text-xl"
              >
                Connect
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-3 sm:p-4 md:p-6">
      {/* Header with Back Button and Status */}
      <div className="mb-4 sm:mb-6 md:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Remote Control</h1>
          <div className="flex items-center gap-2 mt-1 md:mt-2">
            <p className="text-gray-400 text-sm">Room: <span className="font-mono text-blue-400">{actualRoomId}</span></p>
            {isConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-400 ml-2">
                <Wifi size={14} />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-500 ml-2">
                <WifiOff size={14} />
                Connecting...
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600 transition-colors"
          title="Go back"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Search Section */}
      <div className="mb-4 sm:mb-6 md:mb-8 lg:mb-10">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search movies or TV shows..."
            className="w-full pl-10 pr-4 py-2 md:py-3 lg:py-4 rounded-lg bg-gray-700/50 border border-gray-600 focus:border-blue-500 focus:outline-none text-white placeholder-gray-400 text-sm md:text-base lg:text-lg"
          />
        </div>

        {/* Search Results */}
        {(isSearching || searchResults.length > 0) && (
          <div className="mt-3 md:mt-4 lg:mt-6 bg-gray-800/50 backdrop-blur-lg rounded-lg border border-gray-700 p-2 md:p-3 lg:p-4 max-h-64 md:max-h-72 lg:max-h-80 overflow-y-auto">
            {isSearching ? (
              <p className="text-gray-400 text-center text-xs md:text-sm lg:text-base">Searching...</p>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {searchResults.map((movie) => (
                  <button
                    key={`${movie.media_type}-${movie.id}`}
                    onClick={() => handleSelectMovie(movie)}
                    className="group relative rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all duration-200 hover:scale-110"
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                      alt={movie.title || movie.name}
                      className="w-full aspect-video object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-movie.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                      <Play className="text-white" size={32} fill="white" />
                    </div>
                    <p className="text-xs mt-1 truncate text-gray-300 group-hover:text-white">
                      {movie.title || movie.name}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center">No results found</p>
            )}
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="mt-auto space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6">
        {currentVideoType ? (
          <>
            {/* Info message for iframe players */}
            {currentVideoType === 'iframe' && (
              <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-2 md:p-3 lg:p-4 text-center">
                <p className="text-blue-200 text-xs md:text-sm lg:text-base">📺 Using Web Player</p>
                <p className="text-xs text-gray-400 mt-1 md:mt-2">Remote controls unavailable for web players. Use the player's built-in controls.</p>
              </div>
            )}

            {/* Show controls only for direct videos */}
            {currentVideoType === 'direct' && (
              <>
                {/* Seek Bar */}
                <div className="space-y-1 md:space-y-2">
                  <div className="flex justify-between text-xs md:text-sm text-gray-400">
                    <span>{Math.floor(currentTime)}s</span>
                    <span>{Math.floor(duration)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 md:h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Playback Controls */}
                <div className="flex gap-2 md:gap-3 lg:gap-4 justify-center">
                  <button
                    onClick={() => sendCommand({ type: 'rewind', payload: 10 })}
                    className="p-2 md:p-3 lg:p-4 rounded-lg bg-gray-700/50 hover:bg-gray-600 transition-colors"
                    title="Rewind 10s"
                  >
                    <RotateCcw size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="p-2 md:p-3 lg:p-4 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors flex-1 flex items-center justify-center gap-1 md:gap-2"
                  >
                    {isPlaying ? <Pause size={22} className="md:w-6 md:h-6 lg:w-7 lg:h-7" /> : <Play size={22} fill="white" className="md:w-6 md:h-6 lg:w-7 lg:h-7" />}
                    <span className="font-semibold text-xs md:text-sm lg:text-base">{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    onClick={() => sendCommand({ type: 'forward', payload: 10 })}
                    className="p-2 md:p-3 lg:p-4 rounded-lg bg-gray-700/50 hover:bg-gray-600 transition-colors"
                    title="Forward 10s"
                  >
                    <RotateCcw size={20} className="transform scale-x-[-1] md:w-6 md:h-6 lg:w-7 lg:h-7" />
                  </button>
                </div>

                {/* Volume Control */}
                <div className="space-y-1 md:space-y-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <VolumeX size={18} className={`${volume === 0 ? 'text-blue-400' : 'text-gray-400'} md:w-5 md:h-5 lg:w-6 lg:h-6`} />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={volume}
                      onChange={handleVolume}
                      className="flex-1 h-2 md:h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <Volume2 size={18} className={`${volume === 100 ? 'text-blue-400' : 'text-gray-400'} md:w-5 md:h-5 lg:w-6 lg:h-6`} />
                  </div>
                  <p className="text-xs md:text-sm text-gray-400 text-center">{volume}%</p>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 md:p-4 lg:p-6 text-center text-gray-400">
            <p className="text-xs md:text-sm lg:text-base">No video loaded. Search and select a movie or show above.</p>
          </div>
        )}

        {/* Disconnect Button */}
        <button
          onClick={() => {
            console.log('User clicking disconnect');
            // Notify receiver of disconnect before disconnecting
            if (socketRef.current && actualRoomId) {
              socketRef.current.emit('remote-disconnect', { roomId: actualRoomId });
            }
            setShowCodeInput(true);
            setActualRoomId('');
            setInputCode('');
            setCurrentVideoType(null);
            setTimeout(() => {
              socketRef.current?.disconnect();
            }, 100);
          }}
          className="w-full py-2 md:py-3 lg:py-4 rounded-lg bg-gray-700/50 hover:bg-red-600/50 transition-colors text-xs md:text-sm lg:text-base font-medium"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

export default RemoteContent;
