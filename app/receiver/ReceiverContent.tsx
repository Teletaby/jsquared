'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import io from 'socket.io-client';
import { useSearchParams } from 'next/navigation';

const ReceiverContent = () => {
  const [roomId, setRoomId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const searchParams = useSearchParams();
  const videoSrc = searchParams.get('videoSrc');

  useEffect(() => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);

    const remoteUrl = `${window.location.origin}/remote?roomId=${newRoomId}`;
    QRCode.toDataURL(remoteUrl, (err, url) => {
      if (err) {
        console.error(err);
        return;
      }
      setQrCodeUrl(url);
    });

    const socket = io();
    socket.emit('join-room', newRoomId);

    socket.on('remote-control', (action) => {
      // Remote control functionality for iframes requires postMessage API
      // and a compatible embedded player. This is currently not implemented.
      console.warn("Remote control actions are not supported for embedded iframes directly.");
      console.log("Received remote control action:", action);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-4xl font-bold mb-4">Watch on TV</h1>
      {videoSrc ? (
        <iframe
          src={videoSrc}
          width="100%"
          height="600"
          frameBorder="0"
          allow="autoplay; fullscreen"
          title="Video Player"
          className="w-full max-w-4xl"
        ></iframe>
      ) : (
        <p>No video source provided.</p>
      )}
      <div className="mt-8 flex flex-col items-center">
        <p className="text-lg mb-2">Scan this QR code with your phone to start controlling.</p>
        {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" />}
        <p className="mt-4 text-2xl font-mono">{roomId}</p>
      </div>
    </div>
  );
};

export default ReceiverContent;
