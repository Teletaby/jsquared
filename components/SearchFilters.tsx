"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { phobiaKeywords } from '@/lib/tmdb';

const SearchFilters = () => {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [selectedPhobias, setSelectedPhobias] = useState<string[]>([]);
  const router = useRouter();

  const handleSearch = () => {
    const totalMinutes = parseInt(hours || '0') * 60 + parseInt(minutes || '0');
    const phobiaKeywordIds = selectedPhobias.map(phobia => phobiaKeywords[phobia]).join(',');

    const query = new URLSearchParams();
    if (totalMinutes > 0) {
      query.append('runtimeLte', totalMinutes.toString());
    }
    if (phobiaKeywordIds) {
      query.append('withoutKeywords', phobiaKeywordIds);
    }
    
    router.push(`/search?${query.toString()}`);
  };

  const handlePhobiaChange = (phobia: string) => {
    setSelectedPhobias(prev => 
      prev.includes(phobia) ? prev.filter(p => p !== phobia) : [...prev, phobia]
    );
  };

  return (
    <div className="backdrop-blur-2xl bg-white/20 border border-white/20 p-6 rounded-lg shadow-lg my-8">
      <h2 className="text-2xl mb-4">Find Your Perfect Movie</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time to Kill */}
        <div>
          <h3 className="text-xl mb-2">Time to Kill</h3>
          <p className="text-gray-400 mb-2 text-sm">Have a specific amount of time? Find a movie that fits.</p>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Hours" 
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="bg-background p-2 rounded w-24"
            />
            <span className="text-xl">:</span>
            <input 
              type="number" 
              placeholder="Mins" 
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="bg-background p-2 rounded w-24"
            />
          </div>
        </div>
        
        {/* Phobia Filter */}
        <div>
          <h3 className="text-xl mb-2">Trigger / Phobia Filter</h3>
          <p className="text-gray-400 mb-2 text-sm">Exclude content you don&apos;t want to see.</p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(phobiaKeywords).map(phobia => (
              <button
                key={phobia}
                onClick={() => handlePhobiaChange(phobia)}
                className={`p-2 rounded ${selectedPhobias.includes(phobia) ? 'bg-accent' : 'bg-background'}`}
              >
                {phobia.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Search Button */}
      <div className="mt-6 text-center">
        <button 
          onClick={handleSearch}
          className="bg-accent text-white font-bold py-2 px-8 rounded-full hover:bg-accent-darker transition-colors duration-300"
        >
          Search
        </button>
      </div>
    </div>
  );
};

export default SearchFilters;
