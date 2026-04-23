'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GENRE_MAP } from '@/lib/genreMap';
import TrailerPopup from './TrailerPopup';

interface GenreCarouselProps {
  mediaType: 'movie' | 'tv';
  excludeGenres?: string[];
}

const SORT_OPTIONS = [
  { label: 'Most popular', value: 'popularity.desc' },
];

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
  'tv movie',
  'thriller',
  'war',
  'western',
];

interface TrailerState {
  [key: number]: {
    trailerKey: string | null;
    checked: boolean;
    hasTrailer: boolean;
  };
}

export default function GenreCarousel({ mediaType, excludeGenres = [] }: GenreCarouselProps) {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedSort, setSelectedSort] = useState('popularity.desc');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trailerStates, setTrailerStates] = useState<TrailerState>({});
  const [showTrailer, setShowTrailer] = useState(false);
  const [currentTrailerKey, setCurrentTrailerKey] = useState<string | null>(null);

  const genres = AVAILABLE_GENRES.filter(g => !excludeGenres.includes(g));

  const fetchDiscoverItems = async (genre: string, sortBy: string) => {
    setSelectedGenre(genre);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('sort_by', sortBy);
      if (genre !== 'all') {
        params.append('with_genres', GENRE_MAP[genre]);
      }

      const response = await fetch(
        `/api/discover?mediaType=${mediaType}&${params.toString()}`
      );
      const data = await response.json();
      const items = data.results || [];
      
      // Fetch full details for runtime/seasons
      const itemsWithDetails = await Promise.all(
        items.slice(0, 50).map(async (item: any) => {
          try {
            const detailResponse = await fetch(
              `/api/details?mediaType=${mediaType}&id=${item.id}`
            );
            const details = await detailResponse.json();
            return { ...item, ...details };
          } catch (error) {
            console.error(`Error fetching details for ${item.id}:`, error);
            return item;
          }
        })
      );
      
      setItems(itemsWithDetails);
    } catch (error) {
      console.error('Failed to fetch genre content:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = async (genre: string) => {
    await fetchDiscoverItems(genre, selectedSort);
  };

  const handleSortSelect = async (sortBy: string) => {
    setSelectedSort(sortBy);
    await fetchDiscoverItems(selectedGenre, sortBy);
  };

  const fetchTrailer = async (itemId: number) => {
    // If we already have this trailer's state, use it
    if (trailerStates[itemId]) {
      if (trailerStates[itemId].hasTrailer) {
        return trailerStates[itemId].trailerKey;
      }
      return null;
    }

    try {
      const response = await fetch(`/api/trailer/${itemId}?mediaType=${mediaType}`);
      const data = await response.json();
      
      const hasTrailer = !!data.trailerKey;
      setTrailerStates(prev => ({
        ...prev,
        [itemId]: {
          trailerKey: data.trailerKey || null,
          checked: true,
          hasTrailer
        }
      }));
      
      return data.trailerKey || null;
    } catch (error) {
      console.error('Error fetching trailer:', error);
      setTrailerStates(prev => ({
        ...prev,
        [itemId]: {
          trailerKey: null,
          checked: true,
          hasTrailer: false
        }
      }));
      return null;
    }
  };

  const handleTrailerClick = async (e: React.MouseEvent, itemId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const trailerKey = await fetchTrailer(itemId);
    if (trailerKey) {
      setCurrentTrailerKey(trailerKey);
      setShowTrailer(true);
    }
  };

  const formatRuntime = (minutes: number): string => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}hr`;
    return `${hours}hr ${mins}m`;
  };

  // Load initial data
  useEffect(() => {
    fetchDiscoverItems('all', 'popularity.desc');
  }, [mediaType]);

  const displayTitle = selectedGenre.charAt(0).toUpperCase() + selectedGenre.slice(1);
  const selectedSortLabel = SORT_OPTIONS.find(sort => sort.value === selectedSort)?.label || 'Most popular';

  // Filter out unreleased items and slice to 50 items
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const displayItems = items
    .filter(item => {
      const releaseDate = new Date(item.release_date || item.first_air_date);
      releaseDate.setHours(0, 0, 0, 0);
      return releaseDate <= today;
    })
    .slice(0, 50);

  return (
    <div className="my-8 sm:my-12">
      {/* Selection Tabs */}
      <div className="px-4 mb-6">
        <div className="w-full rounded-2xl border border-gray-800 bg-gradient-to-b from-[#071325] via-[#050b17] to-[#02060f] shadow-[0_18px_60px_-35px_rgba(59,130,246,0.9)] overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide border-b border-gray-800/90">
            <div className="flex min-w-max px-3 sm:px-4">
              {SORT_OPTIONS.map(sort => (
                <button
                  key={sort.value}
                  onClick={() => handleSortSelect(sort.value)}
                  className={`relative px-4 sm:px-5 py-4 text-xs sm:text-sm font-semibold transition-colors duration-200 whitespace-nowrap ${
                    selectedSort === sort.value
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {sort.label}
                  <span
                    className={`absolute left-2 right-2 bottom-0 h-0.5 rounded-full transition-all duration-200 ${
                      selectedSort === sort.value
                        ? 'bg-red-500 opacity-100'
                        : 'bg-red-500 opacity-0'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreSelect(genre)}
                  className={`relative px-3.5 py-2 text-xs sm:text-sm font-medium rounded-full border transition-all duration-200 whitespace-nowrap ${
                    selectedGenre === genre
                      ? 'text-white border-cyan-400/60 bg-cyan-500/15'
                      : 'text-gray-300 border-gray-700 bg-gray-900/50 hover:border-gray-500'
                  }`}
                >
                  {genre.charAt(0).toUpperCase() + genre.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* File Explorer List Content */}
      <div className="px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
          {`${selectedSortLabel} · ${displayTitle} ${mediaType === 'movie' ? 'Movies' : 'Shows'}`}
        </h2>
        
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : displayItems.length > 0 ? (
          <div className="border border-gray-800 rounded-lg bg-gradient-to-b from-gray-900/50 to-gray-950/50 overflow-hidden">
            {displayItems.map((item, index) => (
              <div
                key={item.id}
                className="group flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border-b border-gray-800 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 transition-all duration-200 last:border-b-0"
              >
                {/* Thumbnail */}
                <Link
                  href={`/${mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}?view=info`}
                  className="flex-shrink-0 w-full sm:w-20 sm:h-32 relative rounded overflow-hidden"
                >
                  {item.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
                      alt={item.title || item.name}
                      width={80}
                      height={120}
                      className="w-full h-auto sm:w-20 sm:h-32 object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex-shrink-0 w-full sm:w-20 sm:h-32 bg-gray-800 rounded"></div>
                  )}
                </Link>

                {/* Content */}
                <div className="flex-grow w-full sm:w-auto min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/${mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}?view=info`}
                      className="text-sm sm:text-base font-semibold text-white group-hover:text-cyan-400 transition-colors hover:underline truncate"
                    >
                      {item.title || item.name}
                    </Link>
                    {(item.release_date || item.first_air_date) && (
                      <span className="text-xs sm:text-sm text-gray-400">
                        {new Date(item.release_date || item.first_air_date).getFullYear()}
                      </span>
                    )}
                    {mediaType === 'movie' && item.runtime && (
                      <span className="text-xs sm:text-sm text-gray-400">
                        {formatRuntime(item.runtime)}
                      </span>
                    )}
                    {mediaType === 'tv' && item.number_of_seasons && (
                      <span className="text-xs sm:text-sm text-gray-400">
                        {item.number_of_seasons} {item.number_of_seasons === 1 ? 'Season' : 'Seasons'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 mt-2 whitespace-normal">
                    {item.overview || 'No description available'}
                  </p>
                </div>

                {/* Actions & Rating */}
                <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  {trailerStates[item.id]?.checked && !trailerStates[item.id]?.hasTrailer ? (
                    <button
                      disabled
                      className="px-3 py-2 text-xs sm:text-sm font-semibold bg-gray-600/50 text-gray-400 rounded-lg cursor-not-allowed whitespace-nowrap"
                    >
                      No Trailer
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleTrailerClick(e, item.id)}
                      className="px-3 py-2 text-xs sm:text-sm font-semibold bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 whitespace-nowrap"
                    >
                      View Trailer
                    </button>
                  )}
                  {item.vote_average && (
                    <div className="flex-shrink-0 text-right bg-gray-800/50 px-2 py-1 sm:px-3 sm:py-2 rounded-lg">
                      <span className="text-xs sm:text-sm font-semibold text-cyan-400">
                        {item.vote_average.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">/10</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>No items found for this selection.</p>
          </div>
        )}
      </div>

      {/* Trailer Popup */}
      {showTrailer && currentTrailerKey && (
        <TrailerPopup 
          trailerKey={currentTrailerKey} 
          onClose={() => {
            setShowTrailer(false);
            setCurrentTrailerKey(null);
          }} 
        />
      )}
    </div>
  );
}
