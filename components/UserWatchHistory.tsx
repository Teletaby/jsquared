'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { getVideoSourceSetting, sourceNameToId, getExplicitSourceForMedia, setExplicitSourceForMedia } from '@/lib/utils';

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
  // Optional: the video source used when this history entry was recorded
  source?: 'videasy' | 'vidlink' | 'vidnest' | string;
}

export default function UserWatchHistory() {
  const { data: session, status } = useSession();
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [videoSource, setVideoSource] = useState<'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | null>(null);
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
    // Wait for session to load (status is 'loading' initially, then 'authenticated' or 'unauthenticated')
    if (status === 'loading') {
      console.log('📺 [Watch History] Session loading...');
      setLoading(true);
      return;
    }

    if (!session?.user) {
      console.log('📺 [Watch History] No session, clearing data');
      setWatchHistory([]);
      setLoading(false);
      return;
    }

    console.log('📺 [Watch History] Session loaded for:', session.user.email);
    setLoading(true);

    const fetchData = async () => {
      try {
        // Prefer per-user saved source if available; fetch this first so resume links can include it
        try {
          const res = await fetch('/api/user/source');
          if (res.ok) {
            const data = await res.json();
            if (data?.source) {
              setVideoSource(data.source);
            } else {
              // If user has no preference, fall back to app default
              const source = await getVideoSourceSetting();
              setVideoSource(source);
            }
          } else {
            const source = await getVideoSourceSetting();
            setVideoSource(source);
          }
        } catch (e) {
          console.warn('[Watch History] Error fetching user source:', e);
          const source = await getVideoSourceSetting();
          setVideoSource(source);
        }

        // Fetch watch history after we have the user's source to avoid race conditions when building resume links
        const historyResponse = await fetch('/api/watch-history?limit=20');
        if (historyResponse.ok) {
          const data = await historyResponse.json();
          console.log('📺 [Watch History] Initial load (limit=20):', data.length, 'items');
          setWatchHistory(data);
        } else {
          console.log('📺 [Watch History] API returned status:', historyResponse.status);
          setWatchHistory([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setWatchHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [status, session?.user?.email]); // Added status to wait for session loading

  useEffect(() => {
    // Initial check and re-check when watchHistory changes
    checkScrollability();
    // Re-check on window resize
    window.addEventListener('resize', checkScrollability);

    // Listen for playtime updates so we can move the corresponding item to the top immediately
    const handleUpdate = (e: any) => {
      const d = e?.detail;
      if (!d || !d.mediaId) return;
      setWatchHistory((prev) => {
        // Remove any existing entry for the same media+episode
        const filtered = prev.filter((item) => {
          if (item.mediaId !== d.mediaId || item.mediaType !== d.mediaType) return true;
          // For TV, require matching season/episode to consider the same entry
          if (d.mediaType === 'tv') {
            return !(item.seasonNumber === d.seasonNumber && item.episodeNumber === d.episodeNumber);
          }
          return false;
        });

        // Build a new entry (best-effort) and put it at the front
        const newItem: any = {
          _id: `local-${d.mediaId}-${d.mediaType}-${Date.now()}`,
          mediaId: d.mediaId,
          mediaType: d.mediaType,
          title: d.title || '(Untitled)',
          posterPath: d.posterPath || '',
          progress: d.progress ?? 0,
          currentTime: d.currentTime ?? 0,
          totalDuration: d.totalDuration ?? 0,
          seasonNumber: d.seasonNumber,
          episodeNumber: d.episodeNumber,
          lastWatchedAt: d.lastWatchedAt || new Date().toISOString(),
          source: d.source || undefined,
        };

        return [newItem, ...filtered];
      });
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'lastPlayed' || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        window.dispatchEvent(new CustomEvent('watchtime:update', { detail: parsed }));
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('watchtime:update', handleUpdate as any);
    window.addEventListener('storage', handleStorage as any);

    return () => {
      window.removeEventListener('resize', checkScrollability);
      window.removeEventListener('watchtime:update', handleUpdate as any);
      window.removeEventListener('storage', handleStorage as any);
    };
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

  // Refetch watch history periodically to catch updates during playback
  useEffect(() => {
    if (status === 'loading' || !session?.user) {
      console.log('📺 [Watch History] Polling disabled - session not ready');
      return;
    }

    let isMounted = true;
    let refreshTimeout: NodeJS.Timeout;
    let lastDataLength = watchHistory.length;

    const refreshWatchHistory = async () => {
      try {
        const response = await fetch('/api/watch-history?limit=20');
        if (response.ok && isMounted) {
          const data = await response.json();
          
          // Log if data changed
          if (data.length !== lastDataLength) {
            console.log(`📺 [Watch History] Refresh: ${lastDataLength} → ${data.length} items`);
            lastDataLength = data.length;
          }
          
          setWatchHistory(data);
        }
      } catch (error) {
        console.error('[Watch History] Refresh error:', error);
        // Silent error - keep existing data
      }
      
      if (isMounted) {
        // Refresh every 1 second for progress bar updates
        // API saves happen every 3 seconds, so 1 second polling provides smooth display without excessive API calls
        refreshTimeout = setTimeout(refreshWatchHistory, 1000);
      }
    };

    // Start the refresh cycle immediately
    refreshTimeout = setTimeout(refreshWatchHistory, 500);

    return () => {
      isMounted = false;
      clearTimeout(refreshTimeout);
    };
  }, [status, session?.user?.email, watchHistory.length]);

  // Show nothing while session is loading
  if (status === 'loading') {
    return null;
  }

  if (!session?.user) {
    return null;
  }

  // Show loading message only after we know there's a user
  if (loading) {
    return <div className="animate-pulse text-gray-400 my-8">Loading your history...</div>;
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
            const base = `/${item.mediaType}/${item.mediaId}`;
            const params: string[] = [];
            if (item.mediaType === 'tv' && item.seasonNumber !== undefined && item.episodeNumber !== undefined) {
              params.push(`season=${item.seasonNumber}`, `episode=${item.episodeNumber}`);
            }
            // We no longer include `source` or `time` in the URL for privacy.
            // Instead we persist the preferred source via a background POST when the user clicks the link
            // and rely on server-side watch-history for the resume timestamp.
            const allowedSources = ['videasy', 'vidlink', 'vidnest'];
            // Prefer the user's server-stored preference (`videoSource`) over a history item's recorded source.
            // History items may have older sources; user preference should take precedence for resume behavior.
            const resumeSourceName = (videoSource && allowedSources.includes(String(videoSource))) ? String(videoSource) : (item.source && allowedSources.includes(item.source) ? item.source : undefined);
            const href = `${base}${params.length > 0 ? '?' + params.join('&') : ''}`;

            // Debug: log the resolved resume source when links are built (helps diagnose source overrides)
            const sourceId = resumeSourceName ? sourceNameToId(resumeSourceName) : undefined;
            const displaySourceName = sourceId ? `Source ${sourceId}` : 'unknown';
            console.log('[UserWatchHistory] Built resume href', href, 'resumeSourceName=', displaySourceName, 'resumeSourceId=', sourceId);

            return (
            <div
              key={item._id}
              className="flex-shrink-0 group relative overflow-hidden rounded-lg w-[200px] h-[300px] transition-transform duration-300"
            >
              <Link
                href={href}
                onClick={() => {
                  // Persist the resume source immediately (best-effort, non-blocking) — only when logged in.
                  // If the history item doesn't have a source, fall back to the user's current preferred source.
                  const allowedSources = ['videasy', 'vidlink', 'vidnest', 'vidsrc'];
                  let resumeSource: string | undefined = undefined;
                  try {
                    const perMedia = getExplicitSourceForMedia(item.mediaId, false);
                    if (perMedia) resumeSource = perMedia;
                  } catch (e) { /* ignore */ }
                  if (!resumeSource) {
                    // Prefer the current user/server preference first, then fall back to the history item's recorded source
                    if (videoSource && allowedSources.includes(String(videoSource))) {
                      resumeSource = String(videoSource);
                    } else if (item.source && allowedSources.includes(item.source)) {
                      resumeSource = item.source;
                    } else {
                      resumeSource = undefined;
                    }
                  }
                  if (resumeSource && session?.user) {
                    try {
                      // Persist per-media explicit source so it applies only to this selection
                      try {
                        // Persist per-media explicit source synchronously so it exists before navigation
                        try {
                          setExplicitSourceForMedia(item.mediaId, resumeSource);
                          console.log('[UserWatchHistory] Set per-media explicit source (sync)', { mediaId: item.mediaId, source: resumeSource });

                          // Fire-and-forget: persist to server as immediate explicit write (async)
                          (async () => {
                            try {
                              const payload: any = {
                                mediaId: item.mediaId,
                                mediaType: item.mediaType,
                                currentTime: item.currentTime ?? 0,
                                totalDuration: item.totalDuration ?? 0,
                                progress: item.progress ?? 0,
                                immediate: true,
                                source: resumeSource,
                                explicit: true,
                                title: item.title || '',
                                posterPath: item.posterPath || '',
                              };
                              if (item.seasonNumber !== undefined) payload.seasonNumber = item.seasonNumber;
                              if (item.episodeNumber !== undefined) payload.episodeNumber = item.episodeNumber;
                              await fetch('/api/watch-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                              console.log('[UserWatchHistory] Persisted explicit source to watch-history (async)', { mediaId: item.mediaId, source: resumeSource });
                            } catch (e) {
                              console.warn('[UserWatchHistory] Failed to persist explicit source', e);
                            }
                          })();

                              // Also persist the user's last-used source to their profile
                              // so future navigations (server-side) remember this choice.
                              (async () => {
                                try {
                                  await fetch('/api/user/source', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ source: resumeSource, explicit: true, at: new Date().toISOString() }),
                                  });
                                  console.log('[UserWatchHistory] Persisted user last-used source (async)', { mediaId: item.mediaId, source: resumeSource });
                                } catch (e) {
                                  console.warn('[UserWatchHistory] Failed to persist user source', e);
                                }
                              })();

                        } catch (e) { /* ignore */ }
                      } catch (e) { /* ignore */ }
                    } catch (e) {
                      // ignore
                    }
                  } else {
                    // logged out: do not persist explicit choice
                  }
                }}
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
                  <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white hidden">
                    {Math.floor(item.currentTime / 60)}:{String(Math.floor(item.currentTime % 60)).padStart(2, '0')} / {Math.floor((item.totalDuration || 0) / 60)}:{String(Math.floor((item.totalDuration || 0) % 60)).padStart(2, '0')}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteConfirmation({ id: item._id, title: item.title });
                    }}
                    className="absolute bottom-2 right-2 bg-red-600/80 hover:bg-red-600 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"
                    aria-label="Delete from history"
                  >
                    <Trash2 size={16} />
                  </button>
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

