'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { Bookmark } from 'lucide-react';

interface WatchlistButtonProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  rating?: number;
  hideTooltip?: boolean;
  initialIsInWatchlist?: boolean;
}

export default function WatchlistButton({
  mediaId,
  mediaType,
  title,
  posterPath,
  rating,
  hideTooltip = false,
  initialIsInWatchlist,
}: WatchlistButtonProps) {
  const { data: session } = useSession();
  const { addToWatchlist, removeFromWatchlist, checkWatchlistStatus } = useWatchlist();
  const [isInWatchlist, setIsInWatchlist] = useState(initialIsInWatchlist ?? false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Update isInWatchlist if the initialIsInWatchlist prop changes
    setIsInWatchlist(initialIsInWatchlist ?? false);
  }, [initialIsInWatchlist]);

  const handleToggleWatchlist = async () => {
    if (!session?.user) {
      // Redirect to sign in
      window.location.href = '/signin';
      return;
    }

    setIsLoading(true);

    if (isInWatchlist) {
      const success = await removeFromWatchlist(mediaId, mediaType);
      if (success) {
        setIsInWatchlist(false);
      }
    } else {
      const success = await addToWatchlist(mediaId, mediaType, title, posterPath, rating);
      if (success) {
        setIsInWatchlist(true);
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="group relative">
      <button
        onClick={handleToggleWatchlist}
        disabled={isLoading}
        className={`p-2 px-3 rounded-lg transition-all duration-200 ${
          isInWatchlist
            ? 'bg-accent/20 text-accent hover:scale-110'
            : 'bg-white/30 text-gray-200 hover:text-accent hover:scale-110'
        } disabled:opacity-50 backdrop-blur-md border border-white/30 flex items-center justify-center gap-2`}
        aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        <Bookmark
          size={16}
          fill={isInWatchlist ? 'currentColor' : 'none'}
          strokeWidth={2}
        />
      </button>
      {/* Hover Tooltip */}
      {!hideTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          {isLoading ? 'Loading...' : isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        </div>
      )}
    </div>
  );
}
