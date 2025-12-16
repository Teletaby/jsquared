'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard';

interface CarouselItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
}

interface CountryCarouselProps {
  items: CarouselItem[];
  title: string;
}

export default function CountryCarousel({ items, title }: CountryCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
  }, [items]);

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
      className="mb-8"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h2 className="text-3xl font-bold mb-4 text-white font-orbitron uppercase">{title}</h2>
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
          className="flex overflow-x-auto space-x-4 pb-4 hide-scrollbar"
          onScroll={checkScrollability}
        >
          {items.map((media: any) => (
            <div key={media.id} className="min-w-[200px]">
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
}
