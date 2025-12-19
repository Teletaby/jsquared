'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerProvider';
import VideasyPlayer from './VideasyPlayer';
import VidLinkPlayer from './VidLinkPlayer';
import AdvancedVideoPlayer from './AdvancedVideoPlayer';
import { X, Maximize } from 'lucide-react';

export default function PersistentPlayer() {
  const { state, isActive, stop, update } = usePlayer();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close player when mediaId becomes null
  useEffect(() => {
    // nothing for now
  }, [isActive, state?.mediaId]);

  if (!isActive || !state) return null;

  const {
    mediaId,
    mediaType,
    title,
    posterPath,
    videoSource = 'videasy',
    initialTime = 0,
    embedUrl,
    seasonNumber,
    episodeNumber,
    onTimeUpdate,
  } = state;

  const handleClose = () => stop();
  const handleExpand = () => update({}); // placeholder - could implement expand state

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 left-6 w-80 h-44 rounded-lg shadow-2xl z-[60] overflow-hidden bg-black/90 border border-white/10 backdrop-blur-md flex flex-col"
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-white/10">
        <div className="text-xs text-white font-semibold truncate max-w-[180px]">{title}</div>
        <div className="flex items-center gap-2">
          <button className="p-1 text-white/80 hover:text-white" onClick={handleExpand} aria-label="Expand">
            <Maximize size={16} />
          </button>
          <button className="p-1 text-white/80 hover:text-white" onClick={handleClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-black">
        {videoSource === 'videasy' && (
          <VideasyPlayer
            key={`persistent-videasy-${mediaId}-${seasonNumber || ''}-${episodeNumber || ''}`}
            mediaId={mediaId}
            mediaType={mediaType}
            title={title}
            posterPath={posterPath || ''}
            initialTime={initialTime}
            onTimeUpdate={(time) => onTimeUpdate?.(time)}
          />
        )}

        {videoSource === 'vidlink' && (
          <VidLinkPlayer
            key={`persistent-vidlink-${mediaId}-${seasonNumber || ''}-${episodeNumber || ''}`}
            mediaId={mediaId}
            mediaType={mediaType}
            title={title}
            posterPath={posterPath || ''}
            initialTime={initialTime}
            onTimeUpdate={(time) => onTimeUpdate?.(time)}
          />
        )}

        {videoSource === 'vidnest' && embedUrl && (
          <AdvancedVideoPlayer
            key={`persistent-vidnest-${mediaId}`}
            embedUrl={embedUrl}
            title={title}
            mediaId={mediaId}
            mediaType={mediaType}
            posterPath={posterPath || ''}
            initialTime={initialTime}
            videoSource={videoSource}
            onTimeUpdate={(time) => onTimeUpdate?.(time)}
          />
        )}
      </div>
    </div>
  );
}
