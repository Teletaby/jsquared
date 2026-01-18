'use client'
import { getTrendingWeek } from '@/lib/tmdb';
import MediaCard from './MediaCard';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Top20Week =  () => {
  const [trending, setTrending] = useState<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      const trendingData = await getTrendingWeek();
      setTrending(trendingData?.results?.slice(0, 20) || []);
    }
    fetchTrending();
  }, []);

  // Check scrollability
  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
    }
  };

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  }, [trending]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    let scrollInterval: any;

    if (scrollContainer && !isHovering) {
      scrollInterval = setInterval(() => {
        if (scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth) {
          scrollContainer.scrollLeft += 1;
        } else {
          scrollContainer.scrollLeft = 0;
        }
      }, 50);
    }

    return () => clearInterval(scrollInterval);
  }, [isHovering]);

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

  return (
    <div 
      className="mb-8 sm:mb-12 px-4"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-white font-orbitron whitespace-nowrap sm:whitespace-normal overflow-hidden text-ellipsis">TOP 20 THIS WEEK</h2>
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 inset-y-0 my-auto h-fit z-10 bg-gray-800/70 hover:bg-gray-800 text-white p-3 rounded-full transition-all duration-300 shadow-lg"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto space-x-2 sm:space-x-4 pb-4 hide-scrollbar"
          onScroll={checkScrollability}
        >
          {trending.map((media: any) => (
            <div key={media.id} className="min-w-[160px] sm:min-w-[200px]">
              <MediaCard media={media} />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 inset-y-0 my-auto h-fit z-10 bg-gray-800/70 hover:bg-gray-800 text-white p-3 rounded-full transition-all duration-300 shadow-lg"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Top20Week;
