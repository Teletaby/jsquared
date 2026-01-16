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
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 font-orbitron uppercase tracking-wider">Please sign in to access your dashboard</h1>
          <Link href="/signin" className="inline-block bg-[#E50914] text-white px-8 py-3 rounded-lg hover:bg-[#FF1A20] transition-colors font-bold">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-white">
        <main className="container mx-auto py-8 px-4 pt-24">
          {/* User Profile Section */}
          <div className="mb-16 flex items-center gap-8 rounded-xl bg-gradient-to-r from-[#E50914]/20 to-[#1A1A1A] p-8 shadow-2xl border border-[#E50914]/30">
            <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border-4 border-[#E50914] shadow-lg shadow-[#E50914]/50">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || 'User'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#E50914] text-4xl font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2 font-orbitron uppercase tracking-wider">{user?.name || 'Welcome'}</h1>
              <p className="text-gray-400 text-lg mb-6">{user?.email}</p>
              {(session?.user as any)?.role === 'admin' && (
                <div className="mt-4 flex gap-4 text-sm flex-wrap">
                  <span className="bg-[#E50914]/20 border border-[#E50914]/50 px-4 py-2 rounded-lg text-[#E50914] font-bold">
                    Watch History: {loadingStats ? 'Loading...' : `${watchHistoryStats.totalItems} items`}
                  </span>
                  <span className="bg-[#E50914]/20 border border-[#E50914]/50 px-4 py-2 rounded-lg text-[#E50914] font-bold">
                    Hours Watched: {loadingStats ? 'Loading...' : `${Math.floor(watchHistoryStats.totalHoursWatched)}h ${Math.round((watchHistoryStats.totalHoursWatched % 1) * 60)}m`}
                  </span>
                  <span className="bg-[#E50914]/20 border border-[#E50914]/50 px-4 py-2 rounded-lg text-[#E50914] font-bold">Watchlist: {watchlist.length} items</span>
                </div>
              )}
            </div>
          </div>

          {/* Continue Watching Section */}
          <section className="mb-16">
            <Suspense fallback={<div className="text-white text-center">Loading watch history...</div>}>
              <UserWatchHistory />
            </Suspense>
          </section>

          {/* Watchlist Section */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-[#E50914] rounded-full"></div>
              <h2 className="text-3xl font-bold text-white font-orbitron uppercase tracking-wider">My Watchlist</h2>
            </div>
            {loadingWatchlist ? (
              <div className="text-center text-gray-400">Loading watchlist...</div>
            ) : watchlist.length === 0 ? (
              <div className="text-center text-gray-400 py-12 border border-gray-700 rounded-xl">
                <p className="mb-4 text-lg">No items in your watchlist yet</p>
                <Link href="/movies" className="inline-block bg-[#E50914] text-white px-6 py-2 rounded-lg hover:bg-[#FF1A20] transition-colors font-bold">
                  Explore Movies
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {watchlist.map((item) => (
                  <div key={item._id} className="relative group overflow-hidden rounded-xl">
                    <Link
                      href={`/${item.mediaType}/${item.mediaId}`}
                      className="block transition-transform duration-300 hover:scale-105 h-full"
                    >
                      <div className="relative aspect-[2/3] bg-gray-800">
                        {item.posterPath && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                            alt={item.title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        )}
                        {/* Dark Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 group-hover:to-black/90 transition-all duration-300" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="truncate text-xs font-bold text-white font-orbitron uppercase tracking-wide line-clamp-2">{item.title}</p>
                        {item.rating && <p className="text-xs text-[#E50914] font-bold mt-1">★ {item.rating.toFixed(1)}</p>}
                      </div>
                    </Link>
                    <button
                      onClick={(e) => handleRemoveFromWatchlist(e, item.mediaId, item.mediaType)}
                      className="absolute top-2 right-2 bg-[#E50914] hover:bg-[#FF1A20] p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
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
