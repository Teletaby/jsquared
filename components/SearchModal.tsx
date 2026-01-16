"use client";

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { GENRE_MAP } from '@/lib/genreMap';
import { useDisableScroll } from '@/lib/hooks/useDisableScroll';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Suggestion {
  id: number;
  title: string;
  name: string;
  poster_path: string;
  media_type: string;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'SG', name: 'Singapore' },
];

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rating, setRating] = useState(5);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  useDisableScroll(isOpen);

  const handleGenreChange = (genreId: number) => {
    setSelectedGenres(prev => 
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setShowSuggestions(false);
    // Navigate directly to the movie/TV show VIEW INFO page
    const path = suggestion.media_type === 'tv' ? `/tv/${suggestion.id}?view=info` : `/movie/${suggestion.id}?view=info`;
    router.push(path);
    onClose();
  };

  useEffect(() => {
    const fetchSuggestions = async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.results) {
          setSuggestions(data.results.slice(0, 5)); // Limit to 5 suggestions
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSuggestions(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && searchTerm.length >= 2);
  }, [suggestions, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSearch = () => {
    if (!searchTerm.trim() && selectedGenres.length === 0 && !selectedCountry) {
      return;
    }

    // If only country is selected, navigate to country page
    if (selectedCountry && !searchTerm.trim() && selectedGenres.length === 0) {
      router.push(`/browse/country/${selectedCountry.toLowerCase()}`);
      onClose();
      return;
    }

    // If both country and genres are selected, navigate to country page with genre filter
    if (selectedCountry && selectedGenres.length > 0 && !searchTerm.trim()) {
      router.push(`/browse/country/${selectedCountry.toLowerCase()}?genres=${selectedGenres.join(',')}`);
      onClose();
      return;
    }

    const queryParams = new URLSearchParams();
    if (searchTerm.trim()) {
      queryParams.append('query', searchTerm.trim());
    }
    
    if (selectedGenres.length > 0) {
      queryParams.append('with_genres', selectedGenres.join(','));
    }
    
    if (rating > 0 && rating !== 5) {
      queryParams.append('minRating', rating.toString());
    }

    if (selectedCountry) {
      queryParams.append('country', selectedCountry);
    }

    router.push(`/search?${queryParams.toString()}`);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSuggestions([]);
      setShowSuggestions(false);
      setRating(5);
      setSelectedGenres([]);
      setSelectedCountry(null);
    }
  }, [isOpen]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-visible rounded-2xl backdrop-blur-lg bg-white/10 border border-white/20 p-4 sm:p-6 text-left align-middle shadow-xl transition-all flex flex-col">
                <Dialog.Title as="h3" className="text-lg sm:text-2xl font-bold leading-6 text-white flex justify-between items-center flex-shrink-0">
                  Advanced Search
                  <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 transition-colors">
                    <X className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                </Dialog.Title>
                
                <div className="mt-4 sm:mt-6 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search for movies or TV shows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowSuggestions(suggestions.length > 0 && searchTerm.length >= 2)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    className="w-full p-3 pl-10 bg-gray-800 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none pr-12"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  {searchTerm.length > 0 && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded z-10"
                      title="Clear search"
                    >
                      <X size={18} />
                    </button>
                  )}
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    </div>
                  )}
                  {showSuggestions && (
                    <ul
                      ref={suggestionsRef}
                      className="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg"
                    >
                      {suggestions.map((suggestion) => (
                        <li
                          key={`${suggestion.media_type}-${suggestion.id}`}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center p-3 hover:bg-gray-700 cursor-pointer"
                        >
                          <img
                            src={`https://image.tmdb.org/t/p/w92${suggestion.poster_path}`}
                            alt={suggestion.title || suggestion.name}
                            className="w-10 h-14 object-cover rounded mr-3"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div>
                            <div className="text-white text-sm font-medium">
                              {suggestion.title || suggestion.name}
                            </div>
                            <div className="text-gray-400 text-xs capitalize">
                              {suggestion.media_type}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-6">
                  {/* Genre Filter */}
                  <div>
                    <label className="text-lg font-medium text-gray-300">Genres</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(GENRE_MAP).map(([genreName, genreId]) => (
                        <button
                          key={genreId}
                          onClick={() => handleGenreChange(Number(genreId))}
                          className={`p-2 rounded-md transition-colors text-sm
                            ${selectedGenres.includes(Number(genreId)) ? 'bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                          {genreName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Country Filter */}
                <div className="mt-6 pb-4">
                  <label className="text-lg font-medium text-gray-300 block mb-3">Browse by Country</label>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        onClick={() => setSelectedCountry(selectedCountry === country.code ? null : country.code)}
                        className={`px-4 py-2 rounded-md transition-colors text-sm font-medium
                          ${selectedCountry === country.code ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                      >
                        {country.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 text-right flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-500 px-6 py-2 text-base font-medium text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSearch}
                    disabled={!searchTerm.trim() && selectedGenres.length === 0 && !selectedCountry}
                  >
                    {selectedCountry ? `Explore ${COUNTRIES.find(c => c.code === selectedCountry)?.name}` : 'Search'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SearchModal;