"use client";

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
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
  known_for_department?: string;
}

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mediaType, setMediaType] = useState<'media' | 'person'>('media');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  useDisableScroll(isOpen);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setShowSuggestions(false);
    
    if (suggestion.media_type === 'person') {
      // For person/artist, go to search results with person type
      router.push(`/search?query=${encodeURIComponent(suggestion.name)}&type=person`);
    } else {
      // Navigate directly to the movie/TV show VIEW INFO page
      const path = suggestion.media_type === 'tv' ? `/tv/${suggestion.id}?view=info` : `/movie/${suggestion.id}?view=info`;
      router.push(path);
    }
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
        const url = mediaType === 'person' 
          ? `/api/search?query=${encodeURIComponent(query)}&type=person`
          : `/api/search?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);
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
  }, [searchTerm, mediaType]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && searchTerm.length >= 2);
  }, [suggestions, searchTerm]);

  useEffect(() => {
    // Clear suggestions when media type changes
    setSuggestions([]);
    setShowSuggestions(false);
  }, [mediaType]);

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
    if (!searchTerm.trim()) {
      return;
    }

    const queryParams = new URLSearchParams();
    queryParams.append('query', searchTerm.trim());
    
    if (mediaType === 'person') {
      queryParams.append('type', 'person');
    }

    router.push(`/search?${queryParams.toString()}`);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSuggestions([]);
      setShowSuggestions(false);
      setMediaType('media');
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
                    placeholder={mediaType === 'person' ? 'Search for an actor or artist...' : 'Search for movies or TV shows...'}
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
                              {suggestion.media_type === 'person' 
                                ? (suggestion.known_for_department || 'Actor')
                                : suggestion.media_type}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Media Type Selection */}
                <div className="mt-6">
                  <label className="text-lg font-medium text-gray-300 block mb-3">What are you looking for?</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setMediaType('media')}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        mediaType === 'media'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Movies & TV Shows
                    </button>
                    <button
                      onClick={() => setMediaType('person')}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                        mediaType === 'person'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Artists / Cast Members
                    </button>
                  </div>
                </div>

                <div className="mt-8 text-right flex-shrink-0">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-500 px-6 py-2 text-base font-medium text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSearch}
                    disabled={!searchTerm.trim()}
                  >
                    Search
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