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
  const imageUrl = media.poster_path
    ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
    : 'https://via.placeholder.com/500x750.png?text=No+Image';
  
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
        className="bg-ui-elements rounded-lg overflow-hidden shadow-lg group cursor-pointer flex flex-col h-full"
        onClick={handleCardClick}
        onMouseEnter={checkTrailerAvailability}
      >
        <div className="relative w-full flex-shrink-0">
          <img src={imageUrl} alt={title} className="w-full h-auto object-cover" />
          {/* Overlay for larger screens on hover */}
          <div className="absolute inset-0 bg-black bg-opacity-60 flex-col justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex">
            <div>
              <h3 className="text-white text-lg font-bold">{title}</h3>
              {typeof media.vote_average === 'number' && media.vote_average > 0 && (
                <p className="text-yellow-400 text-sm font-semibold">
                  Rating: {media.vote_average.toFixed(1)} / 10
                </p>
              )}
            </div>
            <div className="text-center flex gap-2 justify-center items-center">
              {trailerChecked && !hasTrailer ? (
                <button
                  disabled
                  className="p-1 px-2 rounded-lg bg-gray-600/50 text-gray-400 flex items-center gap-1 whitespace-nowrap cursor-not-allowed"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Film size={14} />
                  <span className="text-xs font-semibold">No Trailer</span>
                </button>
              ) : (
                <button
                  onClick={handleTrailerClick}
                  className="p-1 px-2 rounded-lg bg-accent text-white hover:bg-accent-darker transition-colors duration-300 flex items-center gap-1 whitespace-nowrap"
                >
                  <Play size={14} />
                  <span className="text-xs font-semibold">Watch Trailer</span>
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
              />
            </div>
          </div>
        </div>
        {/* Always visible content for smaller screens */}
        <div className="p-3 flex flex-col justify-between flex-grow md:hidden">
          <div>
            <h3 className="text-white text-base font-bold truncate">{title}</h3>
            {typeof media.vote_average === 'number' && media.vote_average > 0 && (
              <p className="text-yellow-400 text-xs font-semibold">
                Rating: {media.vote_average.toFixed(1)} / 10
              </p>
            )}
          </div>
          <div className="mt-2 flex gap-2 items-center">
            {trailerChecked && !hasTrailer ? (
              <button
                disabled
                className="p-1 px-2 rounded-lg bg-gray-600/50 text-gray-400 flex items-center gap-1 whitespace-nowrap cursor-not-allowed"
                onClick={(e) => e.stopPropagation()}
              >
                <Film size={14} />
                <span className="text-xs font-semibold">No Trailer</span>
              </button>
            ) : (
              <button
                onClick={handleTrailerClick}
                className="p-1 px-2 rounded-lg bg-accent text-white hover:bg-accent-darker transition-colors duration-300 flex items-center gap-1 whitespace-nowrap"
              >
                <Play size={14} />
                <span className="text-xs font-semibold">Watch Trailer</span>
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
            />
          </div>
        </div>
      </div>
      {showTrailer && trailerKey && (
        <TrailerPopup trailerKey={trailerKey} onClose={() => setShowTrailer(false)} />
      )}
    </>
  );
};

export default MediaCard;