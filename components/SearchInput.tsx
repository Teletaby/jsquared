/* This is a conceptual client component for a search input and button.
   You would integrate this into your layout or header where you want the search functionality. */
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, X as XIcon } from 'lucide-react';

interface Suggestion {
  id: number;
  title: string;
  name: string;
  poster_path: string;
  media_type: string;
}

const SearchInput = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (searchTerm.trim()) {
      // Navigate to the search page with the query parameter
      router.push(`/search?query=${encodeURIComponent(searchTerm.trim())}`);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    const title = suggestion.title || suggestion.name;
    setSearchTerm(title);
    setShowSuggestions(false);
    router.push(`/search?query=${encodeURIComponent(title)}`);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
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
    setShowSuggestions(suggestions.length > 0 && searchTerm.length >= 2 && isLoading === false);
  }, [suggestions, searchTerm, isLoading]);

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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search movies or TV shows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => suggestions.length > 0 && searchTerm.length >= 2 && setShowSuggestions(true)}
            className="w-full p-2 pr-10 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {isLoading && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}
          {searchTerm && !isLoading && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white hover:bg-gray-200 text-gray-800 rounded-full p-1 z-10 cursor-pointer transition-colors"
              aria-label="Clear search"
            >
              <XIcon size={20} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="p-2 bg-accent rounded-md hover:bg-accent-darker transition-colors text-white"
        >
          <SearchIcon size={20} />
        </button>
      </form>
      {showSuggestions && (
        <ul
          ref={suggestionsRef}
          className="absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg"
        >
          {suggestions.map((suggestion) => (
            <li
              key={`${suggestion.media_type}-${suggestion.id}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className="flex items-center p-2 hover:bg-gray-600 cursor-pointer"
            >
              <img
                src={`https://image.tmdb.org/t/p/w92${suggestion.poster_path}`}
                alt={suggestion.title || suggestion.name}
                className="w-8 h-12 object-cover rounded mr-3"
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
  );
};

export default SearchInput;