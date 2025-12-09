/* This is a conceptual client component for a search input and button.
   You would integrate this into your layout or header where you want the search functionality. */
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';

const SearchInput = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (searchTerm.trim()) {
      // Navigate to the search page with the query parameter
      router.push(`/search?query=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center space-x-2">
      <input
        type="text"
        placeholder="Search movies or TV shows..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      <button
        type="submit"
        className="p-2 bg-red-600 rounded-md hover:bg-red-700 transition-colors text-white"
      >
        <SearchIcon size={20} />
      </button>
    </form>
  );
};

export default SearchInput;