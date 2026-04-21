'use client';

import { useState, useEffect } from 'react';
import MediaFetcherList from './MediaFetcherList';
import { GENRE_MAP } from '@/lib/genreMap';

interface GenreCarouselProps {
  mediaType: 'movie' | 'tv';
  excludeGenres?: string[];
}

const AVAILABLE_GENRES = [
  'all',
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'romance',
  'science fiction',
  'thriller',
  'war',
  'western',
];

export default function GenreCarousel({ mediaType, excludeGenres = [] }: GenreCarouselProps) {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const genres = AVAILABLE_GENRES.filter(g => !excludeGenres.includes(g));

  const handleGenreSelect = async (genre: string) => {
    setSelectedGenre(genre);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (genre !== 'all') {
        params.append('with_genres', GENRE_MAP[genre]);
      }

      const response = await fetch(
        `/api/discover?mediaType=${mediaType}&${params.toString()}`
      );
      const data = await response.json();
      setItems(data.results || []);
    } catch (error) {
      console.error('Failed to fetch genre content:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    handleGenreSelect('all');
  }, [mediaType]);

  const displayTitle = selectedGenre.charAt(0).toUpperCase() + selectedGenre.slice(1);

  return (
    <div className="my-8 sm:my-12">
      {/* Genre Tabs */}
      <div className="px-4 mb-8">
        <div className="inline-flex flex-wrap gap-2 sm:gap-1 bg-gradient-to-r from-gray-900/40 via-gray-800/40 to-gray-900/40 rounded-xl px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-sm border border-gray-700/30 shadow-lg">
          {genres.map((genre, index) => (
            <button
              key={genre}
              onClick={() => handleGenreSelect(genre)}
              className={`relative px-3 sm:px-4 py-2 font-semibold text-xs sm:text-sm transition-all duration-300 rounded-lg ${
                selectedGenre === genre
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {/* Background glow for selected */}
              {selectedGenre === genre && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-cyan-500/30 to-blue-600/30 rounded-lg blur-md opacity-60 -z-10"></div>
              )}
              
              {/* Solid background for selected */}
              {selectedGenre === genre && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-blue-600/20 rounded-lg -z-10"></div>
              )}
              
              <span className="relative">
                {genre.charAt(0).toUpperCase() + genre.slice(1)}
              </span>
              
              {/* Bottom accent line */}
              <div
                className={`absolute bottom-1 left-2 right-2 h-1 transition-all duration-300 rounded-full ${
                  selectedGenre === genre
                    ? 'bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 opacity-100'
                    : 'bg-transparent opacity-0'
                }`}
              ></div>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="my-8 animate-pulse">
          <div className="h-8 w-1/4 bg-gray-800 rounded mb-4 mx-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 px-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      ) : (
        <MediaFetcherList title={`${displayTitle} ${mediaType === 'movie' ? 'Movies' : 'Shows'}`} items={items.slice(0, 12)} />
      )}
    </div>
  );
}
