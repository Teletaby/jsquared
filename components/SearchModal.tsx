"use client";

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { GENRE_MAP } from '@/lib/genreMap';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [rating, setRating] = useState(5);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  const handleGenreChange = (genreId: number) => {
    setSelectedGenres(prev => 
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSearch = () => {
    if (!searchTerm.trim() && selectedGenres.length === 0) {
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

    router.push(`/search?${queryParams.toString()}`);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setRating(5);
      setSelectedGenres([]);
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

        <div className="fixed inset-0 overflow-y-auto">
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl backdrop-blur-lg bg-white/10 border border-white/20 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-xl sm:text-2xl font-bold leading-6 text-white flex justify-between items-center">
                  Advanced Search
                  <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-800 transition-colors">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>
                
                <div className="mt-6 relative">
                  <input
                    type="text"
                    placeholder="Search for movies or TV shows..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    className="w-full p-3 pl-10 bg-gray-800 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none pr-3"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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

                  {/* Rating Filter */}
                  <div>
                    <label htmlFor="rating-slider" className="text-base sm:text-lg font-medium text-gray-300">Min. Rating: <span className="font-bold text-blue-500">{rating.toFixed(1)}</span></label>
                    <input
                      id="rating-slider"
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={rating}
                      onChange={(e) => setRating(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-3 accent-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-8 text-right">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-500 px-6 py-2 text-base font-medium text-white hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
                    onClick={handleSearch}
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