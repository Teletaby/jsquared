'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import WatchlistButton from './WatchlistButton';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';

interface CarouselItem {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  overview?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
}

interface HeroCarouselProps {
  items: CarouselItem[];
}

type WatchlistStatusMap = {
  [key: string]: boolean; // "mediaId-mediaType": boolean
};

export default function HeroCarousel({ items }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isWatchButtonHovered, setIsWatchButtonHovered] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const { checkMultipleWatchlistStatuses } = useWatchlist();
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatusMap>({});
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      if (session?.user && items.length > 0) {
        setIsLoadingWatchlist(true);
        const mediaItems = items.map(item => ({
          mediaId: item.id,
          mediaType: (item.media_type === 'tv' || !!item.name ? 'tv' : 'movie') as 'movie' | 'tv',
        }));
        if (typeof checkMultipleWatchlistStatuses === 'function') {
          const statuses = await checkMultipleWatchlistStatuses(mediaItems);
          setWatchlistStatus(statuses);
        } else {
          console.error('checkMultipleWatchlistStatuses is not a function');
          setWatchlistStatus({});
        }
        setIsLoadingWatchlist(false);
      } else {
        setWatchlistStatus({});
        setIsLoadingWatchlist(false);
      }
    };
    fetchStatuses();
  }, [session, items, checkMultipleWatchlistStatuses]);

  const currentItem = items[currentIndex];
  const title = currentItem?.title || currentItem?.name || '';
  const backdropUrl = currentItem?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${currentItem.backdrop_path}`
    : 'https://via.placeholder.com/1920x1080';

  const mediaType = currentItem?.media_type === 'tv' || currentItem?.name ? 'tv' : 'movie';

  const startAutoPlay = () => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    autoPlayRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000); // Change every 5 seconds
  };

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [items.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    startAutoPlay();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    startAutoPlay();
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
    startAutoPlay();
  };

  const handlePlay = () => {
    router.push(`/${mediaType}/${currentItem.id}`);
  };

  const handleMoreInfo = () => {
    router.push(`/${mediaType}/${currentItem.id}?view=info`);
  };

  return (
    <>
      {/* Carousel - positioned below navbar */}
    <div className="relative w-screen left-1/2 -translate-x-1/2 h-[70vh] max-h-[500px] overflow-hidden mb-8 mt-0">
      {/* Carousel Items */}
      {items.map((item, index) => {
        const itemMediaType = item.media_type === 'tv' || !!item.name ? 'tv' : 'movie';
        const statusKey = `${item.id}-${itemMediaType}`;
        const initialIsInWatchlist = watchlistStatus[statusKey];

        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Background Image */}
            <img
              src={backdropUrl}
              alt={title}
              className="w-full h-full object-cover"
            />

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#121212] to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center p-8 pb-24 md:p-12 md:pb-28 md:pl-24 lg:pl-32">
              <div className="max-w-2xl">
                {/* Title */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  {title}
                </h1>

                {/* Rating & Info */}
                <div className="flex items-center gap-4 mb-6">
                  {currentItem.vote_average && (
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
                      <span className="text-yellow-400">⭐</span>
                      <span className="text-white font-semibold">
                        {currentItem.vote_average.toFixed(1)}/10
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {currentItem.overview && (
                  <p className="text-white text-sm md:text-base line-clamp-3 mb-6 drop-shadow-lg">
                    {currentItem.overview}
                  </p>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handlePlay}
                    onMouseEnter={() => setIsWatchButtonHovered(true)}
                    onMouseLeave={() => setIsWatchButtonHovered(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 hover:scale-105 ${
                      isWatchButtonHovered 
                        ? 'bg-red-700 text-white' 
                        : 'bg-white text-black'
                    }`}
                  >
                    <Play size={20} fill="currentColor" />
                    <span>Watch Now</span>
                  </button>
                  <button
                    onClick={handleMoreInfo}
                    className="flex items-center gap-2 bg-white/30 text-white p-3 rounded-lg font-semibold hover:bg-white/50 transition-all duration-300 backdrop-blur-md border border-white/30"
                  >
                    <Info size={20} />
                    <span>More Info</span>
                  </button>
                  <WatchlistButton
                      mediaId={item.id}
                      mediaType={itemMediaType}
                      title={item.title || item.name || ''}
                      posterPath={item.poster_path || ''}
                      rating={item.vote_average}
                      hideTooltip={true}
                      initialIsInWatchlist={initialIsInWatchlist}
                    />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Navigation Buttons */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-300 backdrop-blur-md"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-300 backdrop-blur-md"
      >
        <ChevronRight size={24} />
      </button>

      {/* Dot Indicators with Glass Effect */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10 backdrop-blur-sm bg-black/30 py-2 px-4 rounded-full w-fit mx-auto">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => handleDotClick(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-accent w-8'
                : 'bg-white/50 w-2 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
    </>
  );
}
