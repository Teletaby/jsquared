'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const RemoteContent = () => {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const socketRef = useRef<Socket | null>(null);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (roomId) {
      const socket = io();
      socketRef.current = socket;
      socket.emit('join-room', roomId);
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomId]);

  const sendCommand = (action: any) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('remote-control', { roomId, action });
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
    sendCommand({ type: 'seek', payload: time });
  };

  const handleVolume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(event.target.value);
    setVolume(vol);
    sendCommand({ type: 'volume', payload: vol });
  };

  if (!roomId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p>Room ID not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8">Remote Control</h1>
      <div className="space-y-6 w-full max-w-md">
        <button
          onClick={handlePlayPause}
          className="w-full py-4 text-2xl font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="space-y-2">
          <label htmlFor="volume" className="text-lg">
            Volume
          </label>
          <input
            type="range"
            id="volume"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolume}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        {/* A basic seek bar, assuming video duration is known or can be fetched */}
        <div className="space-y-2">
          <label htmlFor="seek" className="text-lg">
            Seek
          </label>
          <input
            type="range"
            id="seek"
            min="0"
            max="600" // Example: 10 minutes, you might want to get this dynamically
            step="1"
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      <p className="mt-8 text-lg">
        Connected to room: <span className="font-mono text-green-400">{roomId}</span>
      </p>
    </div>
  );
};

export default RemoteContent;
