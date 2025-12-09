'use client'
import { getTrendingWeek } from '@/lib/tmdb';
import MediaCard from './MediaCard';
import { useEffect, useRef, useState } from 'react';

const Top20Week =  () => {
  const [trending, setTrending] = useState<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const fetchTrending = async () => {
      const trendingData = await getTrendingWeek();
      setTrending(trendingData?.results?.slice(0, 20) || []);
    }
    fetchTrending();
  }, []);

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

  return (
    <div 
      className="mb-8"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h2 className="text-3xl font-bold mb-4 text-white font-orbitron">TOP 20 THIS WEEK</h2>
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto space-x-4 pb-4 hide-scrollbar"
      >
        {trending.map((media: any) => (
          <div key={media.id} className="min-w-[200px]">
            <MediaCard media={media} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Top20Week;
