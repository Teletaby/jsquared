'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Play, Film } from 'lucide-react';
import TrailerPopup from './TrailerPopup';
import WatchlistButton from './WatchlistButton';

export interface Media {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
  name?: string;
  isUpcoming?: boolean;
}

interface MediaCardProps {
  media: Media;
  onClick?: () => void;
  initialIsInWatchlist?: boolean;
}

const MediaCard: React.FC<MediaCardProps> = ({ media, onClick, initialIsInWatchlist }) => {
  const router = useRouter();
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerChecked, setTrailerChecked] = useState(false);
  const [hasTrailer, setHasTrailer] = useState(true);
  const [isCheckingTrailer, setIsCheckingTrailer] = useState(false);

  const title = media.name || media.title;
  const imageUrl = media.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${media.backdrop_path}`
    : media.poster_path
    ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
    : 'https://via.placeholder.com/780x440.png?text=No+Image';
  
  const mediaTypeForPath = media.media_type === 'tv' || !!media.name ? 'tv' : 'movie';

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/${mediaTypeForPath}/${media.id}?view=info`);
    }
  };

  // Check trailer availability on hover
  const checkTrailerAvailability = async () => {
    if (trailerChecked || isCheckingTrailer) return;
    
    setIsCheckingTrailer(true);
    try {
      const response = await fetch(`/api/trailer/${media.id}?mediaType=${mediaTypeForPath}`);
      const data = await response.json();
      setTrailerChecked(true);
      if (data.trailerKey) {
        setTrailerKey(data.trailerKey);
        setHasTrailer(true);
      } else {
        setHasTrailer(false);
      }
    } catch (error) {
      console.error('Error fetching trailer:', error);
      setTrailerChecked(true);
      setHasTrailer(false);
    } finally {
      setIsCheckingTrailer(false);
    }
  };

  const handleTrailerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If we already checked and there's no trailer, don't do anything
    if (trailerChecked && !hasTrailer) {
      return;
    }
    
    // If we have a trailer key, show it
    if (trailerKey) {
      setShowTrailer(true);
      return;
    }
    
    // Otherwise fetch and show
    try {
      const response = await fetch(`/api/trailer/${media.id}?mediaType=${mediaTypeForPath}`);
      const data = await response.json();
      setTrailerChecked(true);
      if (data.trailerKey) {
        setTrailerKey(data.trailerKey);
        setHasTrailer(true);
        setShowTrailer(true);
      } else {
        setHasTrailer(false);
      }
    } catch (error) {
      console.error('Error fetching trailer:', error);
      setTrailerChecked(true);
      setHasTrailer(false);
    }
  };

  return (
    <>
      <div
        className="relative w-full rounded-xl shadow-lg group cursor-pointer flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:scale-105 origin-bottom overflow-hidden"
        onClick={handleCardClick}
        onMouseEnter={checkTrailerAvailability}
        style={{ aspectRatio: '2/3' }}
      >
        {/* Image Container - with overflow hidden */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          {/* Background Image */}
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />

          {/* Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80 group-hover:from-black/30 group-hover:via-black/50 group-hover:to-black/90 transition-all duration-300" />
        </div>

        {/* Content Container */}
        <div className="relative h-full flex flex-col justify-between p-4 sm:p-5">
          {/* Top Section - Title and Rating */}
          <div className="transform transition-all duration-300">
            {/* Title */}
            <h3 className="text-white text-lg sm:text-xl font-bold line-clamp-2 mb-2 font-orbitron uppercase tracking-wide">
              {title}
            </h3>

            {/* Rating */}
            {typeof media.vote_average === 'number' &&
              media.vote_average > 0 && (
                <p className="text-yellow-400 text-xs sm:text-sm font-bold mb-3">
                  ★ {media.vote_average.toFixed(1)}/10
                </p>
              )}
          </div>

          {/* Bottom Section - Empty for layout */}
          <div></div>

          {/* Buttons - Animated */}
          <div className="flex gap-1 sm:gap-2 items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            {trailerChecked && !hasTrailer ? (
              <button
                disabled
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gray-600/50 text-gray-400 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-not-allowed text-xs font-bold"
                onClick={(e) => e.stopPropagation()}
              >
                <Film size={12} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">NO TRAILER</span>
              </button>
            ) : (
              <button
                onClick={handleTrailerClick}
                className="px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-white text-black hover:bg-[#E50914] hover:text-white transition-colors duration-300 flex items-center gap-1 sm:gap-2 whitespace-nowrap font-bold text-xs active:scale-95 hover:shadow-lg"
              >
                <Play size={12} className="sm:w-4 sm:h-4" fill="currentColor" />
                <span className="sm:hidden">TRAILER</span>
                <span className="hidden sm:inline">VIEW TRAILER</span>
              </button>
            )}

            <WatchlistButton
              mediaId={media.id}
              mediaType={mediaTypeForPath as 'movie' | 'tv'}
              title={title}
              posterPath={media.poster_path || ''}
              rating={media.vote_average}
              hideTooltip={true}
              initialIsInWatchlist={initialIsInWatchlist}
              onToggle={() => router.push(`/${mediaTypeForPath}/${media.id}?view=info`)}
            />
          </div>
        </div>
      </div>

      {/* Always visible info for mobile - removed for cleaner look */}
      {showTrailer && trailerKey && (
        <TrailerPopup trailerKey={trailerKey} onClose={() => setShowTrailer(false)} />
      )}
    </>
  );
};

export default MediaCard;