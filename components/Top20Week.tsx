'use client'
import { getTrendingDay } from '@/lib/tmdb';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import TrailerPopup from './TrailerPopup';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300';

const Top10Today = () => {
  const [trending, setTrending] = useState<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchTrending = async () => {
      const trendingData = await getTrendingDay();
      setTrending(trendingData?.results?.slice(0, 10) || []);
    };
    fetchTrending();
  }, []);

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  }, [trending]);

  // Auto-scroll — pauses when user hovers
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isHovering) return;

    const interval = setInterval(() => {
      if (container.scrollLeft >= container.scrollWidth - container.clientWidth - 1) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollLeft += 1;
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isHovering, trending]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = 500;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScrollability, 350);
  };

  const handleClick = (media: any) => {
    const type = media.media_type === 'tv' || !!media.name ? 'tv' : 'movie';
    router.push(`/${type}/${media.id}?view=info`);
  };

  const handleTrailerClick = useCallback(async (e: React.MouseEvent, media: any) => {
    e.stopPropagation();
    const type = media.media_type === 'tv' || !!media.name ? 'tv' : 'movie';
    try {
      const res = await fetch(`/api/trailer/${media.id}?mediaType=${type}`);
      const data = await res.json();
      if (data.trailerKey) {
        setTrailerKey(data.trailerKey);
        setShowTrailer(true);
      }
    } catch (err) {
      console.error('Error fetching trailer:', err);
    }
  }, []);

  return (
    <div
      className="mb-8 sm:mb-12 px-4"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Hover fill style — needs real CSS to override inline styles */}
      <style jsx>{`
        .rank-number {
          color: transparent;
          -webkit-text-stroke: 3px #b91c1c;
          transition: color 0.3s ease, text-shadow 0.3s ease;
        }
        .card-item:hover .rank-number {
          color: #b91c1c !important;
          text-shadow: 0 0 30px rgba(185, 28, 28, 0.5);
        }
      `}</style>
      {/* Title */}
      <div className="flex items-baseline gap-3 mb-4">
        <h2
          className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter"
          style={{ fontFamily: "'Bebas Neue', 'Impact', sans-serif" }}
        >
          TOP 10
        </h2>
        <span className="text-sm sm:text-base md:text-lg font-semibold tracking-[0.25em] uppercase text-gray-300">
          Today
        </span>
      </div>

      {/* Carousel */}
      <div className="relative group">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 w-12 flex items-center justify-center
                       bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover:opacity-100
                       transition-opacity duration-300"
          >
            <ChevronLeft size={36} className="text-white drop-shadow-lg" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-1 sm:gap-2 pb-4 hide-scrollbar scroll-smooth"
          onScroll={checkScrollability}
        >
          {trending.map((media: any, index: number) => {
            const rank = index + 1;
            const title = media.title || media.name || '';
            const poster = media.poster_path
              ? `${TMDB_IMAGE_BASE}${media.poster_path}`
              : '/placeholder.png';

            return (
              <div
                key={media.id}
                className="card-item flex-shrink-0 flex items-end cursor-pointer group/card relative
                           transition-transform duration-300 hover:scale-105 overflow-hidden"
                style={{ width: 'clamp(180px, 22vw, 260px)' }}
                onClick={() => handleClick(media)}
              >
                {/* Large rank number — overlaps behind the poster edge */}
                <span
                  className="rank-number absolute bottom-6 select-none pointer-events-none z-[1]
                             leading-none"
                  style={{
                    fontSize: 'clamp(120px, 16vw, 200px)',
                    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                    fontWeight: 900,
                    lineHeight: 0.75,
                    textShadow: '0 0 20px rgba(185, 28, 28, 0.3)',
                    left: '0',
                  }}
                >
                  {rank}
                </span>

                {/* Poster + Title + Trailer button — overlaps the number */}
                <div className="relative z-[2]" style={{ width: '65%', marginLeft: '22%' }}>
                  <div className="rounded-md overflow-hidden shadow-xl relative aspect-[2/3]">
                    <Image
                      src={poster}
                      alt={title}
                      fill
                      sizes="(max-width: 640px) 120px, 160px"
                      className="object-cover"
                    />
                    {/* Watch Trailer button — appears on hover */}
                    <div className="absolute inset-0 flex items-end justify-center pb-3
                                    opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={(e) => handleTrailerClick(e, media)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md
                                   bg-white text-black text-xs font-bold
                                   hover:bg-[#E50914] hover:text-white
                                   transition-colors duration-200 shadow-lg
                                   active:scale-95"
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Watch Trailer</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-white text-xs sm:text-sm mt-2 text-center truncate px-1 font-semibold tracking-[0.15em] uppercase">
                    {title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 w-12 flex items-center justify-center
                       bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover:opacity-100
                       transition-opacity duration-300"
          >
            <ChevronRight size={36} className="text-white drop-shadow-lg" />
          </button>
        )}
      </div>

      {/* Trailer popup */}
      {showTrailer && trailerKey && (
        <TrailerPopup trailerKey={trailerKey} onClose={() => setShowTrailer(false)} />
      )}
    </div>
  );
};

export default Top10Today;
