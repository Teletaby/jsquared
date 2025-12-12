'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import UserWatchHistory from '@/components/UserWatchHistory';
import Header from '@/components/Header';

interface UserProfile {
  name?: string;
  email?: string;
  image?: string;
}

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
  lastWatchedAt: string;
}

interface WatchlistItem {
  _id: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  rating?: number;
  addedAt: string;
}

interface WatchHistoryStats {
  totalItems: number;
  totalHoursWatched: number;
}

const DashboardPage = () => {
  const { data: session } = useSession();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [watchHistoryStats, setWatchHistoryStats] = useState<WatchHistoryStats>({ totalItems: 0, totalHoursWatched: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const user = session?.user as UserProfile | undefined;

  useEffect(() => {
    if (!session?.user) return;

    const fetchWatchlist = async () => {
      try {
        const response = await fetch('/api/watchlist');
        if (response.ok) {
          const data = await response.json();
          setWatchlist(data);
        }
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      } finally {
        setLoadingWatchlist(false);
      }
    };

    fetchWatchlist();
  }, [session]);

  const handleRemoveFromWatchlist = async (e: React.MouseEvent, mediaId: number, mediaType: 'movie' | 'tv') => {
    e.preventDefault(); // Prevent navigating to the media detail page
    e.stopPropagation(); // Stop event propagation

    try {
      const response = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaId, mediaType }),
      });

      if (response.ok) {
        setWatchlist((prevWatchlist) =>
          prevWatchlist.filter((item) => !(item.mediaId === mediaId && item.mediaType === mediaType))
        );
        console.log('Item removed from watchlist successfully');
      } else {
        console.error('Failed to remove item from watchlist:', response.statusText);
      }
    } catch (error) {
      console.error('Error removing item from watchlist:', error);
    }
  };

  useEffect(() => {
    if (!session?.user) return;

    const fetchWatchHistoryStats = async () => {
      try {
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data: WatchHistoryItem[] = await response.json();
          const totalItems = data.length;
          const totalSeconds = data.reduce((sum, item) => sum + (item.totalPlayedSeconds || 0), 0);
          const totalHours = Math.floor(totalSeconds / 3600);
          const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
          const totalHoursWatched = totalHours + (totalMinutes / 60);
          
          setWatchHistoryStats({
            totalItems,
            totalHoursWatched: totalHoursWatched,
          });
        }
      } catch (error) {
        console.error('Error fetching watch history stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchWatchHistoryStats();
  }, [session]);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Please sign in to access your dashboard</h1>
          <Link href="/signin" className="inline-block bg-accent text-white px-8 py-3 rounded-lg hover:opacity-90">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white pt-20">
        <main className="container mx-auto py-8 px-4">
          {/* User Profile Section */}
          <div className="mb-12 flex items-center gap-6 rounded-lg bg-gradient-to-r from-accent/20 to-accent/10 p-8 shadow-lg">
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border-4 border-accent">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || 'User'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-accent/30 text-3xl font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">{user?.name || 'Welcome'}</h1>
              <p className="text-gray-300 text-lg">{user?.email}</p>
              <div className="mt-4 flex gap-4 text-sm flex-wrap">
                <span className="bg-accent/30 px-4 py-2 rounded-full">
                  Watch History: {loadingStats ? 'Loading...' : `${watchHistoryStats.totalItems} items`}
                </span>
                <span className="bg-accent/30 px-4 py-2 rounded-full">
                  Hours Watched: {loadingStats ? 'Loading...' : `${Math.floor(watchHistoryStats.totalHoursWatched)}h ${Math.round((watchHistoryStats.totalHoursWatched % 1) * 60)}m`}
                </span>
                <span className="bg-accent/30 px-4 py-2 rounded-full">Watchlist: {watchlist.length} items</span>
              </div>
            </div>
          </div>

          {/* Continue Watching Section */}
          <section className="mb-12">
            <Suspense fallback={<div className="text-white text-center">Loading watch history...</div>}>
              <UserWatchHistory />
            </Suspense>
          </section>

          {/* Watchlist Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-white">My Watchlist</h2>
            {loadingWatchlist ? (
              <div className="text-center text-gray-400">Loading watchlist...</div>
            ) : watchlist.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p className="mb-4">No items in your watchlist yet</p>
                <Link href="/movies" className="inline-block bg-accent text-white px-6 py-2 rounded-lg hover:opacity-90">
                  Explore Movies
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {watchlist.map((item) => (
                  <div key={item._id} className="relative group overflow-hidden rounded-lg">
                    <Link
                      href={`/${item.mediaType}/${item.mediaId}`}
                      className="block transition-transform duration-200 hover:scale-105"
                    >
                      <div className="relative aspect-[2/3] bg-gray-800">
                        {item.posterPath && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                            alt={item.title}
                            fill
                            className="object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black opacity-0 transition-opacity group-hover:opacity-40" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                        {item.rating && <p className="text-xs text-yellow-400">⭐ {item.rating.toFixed(1)}</p>}
                      </div>
                    </Link>
                    <button
                      onClick={(e) => handleRemoveFromWatchlist(e, item.mediaId, item.mediaType)}
                      className="absolute top-2 right-2 bg-red-600 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                      aria-label="Remove from watchlist"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
};

export default DashboardPage;
