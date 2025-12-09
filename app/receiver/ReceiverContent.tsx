'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import io from 'socket.io-client';
import { useSearchParams } from 'next/navigation';

const ReceiverContent = () => {
  const [roomId, setRoomId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null); // Ref for the iframe
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
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const targetOrigin = '*'; // Consider specifying vidking.net origin for security
        switch (action.type) {
          case 'play':
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), targetOrigin);
            break;
          case 'pause':
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), targetOrigin);
            break;
          case 'seek':
            // Seek commands often require a time in seconds
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [action.payload, true] }), targetOrigin);
            break;
          case 'volume':
            // Volume typically takes a value between 0 and 100 for some players
            // Adjust payload from 0-1 to 0-100 if necessary for vidking
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [action.payload * 100] }), targetOrigin);
            break;
          default:
            console.warn("Unknown remote control action:", action.type);
            break;
        }
      } else {
        console.warn("Attempted to send remote control action, but iframe not ready or contentWindow not accessible.");
      }
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
          ref={iframeRef} // Assign the ref here
          src={videoSrc}
          width="100%"
          height="600"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" // Ensure fullscreen and other permissions
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
