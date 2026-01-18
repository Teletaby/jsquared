'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getMovieDetails } from '@/lib/tmdb';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { getExplicitSourceForMedia, setExplicitSourceForMedia } from '@/lib/utils';

function timeAgo(dateString?: string) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export default function LastWatchedSummary() {
  const [lastItem, setLastItem] = useState<any | null>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  // Track user's preferred source (used as fallback when history item has no explicit source)
  const [videoSource, setVideoSource] = useState<'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock' | null>(null);

  const { data: session } = useSession();

  useEffect(() => {
    let isMounted = true;

    const fetchLatestAndRecs = async () => {
      try {
        console.log('[LastWatchedSummary] Starting fetch, session:', session?.user?.email);
        // Fetch user's preferred source first so resume links can include it immediately (only when logged in)
        if (session?.user) {
          try {
            const sourceRes = await fetch('/api/user/source');
            if (sourceRes.ok) {
              const sdata = await sourceRes.json();
              if (sdata?.source) setVideoSource(sdata.source);
              else {
                // fallback to localStorage if server doesn't have it
                try {
                  const local = localStorage.getItem('lastUsedSource');
                  const allowedSources = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
                  if (local && allowedSources.includes(local)) setVideoSource(local as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
                } catch (e) {
                  // ignore
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }

        const res = await fetch('/api/watch-history?limit=1');
        if (!res.ok) {
          console.log('[LastWatchedSummary] Watch history fetch failed:', res.status);
          return;
        }
        const data = await res.json();
        console.log('[LastWatchedSummary] Watch history fetched, count:', data?.length);
        if (!Array.isArray(data) || data.length === 0) {
          console.log('[LastWatchedSummary] No watch history data returned');
          return;
        }

        const item = data[0];
        if (!isMounted) return;
        setLastItem(item);

        // Try to fetch details for the last-watched item to extract genres
        let lastGenreIds: number[] | null = null;
        try {
          const details = await getMovieDetails(item.mediaId);
          if (details && Array.isArray(details.genres)) {
            lastGenreIds = details.genres.map((g: any) => g.id);
          }
        } catch (e) {
          // ignore failures to fetch details
        }

        // Fetch recommendations and filter by genre if possible, fallback to all if no genre matches
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const recRes = await fetch(`/api/tmdb/recommendations?mediaType=${item.mediaType}&id=${item.mediaId}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (recRes.ok) {
            const recData = await recRes.json();
            console.log('[LastWatchedSummary] Recommendations fetched:', recData?.results?.length || 0, 'items');
            if (recData?.results && Array.isArray(recData.results)) {
              // Use all TMDB recommendations without genre filtering to maximize selection
              const resToShow = recData.results;

              const chosen = resToShow.slice(0, 20);
              console.log('[LastWatchedSummary] Final recommendations to display:', chosen.length);
              const mapped = chosen.map((r: any) => ({
                id: `rec-${r.id}`,
                mediaId: r.id,
                mediaType: item.mediaType,
                title: r.title || r.name,
                posterPath: r.poster_path,
                genre_ids: r.genre_ids,
                relatedToLast: true,
              }));
              setRecs(mapped);
            }
          } else {
            console.warn('[LastWatchedSummary] Failed to fetch recommendations:', recRes.status);
          }
        } catch (e) {
          console.error('[LastWatchedSummary] Error fetching recommendations:', e);
        }
      } catch (e) {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLatestAndRecs();

    return () => { isMounted = false; };
  }, [session?.user]);

  // Fetch the user's preferred source (fallback if history item lacks a source)
  useEffect(() => {
    const fetchUserSource = async () => {
      try {
        if (!session?.user) return;
        const res = await fetch('/api/user/source');
        if (res.ok) {
          const data = await res.json();
          if (data?.source) setVideoSource(data.source);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchUserSource();
  }, [session?.user]);

  // Scrollability check
  const checkScroll = () => {
    const c = scrollRef.current;
    if (!c) return;
    setCanLeft(c.scrollLeft > 0);
    setCanRight(c.scrollLeft + c.clientWidth < c.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [lastItem, recs]);

  const scroll = (dir: 'left' | 'right') => {
    const c = scrollRef.current;
    if (!c) return;
    const px = c.clientWidth * 0.7;
    c.scrollBy({ left: dir === 'left' ? -px : px, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  if (loading || !lastItem) {
    console.log('[LastWatchedSummary] Returning null - loading:', loading, 'lastItem:', !!lastItem);
    return null;
  }

  if (recs.length === 0) {
    console.log('[LastWatchedSummary] No recommendations available, hiding section');
    return null;
  }

  console.log('[LastWatchedSummary] Rendering with lastItem:', lastItem?.title, 'recs:', recs.length);
  const items = [
    {
      id: `last-${lastItem._id}`,
      title: lastItem.title,
      posterPath: lastItem.posterPath,
      mediaType: lastItem.mediaType,
      mediaId: lastItem.mediaId,
      lastWatchedAt: lastItem.lastWatchedAt,
      isLast: true,
      seasonNumber: lastItem.seasonNumber,
      episodeNumber: lastItem.episodeNumber,
    },
    ...recs
  ];

  return (
    <div className="mb-12">
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-6 px-4">
        <h3 className="text-2xl sm:text-3xl font-bold text-white font-orbitron uppercase tracking-wider">Since you watched</h3>
        {lastItem && (
          <div className="text-sm sm:text-lg md:text-xl font-bold text-[#E50914] tracking-tight truncate">{lastItem.title}</div>
        )}
      </div>

      <div className="relative">
        {/* Left arrow (always present, disabled state when can't scroll) */}
        <div className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none z-10 flex items-center justify-start">
          <div className="pointer-events-auto">
            <button
              onClick={() => scroll('left')}
              disabled={!canLeft}
              aria-label="Scroll left"
              className={`-ml-2 z-30 p-3 rounded-full transition-all duration-150 shadow-2xl ring-1 ring-white/10 ${canLeft ? 'bg-white/10 text-white hover:scale-105' : 'bg-black/30 text-gray-400 opacity-40 cursor-not-allowed'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" className="pointer-events-none">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={scrollRef} onScroll={checkScroll} className="flex gap-4 overflow-x-auto pb-3 hide-scrollbar px-4">
          {items.map((it: any) => {
            // Resolve a numeric mediaId reliably (recs may have `id` while watch history uses `mediaId`)
            const resolvedMediaId = it.mediaId ?? (typeof it.id === 'number' ? it.id : undefined);
            if (!resolvedMediaId) {
              // Avoid generating a link with 'undefined' — fall back to a no-op href
              console.warn('[LastWatched] Missing mediaId for item', it);
            }

            let href = '#';
            if (resolvedMediaId) {
              const base = `/${it.mediaType}/${resolvedMediaId}`;
              const params: string[] = [];
              if (it.mediaType === 'tv' && it.seasonNumber !== undefined && it.episodeNumber !== undefined) {
                params.push(`season=${it.seasonNumber}`, `episode=${it.episodeNumber}`);
              }
              // Always direct to the info view first
              params.push('view=info');
              // We no longer include source/time in the URL to avoid exposing them in query params.
              // Instead, we persist the user's preferred source on click and rely on server-stored history for resume time.
              // Prefer the user's current preferred source (server/local) over the history item's recorded source when persisting only.
              const allowedSources = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
              // Prefer per-media explicit source for this item, then the item's recorded source, then the page's current videoSource
              let resumeSource: string | undefined = undefined;
              try {
                const resolvedMediaId = it.mediaId ?? (typeof it.id === 'number' ? it.id : undefined);
                if (resolvedMediaId) {
                  try {
                    const perMedia = getExplicitSourceForMedia(resolvedMediaId, false);
                    if (perMedia) resumeSource = perMedia;
                  } catch (e) { /* ignore */ }
                }
              } catch (e) {
                // ignore storage errors
              }

              if (!resumeSource) {
                resumeSource = it.source && allowedSources.includes(it.source) ? it.source : (allowedSources.includes(String(videoSource)) ? videoSource ?? undefined : undefined);
              }
              href = `${base}${params.length > 0 ? '?' + params.join('&') : ''}`;
            }
            return (
              <Link
                key={it.id}
                href={href}
                onClick={() => {
                  // Synchronously persist the per-media explicit source so it exists BEFORE navigation
                  // IMPORTANT: Only use the item's recorded source. Do NOT fall back to component state (videoSource)
                  // because it may be stale. We don't want to accidentally overwrite the user's preference.
                  const allowedSources = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
                  const resolvedMediaId = it.mediaId ?? (typeof it.id === 'number' ? it.id : undefined);
                  
                  // Only use the item's source, not the potentially stale videoSource
                  const resumeSource = (it.source && allowedSources.includes(it.source)) ? it.source : undefined;

                  if (resolvedMediaId && resumeSource && session?.user) {
                    try {
                      setExplicitSourceForMedia(resolvedMediaId, resumeSource);
                      console.log('[LastWatched] Set per-media explicit source (sync)', { mediaId: resolvedMediaId, source: resumeSource });
                    } catch (e) {
                      // ignore storage errors
                    }
                  }
                  // Note: We intentionally do NOT persist to /api/user/source here to avoid
                  // overwriting the user's actual preference with potentially stale data
                }}
                className="flex-shrink-0 w-[180px] group"
              >
                <div className={`rounded-xl overflow-hidden bg-black shadow-lg relative transform hover:scale-105 transition-all duration-300 ${it.isLast ? 'ring-2 ring-[#E50914] shadow-[0_8px_30px_rgba(229,9,20,0.3)]' : 'ring-1 ring-gray-700 hover:ring-gray-600'}`}>
                  {/* Image Container */}
                  <div className="relative w-full bg-gray-800" style={{ aspectRatio: '2/3' }}>
                    {it.posterPath ? (
                      <>
                        <Image src={`https://image.tmdb.org/t/p/w500${it.posterPath}`} alt={it.title} fill className="object-cover group-hover:scale-110 transition-transform duration-300" />
                        {/* Dark Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 group-hover:to-black/90 transition-all duration-300" />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">No Image</div>
                    )}

                    {/* Info - Overlay on image */}
                    <div className="absolute inset-0 flex flex-col justify-between p-3">
                      {/* Top */}
                      <div></div>

                      {/* Bottom - Title and buttons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-xs font-bold text-white truncate line-clamp-2 mb-2 font-orbitron uppercase tracking-wide">{it.title}</p>
                        
                        {it.isLast && (
                          <>
                            <p className="text-xs text-gray-300 mb-2">{timeAgo(it.lastWatchedAt)}</p>
                            <button className="w-full bg-[#E50914] hover:bg-[#FF1A20] text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors duration-300 flex items-center justify-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              RESUME
                            </button>
                          </>
                        )}
                        {it.relatedToLast && (
                          <div className="inline-block mt-2 px-2 py-1 bg-[#E50914]/20 text-xs text-[#E50914] rounded-lg border border-[#E50914]/50 font-semibold">
                            Related
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Right arrow (always present, disabled state when can't scroll) */}
        <div className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none z-10 flex items-center justify-end">
          <div className="pointer-events-auto">
            <button
              onClick={() => scroll('right')}
              disabled={!canRight}
              aria-label="Scroll right"
              className={`-mr-2 z-30 p-3 rounded-full transition-all duration-150 shadow-2xl ring-1 ring-white/10 ${canRight ? 'bg-white/10 text-white hover:scale-105' : 'bg-black/30 text-gray-400 opacity-40 cursor-not-allowed'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" className="pointer-events-none">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
