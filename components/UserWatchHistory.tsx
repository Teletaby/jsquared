'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, AlertCircle, Trash2, X } from 'lucide-react';
import { getVideoSourceSetting } from '@/lib/utils';

interface WatchHistoryItem {
  _id: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  progress: number;
  currentTime: number;
  totalDuration: number;
  totalPlayedSeconds?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  lastWatchedAt: string;
}

export default function UserWatchHistory() {
  const { data: session } = useSession();
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [videoSource, setVideoSource] = useState<'vidking' | 'vidsrc'>('vidking');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; title: string } | null>(null);
  const scrollContainerRef: any = React.useRef(null);

  // Function to check scrollability
  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
    }
  };

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch watch history
        const historyResponse = await fetch('/api/watch-history?limit=10');
        if (historyResponse.ok) {
          const data = await historyResponse.json();
          console.log('Watch history data from API:', data);
          setWatchHistory(data);
        }

        // Fetch video source setting
        const source = await getVideoSourceSetting();
        setVideoSource(source);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  useEffect(() => {
    // Initial check and re-check when watchHistory changes
    checkScrollability();
    // Re-check on window resize
    window.addEventListener('resize', checkScrollability);
    return () => window.removeEventListener('resize', checkScrollability);
  }, [watchHistory]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 400; // Adjust as needed
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
    // Update scroll position state after scroll, allowing checkScrollability to update arrow visibility
    setTimeout(checkScrollability, 300); // Small delay to allow scroll animation to complete
  };

  const handleDelete = async (historyId: string) => {
    try {
      const response = await fetch(`/api/watch-history/${historyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from UI
        setWatchHistory(watchHistory.filter(item => item._id !== historyId));
        setDeleteConfirmation(null);
      } else {
        alert('Failed to delete history item');
      }
    } catch (error) {
      console.error('Error deleting history:', error);
      alert('Error deleting history item');
    }
  };

  if (loading) {
    return <div className="animate-pulse text-gray-400">Loading your history...</div>;
  }

  if (!session?.user) {
    return null;
  }

  // Group TV shows to only show the latest episode
  const consolidatedHistory = watchHistory.reduce((acc: WatchHistoryItem[], item: WatchHistoryItem) => {
    if (item.mediaType === 'tv') {
      // Check if we already have this TV show in the accumulated list
      const existingIndex = acc.findIndex(
        (h) => h.mediaId === item.mediaId && h.mediaType === 'tv'
      );
      if (existingIndex >= 0) {
        // Since API already sorts by lastWatchedAt descending, first occurrence is newest
        // Skip this item, keep the one already in the list
        return acc;
      } else {
        // Add new TV show (this is the first/most recent episode for this show)
        acc.push(item);
      }
    } else {
      // For movies, just add directly
      acc.push(item);
    }
    return acc;
  }, []);

  if (consolidatedHistory.length === 0) {
    return (
      <div className="my-8 text-center text-gray-400">
        <p className="text-lg">No watch history yet.</p>
        <p className="text-md">Start watching something and it will appear here!</p>
      </div>
    );
  }



  return (
    <div className="my-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="w-1 h-6 bg-accent rounded-full"></span>
          Continue Watching
        </h2>
        {videoSource === 'vidsrc' && (
          <div className="ml-auto flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 px-4 py-2 rounded-lg">
            <AlertCircle size={18} className="text-yellow-400 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-yellow-300 font-semibold">Progress saving will be back soon</span>
              <span className="text-xs text-yellow-200">Primary source is currently not available</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative px-2"> {/* Added px-2 here */}
        {/* Left Arrow - Always show if there are items */}
        {consolidatedHistory.length > 0 && (
          <button
            onClick={() => scroll('left')}
            className={`absolute left-2 inset-y-0 my-auto h-fit z-10 p-3 rounded-full transition-all duration-300 shadow-lg ${
              canScrollLeft
                ? 'bg-gray-800/70 hover:bg-gray-800 text-white cursor-pointer'
                : 'bg-gray-800/30 text-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth hide-scrollbar" // Added hide-scrollbar
          style={{ scrollBehavior: 'smooth' }}
        >
          {consolidatedHistory.map((item) => {
            // Build href - for TV shows, include season and episode; for movies, just use the ID
            const href = item.mediaType === 'tv' && item.seasonNumber !== undefined && item.episodeNumber !== undefined
              ? `/${item.mediaType}/${item.mediaId}?season=${item.seasonNumber}&episode=${item.episodeNumber}`
              : `/${item.mediaType}/${item.mediaId}`;

            return (
            <div
              key={item._id}
              className="flex-shrink-0 group relative overflow-hidden rounded-lg w-[200px] h-[300px] transition-transform duration-300"
            >
              <Link
                href={href}
                className="block hover:scale-105 transition-transform duration-300 h-full"
              >
                <div className="relative w-full bg-gray-900 flex flex-col h-full rounded-lg shadow-lg">
                  <div className="relative w-full h-36 overflow-hidden rounded-t-lg">
                  {item.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w400${item.posterPath}`}
                      alt={item.title}
                      fill
                      className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-gray-500 text-sm text-center px-2">No Image Available</span>
                    </div>
                  )}
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.604 3.69A.375.375 0 019.75 15.25V8.75c0-.29.326-.45.546-.308l5.604 3.69z" />
                    </svg>
                  </div>

                  {/* Progress Label */}
                  {item.progress !== undefined && (
                    <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-semibold">
                      {(() => {
                        const progressValue = item.progress || 0;
                        console.log(`Progress for ${item.title}:`, { progress: progressValue, currentTime: item.currentTime, totalDuration: item.totalDuration });
                        return `${progressValue.toFixed(1)}%`;
                      })()}
                    </div>
                  )}

                  {/* Duration Badge */}
                  <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
                    {Math.floor(item.currentTime / 60)}:{String(Math.floor(item.currentTime % 60)).padStart(2, '0')}
                  </div>
                </div>

                {/* Title and Progress */}
                <div className="p-3">
                  <div className="h-12"> {/* Adjusted height for potentially longer titles */}
                    <p className="text-white text-sm font-semibold line-clamp-2">{item.title}</p>
                  </div>
                  
                  {/* Season and Episode Info for TV Shows */}
                  {item.mediaType === 'tv' && (item.seasonNumber !== undefined || item.episodeNumber !== undefined) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {item.seasonNumber !== undefined && `S${item.seasonNumber}`}
                      {item.seasonNumber !== undefined && item.episodeNumber !== undefined && ' • '}
                      {item.episodeNumber !== undefined && `E${item.episodeNumber}`}
                    </p>
                  )}
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-red-600 transition-all duration-300"
                      style={{ width: `${item.progress || 0}%` }}
                    />
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-2">
                    {Math.floor(item.currentTime / 60)}:{String(Math.floor(item.currentTime % 60)).padStart(2, '0')} / {Math.floor(item.totalDuration / 60)}:{String(Math.floor(item.totalDuration % 60)).padStart(2, '0')}
                  </p>
                </div>
              </div>
              </Link>

            </div>
            );
          })}
        </div>

        {/* Right Arrow - Always show if there are items */}
        {consolidatedHistory.length > 0 && (
          <button
            onClick={() => scroll('right')}
            className={`absolute right-2 inset-y-0 my-auto h-fit z-10 p-3 rounded-full transition-all duration-300 shadow-lg ${
              canScrollRight
                ? 'bg-gray-800/70 hover:bg-gray-800 text-white cursor-pointer'
                : 'bg-gray-800/30 text-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-sm w-full border border-gray-700">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <Trash2 className="text-red-500" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">Delete from History?</h3>
                  <p className="text-sm text-gray-300 mt-2">
                    Are you sure you want to remove <span className="font-semibold">{deleteConfirmation.title}</span> from your watch history?
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmation.id)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

