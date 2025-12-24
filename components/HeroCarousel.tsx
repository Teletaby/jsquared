'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Info, Tv, Film } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getVideoSourceSetting, setExplicitSourceForMedia } from '@/lib/utils';
import WatchlistButton from './WatchlistButton';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';
import { getMediaLogos } from '@/lib/tmdb';

interface CarouselItem {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  overview?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
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
  const [logoMap, setLogoMap] = useState<Map<number, string>>(new Map());
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const [userSource, setUserSource] = useState<'videasy' | 'vidlink' | 'vidnest' | null>(null);
  const { data: session } = useSession();
  const { checkMultipleWatchlistStatuses } = useWatchlist();
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatusMap>({});

  // Fetch logos for carousel items
  useEffect(() => {
    const fetchLogos = async () => {
      const newLogoMap = new Map<number, string>();
      
      for (const item of items) {
        const mediaType = item.media_type === 'tv' || !!item.name ? 'tv' : 'movie';
        try {
          const imageData = await getMediaLogos(mediaType, item.id);
          if (imageData?.logos && imageData.logos.length > 0) {
            // Get the English logo or the first one available
            const englishLogo = imageData.logos.find((logo: any) => logo.iso_639_1 === 'en');
            const logoPath = englishLogo?.file_path || imageData.logos[0]?.file_path;
            if (logoPath) {
              newLogoMap.set(item.id, `https://image.tmdb.org/t/p/w500${logoPath}`);
            }
          }
        } catch (error) {
          console.error(`Error fetching logos for ${item.id}:`, error);
        }
      }
      
      setLogoMap(newLogoMap);
    };

    if (items.length > 0) {
      fetchLogos();
    }
  }, [items]);

  useEffect(() => {
    const fetchStatuses = async () => {
      if (session?.user && items.length > 0) {
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
      } else {
        setWatchlistStatus({});
      }
    };
    fetchStatuses();
  }, [session, items, checkMultipleWatchlistStatuses]);

  const currentItem = items[currentIndex] || null;

  // Ensure currentIndex stays within bounds when items array changes
  useEffect(() => {
    if (!items || items.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= items.length) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

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

  // Fetch user's preferred video source (best-effort) so the Play button can preserve it
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getVideoSourceSetting();
        if (mounted) setUserSource(s);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  const handlePlay = async () => {
    // Do NOT include source in the URL. Persist user's preferred source only when logged in.
    if (userSource && session?.user) {
      try {
        // For hero play, prefer per-media explicit source (do not update global)
        try { setExplicitSourceForMedia(currentItem.id, userSource); console.log('[HeroCarousel] Set per-media explicit source', { mediaId: currentItem.id, source: userSource }); } catch(e){}

        // Persist to server as an immediate watch-history write so the selection is durable
        try {
          const payload: any = {
            mediaId: currentItem.id,
            mediaType,
            currentTime: 0,
            totalDuration: 0,
            progress: 0,
            immediate: true,
            source: userSource,
            explicit: true,
            title: currentItem.title || '',
            posterPath: (currentItem as any).poster_path || '',
          };
          fetch('/api/watch-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(() => console.log('[HeroCarousel] Persisted per-media explicit source to watch-history', { mediaId: currentItem.id, source: userSource }))
            .catch(err => console.warn('[HeroCarousel] Failed to persist explicit source', err));
        } catch (e) {
          console.warn('[HeroCarousel] Error persisting explicit source', e);
        }
      } catch (e) {
        // ignore
      }
    }

    // Navigate to the watch page without exposing the source in the URL
    router.push(`/${mediaType}/${currentItem.id}`);
  };

  const handleMoreInfo = () => {
    router.push(`/${mediaType}/${currentItem.id}?view=info`);
  };

  // Safeguard: if there is no content, show a simple placeholder
  if (!items || items.length === 0) {
    return (
      <div className="relative w-screen left-1/2 -translate-x-1/2 h-[70vh] max-h-[500px] flex items-center justify-center mb-8 mt-0">
        <div className="text-gray-400">No trending content available for today.</div>
      </div>
    );
  }

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

            {/* Gradient Overlays (non-interactive) */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent opacity-80 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none" />

            {/* Content (on top of overlays) */}
            <div className="absolute inset-0 flex flex-col justify-center p-8 pb-24 md:p-12 md:pb-28 md:pl-24 lg:pl-32 z-20">
              <div className="max-w-2xl">
                {/* Logo or Title */}
                {logoMap.has(item.id) ? (
                  <img
                    src={logoMap.get(item.id)}
                    alt={title}
                    draggable={false}
                    className="h-16 md:h-24 lg:h-32 w-auto object-contain mb-4 mt-8 drop-shadow-lg select-none"
                  />
                ) : (
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                    {title}
                  </h1>
                )}

                {/* Rating & Info */}
                <div className="flex items-center gap-3 mb-6">
                  {typeof item.vote_average === 'number' && item.vote_average > 0 && (
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
                      <span className="text-yellow-400">⭐</span>
                      <span className="text-white font-semibold">
                        {item.vote_average.toFixed(1)}/10
                      </span>
                    </div>
                  )}

                  {/* Media type badge placed to the right of the rating */}
                  <div className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded-full border border-white/20">
                    {itemMediaType === 'tv' ? (
                      <>
                        <Tv size={16} className="text-white opacity-90" aria-hidden />
                        <span className="text-xs font-semibold uppercase text-white">TV</span>
                      </>
                    ) : (
                      <>
                        <Film size={16} className="text-white opacity-90" aria-hidden />
                        <span className="text-xs font-semibold uppercase text-white">Movie</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Description */}
                {currentItem?.overview && (
                  <p className="text-white text-sm md:text-base line-clamp-3 mb-6 drop-shadow-lg">
                    {currentItem?.overview}
                  </p>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                  {(() => {
                    const releaseDate = mediaType === 'movie' ? currentItem?.release_date : currentItem?.first_air_date;
                    const isUnreleased = releaseDate ? new Date(releaseDate) > new Date() : false;
                    
                    return (
                      <button
                        onClick={handlePlay}
                        disabled={isUnreleased}
                        onMouseEnter={() => setIsWatchButtonHovered(!isUnreleased)}
                        onMouseLeave={() => setIsWatchButtonHovered(false)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                          isUnreleased
                            ? 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-60'
                            : `hover:scale-105 ${
                                isWatchButtonHovered 
                                  ? 'bg-red-700 text-white' 
                                  : 'bg-white text-black'
                              }`
                        }`}
                      >
                        <Play size={20} fill="currentColor" />
                        <span>{isUnreleased ? 'Coming Soon' : 'Watch Now'}</span>
                      </button>
                    );
                  })()}
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
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-300 backdrop-blur-md"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-300 backdrop-blur-md"
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
