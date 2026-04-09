"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SearchFilters = () => {
  const [mediaType, setMediaType] = useState<'media' | 'person'>('media');
  const [artistQuery, setArtistQuery] = useState('');
  const router = useRouter();

  const handleSearch = () => {
    if (!artistQuery.trim()) return;
    
    const query = new URLSearchParams();
    query.append('query', artistQuery);
    if (mediaType === 'person') {
      query.append('type', 'person');
    }
    
    router.push(`/search?${query.toString()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="backdrop-blur-2xl bg-white/20 border border-white/20 p-6 rounded-lg shadow-lg my-8">
      <h2 className="text-2xl mb-6">Advanced Search</h2>
      
      {/* Media Type Selection */}
      <div className="mb-6">
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

      {/* Search Input */}
      <div className="mb-6">
        <h3 className="text-xl mb-2">
          {mediaType === 'person' ? 'Search by Artist / Actor' : 'Search by Title'}
        </h3>
        <p className="text-gray-400 mb-3 text-sm">
          {mediaType === 'person' 
            ? 'Find all shows and movies featuring an actor, director, or crew member'
            : 'Find movies and TV shows by title'}
        </p>
        <input 
          type="text" 
          placeholder={mediaType === 'person' ? 'Enter actor or artist name...' : 'Enter title...'}
          value={artistQuery}
          onChange={(e) => setArtistQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="bg-background p-3 rounded w-full text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      
      {/* Search Button */}
      <div className="text-center">
        <button 
          onClick={handleSearch}
          disabled={!artistQuery.trim()}
          className={`${
            artistQuery.trim() 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/50' 
              : 'bg-gray-500 cursor-not-allowed text-gray-300'
          } font-bold py-2 px-8 rounded-full transition-all duration-200`}
        >
          Search
        </button>
      </div>
    </div>
  );
};

export default SearchFilters;
