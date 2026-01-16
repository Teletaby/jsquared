'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Info } from 'lucide-react';
import TrailerPopup from './TrailerPopup';
import WatchlistButton from './WatchlistButton';

interface CarouselItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
  overview?: string;
}

interface NetflixCarouselProps {
  items: CarouselItem[];
  title: string;
}

export default function NetflixCarousel({ items, title }: NetflixCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<CarouselItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  // Auto-scroll functionality
  useEffect(() => {
    const startAutoScroll = () => {
      autoScrollRef.current = setInterval(() => {
        const container = scrollContainerRef.current;
        if (container) {
          const { scrollLeft, scrollWidth, clientWidth } = container;
          const scrollAmount = 400;

          // If we can scroll right, scroll right
          if (scrollLeft + clientWidth < scrollWidth - 10) {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          } else {
            // Loop back to the start
            container.scrollTo({ left: 0, behavior: 'smooth' });
          }
        }
      }, 5000); // Auto-scroll every 5 seconds
    };

    startAutoScroll();
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, []);

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 400;
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }

    setTimeout(checkScrollability, 300);
  };

  const handleTrailerClick = async (e: React.MouseEvent, media: CarouselItem) => {
    e.stopPropagation();
    setSelectedMedia(media);

    const mediaTypeForPath = media.media_type === 'tv' || !!media.name ? 'tv' : 'movie';

    try {
      const response = await fetch(
        `/api/trailer/${media.id}?mediaType=${mediaTypeForPath}`
      );
      const data = await response.json();
      if (data.trailerKey) {
        setTrailerKey(data.trailerKey);
        setShowTrailer(true);
      }
    } catch (error) {
      console.error('Error fetching trailer:', error);
    }
  };

  return (
    <>
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-white font-orbitron uppercase px-4">
          {title}
        </h2>

        <div className="relative group">
          {/* Left Arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-r from-black/50 to-transparent hover:from-black/80 transition-all duration-300 flex items-center justify-start pl-4 text-white group-hover:opacity-100 opacity-0"
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto space-x-3 px-4 pb-4 hide-scrollbar snap-x snap-mandatory"
            onScroll={checkScrollability}
          >
            {items.map((media) => {
              const title = media.name || media.title || 'Unknown';
              const imageUrl = media.backdrop_path
                ? `https://image.tmdb.org/t/p/w1280${media.backdrop_path}`
                : media.poster_path
                  ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
                  : 'https://via.placeholder.com/1280x720.png?text=No+Image';

              const mediaTypeForPath =
                media.media_type === 'tv' || !!media.name ? 'tv' : 'movie';
              const isHovered = hoveredItem === media.id;

              return (
                <div
                  key={media.id}
                  className="flex-shrink-0 w-full sm:w-96 h-64 relative rounded-lg overflow-hidden group/card snap-start cursor-pointer"
                  onMouseEnter={() => setHoveredItem(media.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Background Image */}
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                  />

                  {/* Hover Overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90 transition-all duration-300 flex flex-col justify-between p-6 opacity-100`}
                  >
                    {/* Top Content */}
                    <div className="flex justify-between items-start">
                      <h3 className="text-white text-xl font-bold line-clamp-2 flex-1 pr-4">
                        {title}
                      </h3>
                      {typeof media.vote_average === 'number' &&
                        media.vote_average > 0 && (
                          <div className="bg-black/70 px-3 py-1 rounded text-yellow-400 font-bold text-sm flex-shrink-0">
                            {media.vote_average.toFixed(1)}
                          </div>
                        )}
                    </div>

                    {/* Bottom Buttons */}
                    <div className="flex gap-3 items-center">
                      <button
                        onClick={(e) => handleTrailerClick(e, media)}
                        className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-white/80 transition-colors duration-300 flex-shrink-0"
                      >
                        <Play size={18} fill="currentColor" />
                        View Trailer
                      </button>

                      <WatchlistButton
                        mediaId={media.id}
                        mediaType={mediaTypeForPath as 'movie' | 'tv'}
                        title={title}
                        posterPath={media.poster_path || ''}
                        rating={media.vote_average}
                        hideTooltip={true}
                        initialIsInWatchlist={false}
                      />

                      <button className="flex items-center justify-center w-10 h-10 border-2 border-white text-white rounded-full hover:border-gray-300 hover:text-gray-300 transition-colors duration-300 flex-shrink-0">
                        <Info size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Dark overlay for unhovered state */}
                </div>
              );
            })}
          </div>

          {/* Right Arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-l from-black/50 to-transparent hover:from-black/80 transition-all duration-300 flex items-center justify-end pr-4 text-white group-hover:opacity-100 opacity-0"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      </div>

      {showTrailer && trailerKey && (
        <TrailerPopup
          trailerKey={trailerKey}
          onClose={() => {
            setShowTrailer(false);
            setTrailerKey(null);
            setSelectedMedia(null);
          }}
        />
      )}
    </>
  );
}
