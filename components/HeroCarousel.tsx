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
  const [showInfoModal, setShowInfoModal] = useState(false);
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
    setShowInfoModal(true);
  };

  return (
    <>
      {/* Info Modal */}
      {showInfoModal && currentItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            {/* Modal Header */}
            <div className="sticky top-0 flex justify-between items-center p-6 bg-[#242424] border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">
                {currentItem.title || currentItem.name}
              </h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-white hover:text-red-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Poster and Basic Info */}
              <div className="flex gap-6">
                {currentItem.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${currentItem.poster_path}`}
                    alt={currentItem.title || currentItem.name}
                    className="w-48 h-72 object-cover rounded-lg shadow-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  {/* Rating */}
                  {currentItem.vote_average && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-yellow-400 text-xl">⭐</span>
                      <span className="text-white font-semibold text-lg">
                        {currentItem.vote_average.toFixed(1)}/10
                      </span>
                    </div>
                  )}

                  {/* Type */}
                  <div className="mb-4">
                    <span className="inline-block bg-red-700 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {mediaType === 'tv' ? 'TV Series' : 'Movie'}
                    </span>
                  </div>

                  {/* Description */}
                  {currentItem.overview && (
                    <p className="text-gray-300 text-base leading-relaxed">
                      {currentItem.overview}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowInfoModal(false);
                        handlePlay();
                      }}
                      className="flex items-center gap-2 bg-red-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-800 transition-all duration-300"
                    >
                      <Play size={18} fill="currentColor" />
                      <span>Watch Now</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowInfoModal(false);
                        router.push(`/${mediaType}/${currentItem.id}?view=info`);
                      }}
                      className="flex items-center gap-2 bg-white/20 text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/30 transition-all duration-300"
                    >
                      <Info size={18} />
                      <span>View Full Details</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carousel */}
    <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[300px] md:h-[400px] overflow-hidden mb-8">
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
            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 md:pl-24 lg:pl-32">
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
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-red-700 hover:text-white transition-all duration-300 hover:scale-105"
                  >
                    <Play size={20} fill="currentColor" />
                    <span>Watch Now</span>
                  </button>
                  <button
                    onClick={handleMoreInfo}
                    className="flex items-center gap-2 bg-white/30 text-white p-3 rounded-lg font-semibold hover:bg-white/50 transition-all duration-300 backdrop-blur-md border border-white/30"
                  >
                    <Info size={20} />
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
