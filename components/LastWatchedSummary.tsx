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
              // Try to filter by genres if we have them
              let resToShow: any[] = [];
              if (lastGenreIds && lastGenreIds.length > 0) {
                console.log('[LastWatchedSummary] Filtering by genres:', lastGenreIds);
                // First try genre-filtered
                for (const r of recData.results) {
                  const gids = r.genre_ids || [];
                  const overlap = gids.some((id: number) => lastGenreIds!.includes(id));
                  if (overlap) resToShow.push(r);
                }
                console.log('[LastWatchedSummary] Genre-filtered results:', resToShow.length);
              }
              
              // If genre filtering produced no results, use all recommendations
              if (resToShow.length === 0) {
                console.log('[LastWatchedSummary] No genre matches, using all recommendations');
                resToShow = recData.results;
              }

              const chosen = resToShow.slice(0, 6);
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
    <div className="mb-8">
      <div className="flex items-baseline gap-4 mb-4 px-2 md:px-0">
        <h3 className="text-2xl font-normal text-gray-100">Since you watched</h3>
        {lastItem && (
          <div className="text-xl md:text-2xl font-extrabold text-red-600 tracking-tight max-w-[48ch] truncate">{lastItem.title}</div>
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

        <div ref={scrollRef} onScroll={checkScroll} className="flex gap-4 overflow-x-auto pb-3 hide-scrollbar px-2">
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
                  const allowedSources = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
                  const resolvedMediaId = it.mediaId ?? (typeof it.id === 'number' ? it.id : undefined);
                  const resumeSource = (allowedSources.includes(String(videoSource))) ? videoSource : (it.source && allowedSources.includes(it.source) ? it.source : undefined);

                  if (resolvedMediaId && resumeSource && session?.user) {
                    try {
                      setExplicitSourceForMedia(resolvedMediaId, resumeSource);
                      console.log('[LastWatched] Set per-media explicit source (sync)', { mediaId: resolvedMediaId, source: resumeSource });
                    } catch (e) {
                      // ignore storage errors
                    }

                    // Fire-and-forget: persist to server as immediate explicit write (async)
                    (async () => {
                      try {
                        const payload: any = {
                          mediaId: resolvedMediaId,
                          mediaType: it.mediaType,
                          currentTime: it.currentTime ?? 0,
                          totalDuration: it.totalDuration ?? 0,
                          progress: it.progress ?? 0,
                          immediate: true,
                          source: resumeSource,
                          explicit: true,
                          title: it.title || '',
                          posterPath: it.posterPath || '',
                        };
                        if (it.seasonNumber !== undefined) payload.seasonNumber = it.seasonNumber;
                        if (it.episodeNumber !== undefined) payload.episodeNumber = it.episodeNumber;
                        await fetch('/api/watch-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        console.log('[LastWatched] Persisted per-media explicit source to watch-history (async)', { mediaId: resolvedMediaId, source: resumeSource });
                      } catch (e) {
                        console.warn('[LastWatched] Failed to persist explicit source to server', e);
                      }
                    })();
                  }
                }}
                className="flex-shrink-0 w-[240px] group"
              >
                  <div className={`rounded-md overflow-hidden bg-black border border-transparent shadow-xl relative transform hover:scale-105 transition-all duration-200 ${it.isLast ? 'border-red-600 shadow-[0_8px_30px_rgba(255,0,0,0.12)]' : ''}`}>
                  <div className="relative w-full h-44 bg-gray-800">
                    {it.posterPath ? (
                      <Image src={`https://image.tmdb.org/t/p/w500${it.posterPath}`} alt={it.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">No Image</div>
                    )}



                    {/* Resume button for the last watched item */}
                    {it.isLast && (
                      <div className="absolute inset-0 flex items-end p-3">
                        <button className="ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full font-semibold shadow-xl">Resume</button>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-sm font-semibold text-white tracking-tight line-clamp-2">{it.title}</p>
                    {it.isLast && (
                      <p className="text-xs text-gray-300 mt-1">{timeAgo(it.lastWatchedAt)}</p>
                    )}
                    {it.relatedToLast && (
                      <div className="inline-block mt-2 px-2 py-1 bg-white/6 text-xs text-white rounded">Related to last watched</div>
                    )}
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
