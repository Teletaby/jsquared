"use client";

import { getMovieDetails, ReviewsResponse, CastMember, getCastDetails, getMediaLogos, getMovieRecommendations } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import WatchlistButton from '@/components/WatchlistButton';
import Header from '@/components/Header';
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { formatDuration, getVideoSourceSetting, sourceNameToId, sourceIdToName, getExplicitSourceForMedia, setExplicitSourceForMedia } from '@/lib/utils';
import { Download, Play, Film, Info, Search as SearchIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';
import MarkdownBoldText from '@/components/MarkdownBoldText';
import SourceWarningDialog from '@/components/SourceWarningDialog';


import VideoInfoPopup from '@/components/VideoInfoPopup';
import dynamic from 'next/dynamic';
const ClickDebugger = dynamic(() => import('@/components/ClickDebugger'), { ssr: false });
import AdvancedVideoPlayer from '@/components/AdvancedVideoPlayer';
import VideasyPlayer from '@/components/VideasyPlayer';
import VidLinkPlayer from '@/components/VidLinkPlayer';
import ResumePrompt from '@/components/ResumePrompt';
import { useAdvancedPlaytime } from '@/lib/hooks/useAdvancedPlaytime';
import MoreInfoModal from '@/components/MoreInfoModal';
import TrailerPopup from '@/components/TrailerPopup';
import CastMemberModal from '@/components/CastMemberModal';

interface MovieDetailPageProps {
  params: {
    id: string;
  };
}

// A more specific type for your movie/tv show data
interface MediaDetails {
  id: number;
  title?: string; // For movies
  overview: string;
  poster_path: string;
  backdrop_path?: string;
  vote_average: number;
  runtime?: number; // For movies
  release_date?: string; // For movies
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id: string | null };
  reviews?: ReviewsResponse; // Added reviews property
  cast?: CastMember[];
  budget?: number;
  revenue?: number;
  status?: string;
  production_companies?: { id: number; name: string; logo_path?: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  spoken_languages?: { iso_639_1: string; name: string }[];
  tagline?: string;
}

interface Suggestion {
  id: number;
  title: string;
  name: string;
  poster_path: string;
  media_type: string;
}

const MovieDetailPage = ({ params }: MovieDetailPageProps) => {
  const [movie, setMovie] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0); // Track current playback time for cross-source switching
  const [savedProgress, setSavedProgress] = useState<number>(0); // Track saved progress from history
  const [savedDuration, setSavedDuration] = useState<number>(0); // Track saved duration to clamp resume time
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoaded, setTrailerLoaded] = useState(false);
  const [trailerError, setTrailerError] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedCastMember, setSelectedCastMember] = useState<{ id: number; name: string; image: string | null; character: string } | null>(null);
  // const hasPlayedOnceRef = useRef(false); // Removed, handled by ThemedVideoPlayer
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const [activeTab, setActiveTab] = useState<'overview' | 'cast' | 'details'>('overview');
  const [forceRender, setForceRender] = useState(0);
  const [initialIsInWatchlist, setInitialIsInWatchlist] = useState<boolean | undefined>(undefined);
  const { data: session } = useSession();
  const { checkWatchlistStatus } = useWatchlist();
  const { queueUpdate } = useAdvancedPlaytime();
  const hasFetchedRef = useRef(false); // Track if initial fetch has completed
  // videoSource starts from localStorage when available, otherwise defaults to videasy
  const [videoSource, setVideoSource] = useState<'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock'>(() => {
    try {
      const local = typeof window !== 'undefined' ? localStorage.getItem('lastUsedSource') : null;
      const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
      if (local && allowed.includes(local)) return local as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock';
    } catch (e) {
      // ignore storage errors
    }
    return 'videasy'; // Default to videasy for new users
  });
  const [userLastSourceInfo, setUserLastSourceInfo] = useState<{ source?: string; at?: string | null } | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  const timeAgo = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  const [showSourceWarning, setShowSourceWarning] = useState(false);
  const [pendingSource, setPendingSource] = useState<'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock' | null>(null);
  const lastMediaIdRef = useRef<number | null>(null); // Track last viewed media for source reset
  const [showResumePrompt, setShowResumePrompt] = useState(false); // Show continue watching prompt
  const [resumeChoice, setResumeChoice] = useState<'pending' | 'yes' | 'no'>('pending'); // User's choice
  const [notificationVisible, setNotificationVisible] = useState(true); // Control notification visibility
  const [showMoreInfoModal, setShowMoreInfoModal] = useState(false);
  const [showTrailerPopup, setShowTrailerPopup] = useState(false);
  const [showInfoResumePrompt, setShowInfoResumePrompt] = useState(false); // Resume prompt for info view
  const [similarMovies, setSimilarMovies] = useState<any[]>([]);
  const similarSectionRef = useRef<HTMLDivElement>(null);
  const overviewTabRef = useRef<HTMLButtonElement>(null);
  
  const { id } = params;
  const tmdbId = parseInt(id);
  const mediaType = 'movie'; // Define mediaType for watch history

  // Search functionality
  useEffect(() => {
    const fetchSuggestions = async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoadingSearch(true);
      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.results) {
          setSuggestions(data.results.slice(0, 5)); // Limit to 5 suggestions
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoadingSearch(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSuggestions(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && searchTerm.length >= 2);
  }, [suggestions, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setShowSuggestions(false);
    // Navigate directly to the movie/TV show detail page
    const path = suggestion.media_type === 'tv' ? `/tv/${suggestion.id}` : `/movie/${suggestion.id}`;
    router.push(path);
  };

  // Immediately restore source from storage on client mount (runs once, synchronously reads storage)
  useEffect(() => {
    try {
      // Priority 1: Per-media explicit source from sessionStorage (persists on refresh)
      const perMediaSource = sessionStorage.getItem(`jsc_explicit_source_${tmdbId}`);
      const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
      if (perMediaSource && allowed.includes(perMediaSource)) {
        console.log('[Client] Restoring per-media source from sessionStorage:', perMediaSource);
        setVideoSource(perMediaSource as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
        const at = sessionStorage.getItem(`jsc_explicit_source_at_${tmdbId}`);
        setUserLastSourceInfo({ source: perMediaSource, at: at || null });
        return; // Don't check other sources if per-media is set
      }
      // Priority 2: Global localStorage (persists across sessions)
      const local = localStorage.getItem('lastUsedSource');
      console.log('[Client] Checking localStorage for lastUsedSource:', local);
      if (local && allowed.includes(local)) {
        console.log('[Client] Restoring source from localStorage:', local);
        setVideoSource(local as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
        setUserLastSourceInfo({ source: local, at: null });
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [tmdbId]); // Only run when mediaId changes, not on every render

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (showResumePrompt && notificationVisible) {
      const timer = setTimeout(() => {
        setNotificationVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResumePrompt, notificationVisible]);

  // Persist videoSource to localStorage whenever it changes (so it becomes the default next time)
  useEffect(() => {
    if (videoSource && videoSource !== 'videasy') {
      try {
        localStorage.setItem('lastUsedSource', videoSource);
        console.log('[Client] Persisted lastUsedSource to localStorage:', videoSource);
      } catch (e) {
        console.warn('[Client] Failed to persist source to localStorage', e);
      }
    }
  }, [videoSource]);

  // Effect to reset player state when content changes - no longer needed here
  useEffect(() => {
    // Do not override user's source preference when navigating between media.
    // Reset resume choice for new media
    if (lastMediaIdRef.current !== null && lastMediaIdRef.current !== tmdbId) {
      setResumeChoice('pending');
      setShowResumePrompt(false);
    }
    lastMediaIdRef.current = tmdbId;
  }, [tmdbId]);

  // Effect for fetching data
  useEffect(() => {
    const fetchData = async () => {
      // Skip refetch if data has already been fetched for this movie
      if (hasFetchedRef.current && movie?.id === tmdbId) {
        return;
      }

      // Reset states for a new fetch
      setLoading(true);
      setError(null);
      setMovie(null);
      setTrailerKey(null);
      setTrailerLoaded(false);
      setTrailerError(false);

      try {
        const data: MediaDetails | null = await getMovieDetails(tmdbId);
        const castData = await getCastDetails('movie', tmdbId);
        
        // Fetch trailer using the API endpoint that checks for age restrictions
        try {
          const trailerResponse = await fetch(`/api/trailer/${tmdbId}?mediaType=movie`);
          if (trailerResponse.ok) {
            const trailerData = await trailerResponse.json();
            if (trailerData.trailerKey) {
              setTrailerKey(trailerData.trailerKey);
            } else if (trailerData.ageRestricted) {
              console.log('Trailer is age-restricted, hiding trailer');
              setTrailerError(true);
            }
          }
        } catch (error) {
          console.error('Error fetching trailer:', error);
        }

        if (data && data.id) {
          setMovie({ ...data, cast: castData?.cast || [] });
          hasFetchedRef.current = true; // Mark as fetched
          if (session?.user) {
            const status = await checkWatchlistStatus(tmdbId, mediaType);
            setInitialIsInWatchlist(status);
          }
        } else {
          // This handles cases where the API returns a 200 OK but no data, or a handled error (like 404)
          setError('Could not find details for this movie. It may not exist or there was an API error.');
        }
      } catch (e) {
        console.error("Failed to fetch movie details:", e);
        setError('An unexpected error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tmdbId]); // Only depend on tmdbId to prevent unnecessary refetches

  // Fetch logo for the movie
  useEffect(() => {
    const fetchLogo = async () => {
      if (tmdbId) {
        try {
          const imageData = await getMediaLogos('movie', tmdbId);
          if (imageData?.logos && imageData.logos.length > 0) {
            const englishLogo = imageData.logos.find((logo: any) => logo.iso_639_1 === 'en');
            const logoPath = englishLogo?.file_path || imageData.logos[0]?.file_path;
            if (logoPath) {
              setLogoUrl(`https://image.tmdb.org/t/p/w500${logoPath}`);
            }
          }
        } catch (error) {
          console.error('Error fetching logo:', error);
        }
      }
    };
    fetchLogo();
  }, [tmdbId]);

  // Fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (tmdbId) {
        try {
          const recData = await getMovieRecommendations(tmdbId);
          if (recData?.results) {
            setSimilarMovies(recData.results.slice(0, 20));
          }
        } catch (error) {
          console.error('Error fetching recommendations:', error);
        }
      }
    };
    fetchRecommendations();
  }, [tmdbId]);

  // Separate effect to check watchlist status when session becomes available
  useEffect(() => {
    const checkStatus = async () => {
      if (session?.user && movie && initialIsInWatchlist === undefined) {
        const status = await checkWatchlistStatus(tmdbId, mediaType);
        setInitialIsInWatchlist(status);
      }
    };
    checkStatus();
  }, [session, movie, tmdbId, mediaType, checkWatchlistStatus, initialIsInWatchlist]);

  // Effect to scroll to similar section when activeTab becomes 'overview'
  useEffect(() => {
    if (activeTab === 'overview' && similarMovies.length > 0) {
      // Use requestAnimationFrame for more reliable timing
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          similarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }, [activeTab, similarMovies.length]);

  // Fetch saved watch progress - reset on new movie
  useEffect(() => {
    // Reset progress when movie changes
    setSavedProgress(0);
    setSavedDuration(0);
    setCurrentPlaybackTime(0);
    
    console.log('📍 Session status:', session?.user?.email || 'NO SESSION');
    if (!session?.user) {
      console.log('⏳ Waiting for session...');
      return;
    }

    const fetchWatchProgress = async () => {
      try {
        console.log('🔍 Fetching watch progress for user:', session.user?.email);
        // Ensure we know the user's saved server preference before reading history
        let serverSource: string | undefined = userLastSourceInfo?.source;
        if (session?.user && !serverSource) {
          try {
            const srcRes = await fetch('/api/user/source');
            if (srcRes.ok) {
              const sdata = await srcRes.json();
              if (sdata?.source) {
                serverSource = sdata.source;
                setUserLastSourceInfo({ source: sdata.source, at: sdata.lastUsedSourceAt || null });
                console.log('[Client] Pre-fetched server user source before watch-history:', serverSource);
              }
            }
          } catch (e) {
            console.warn('[Client] Failed to pre-fetch server user source before watch-history', e);
          }
        }

        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Returned watch history count:', data.length);
          const movieHistory = data.find((item: any) => item.mediaId === tmdbId && item.mediaType === 'movie');
          if (movieHistory && movieHistory.currentTime > 0) {
            console.log('✅ FOUND! Movie progress:', movieHistory.currentTime, 's');
            setSavedProgress(movieHistory.currentTime); // Keep full precision, no rounding
            setSavedDuration(movieHistory.totalDuration || 0);
            setCurrentPlaybackTime(movieHistory.currentTime);

            // Prefer the user's stored profile source over a watch-history item's recorded source.
            // Only fall back to the history item's source when no per-user preference exists and no explicit local selection is present.
            const qsSource = searchParams.get('source');
            if (!qsSource && movieHistory.source) {
              // If we already pre-fetched the server preference above, `serverSource`
              // will be set. If not, try localStorage as a fallback.
              if (!serverSource) {
                try {
                  const local = localStorage.getItem('lastUsedSource');
                  const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
                  if (local && allowed.includes(local)) {
                    serverSource = local;
                    console.log('[Client] Using localStorage lastUsedSource as fallback while applying history:', serverSource);
                  }
                } catch (e) {
                  // ignore storage errors
                }
              }

              // If server has a stored source, use it (prefer user's last used source)
              if (serverSource) {
                const allowedSources = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
                if (allowedSources.includes(serverSource)) {
                  console.log('[Client] Using server preferred source:', serverSource);
                  setVideoSource(serverSource as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
                  setUserLastSourceInfo({ source: serverSource, at: userLastSourceInfo?.at || null });
                }
              } else {
                const _id = sourceNameToId(movieHistory.source);
                console.log('[Client] No server/user profile source; using source from watch-history:', _id ? `Source ${_id}` : 'unknown', { movieHistorySource: movieHistory.source, userLastSourceInfo });

                // Only use watch-history source if the user hasn't explicitly selected a source for THIS media in this tab
                let explicit = false;
                try { 
                  explicit = !!getExplicitSourceForMedia(tmdbId, false);
                } catch (e) { explicit = false; }
                if (!explicit) {
                  console.log('[Client][DEBUG] Setting video source from history', { setTo: movieHistory.source, movieId: movieHistory.mediaId, movieTitle: movieHistory.title });
                  setVideoSource(movieHistory.source);
                  setUserLastSourceInfo({ source: movieHistory.source, at: movieHistory.lastWatchedAt || null });

                  // Best-effort persist so future navigations pick this up in the user profile
                  try {
                    fetch('/api/user/source', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      /* intentionally not persisting automatic watch-history source to avoid overwriting explicit user preferences */
                      keepalive: true,
                    }).catch(() => {});
                  } catch (e) {
                    // ignore persistence failures (server-side retry/fallback exists)
                  }
                } else {
                  console.log('[Client] Skipping applying/persisting watch-history source because explicit local selection exists');
                }
              }
            }
          } else {
            console.log('❌ NOT FOUND! Looking for movie:', tmdbId);
            console.log('Available movies:', data.filter((h: any) => h.mediaType === 'movie').map((h: any) => h.mediaId));
          }
        } else {
          console.error('API ERROR! Status:', response.status);
        }
      } catch (error) {
        console.error('FETCH ERROR:', error);
      }
    };

    fetchWatchProgress();
  }, [session, tmdbId]);

  // Defensive: if an automatic process sets the source to 'videasy' but the
  // client has a different saved preference, revert to the saved preference.
  // DISABLED: This defense mechanism was reverting manual source selections
  // useEffect(() => {
  //   try {
  //     const local = localStorage.getItem('lastUsedSource');
  //     const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc'];
  //     if (local && allowed.includes(local) && videoSource === 'videasy' && local !== 'videasy') {
  //       console.log('[Client][DEFENSE] Reverting automatic videasy fallback to local lastUsedSource:', local);
  //       setVideoSource(local as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc');
  //     }
  //   } catch (e) {
  //     // ignore
  //   }
  // }, [videoSource]);

  // Fetch video source setting (but honor `?source=` query param if present)
  useEffect(() => {
    const fetchVideoSource = async () => {
      // If we've already got an explicit selection (per-media), use it and do not overwrite it
      try {
        const explicit = getExplicitSourceForMedia(tmdbId, false);
        if (explicit) {
          const name = explicit as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock';
          const explicitAt = sessionStorage.getItem(`jsc_explicit_source_at_${tmdbId}`);
          setVideoSource(name);
          setUserLastSourceInfo({ source: name, at: explicitAt || null });
          return;
        }
      } catch (e) {
        // ignore storage errors
      }

      // If the URL includes a source override, trust it and do not fetch/overwrite from server
      const qsSource = searchParams.get('source');
      if (qsSource) {
        // Accept either numeric ids (1,2,3,4) or names ('videasy','vidlink','vidnest','vidsrc') for backward compatibility
        const name = sourceIdToName(qsSource) || (['videasy','vidlink','vidnest','vidsrc','vidrock'].includes(qsSource) ? qsSource : undefined);
        if (name) {
          const qsId = sourceNameToId(name);
          console.log('[Client] Source query param detected; skipping server fetch and setting source to:', qsId ? `Source ${qsId}` : 'unknown');
          setVideoSource(name as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
          setUserLastSourceInfo({ source: name, at: new Date().toISOString() });
          return;
        }
      }

      // Prefer per-user saved source if available, otherwise fall back to global setting
      try {
        const res = await fetch('/api/user/source');
        if (res.ok) {
          const data = await res.json();
          console.log('[Client] /api/user/source returned:', data);
          if (data?.source) {
            try {
              // Synchronously check per-media explicit selection (do NOT fall back to global here)
              const explicit = getExplicitSourceForMedia(tmdbId, false);
              if (!explicit) {
                setVideoSource(data.source);
                setUserLastSourceInfo({ source: data.source, at: data.lastUsedSourceAt || null });
              } else {
                console.log('[Client] Skipping server source because explicit local selection exists for this media', { mediaId: tmdbId, explicit });
              }
            } catch (e) {
              setVideoSource(data.source);
              setUserLastSourceInfo({ source: data.source, at: data.lastUsedSourceAt || null });
            }
            return;
          }
        }
      } catch (e) {
        console.warn('Error fetching user source:', e);
        // ignore and fall back
      }
      // If server didn't provide a user preference, prefer a client-local saved preference
      try {
        const local = localStorage.getItem('lastUsedSource');
        const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
        if (local && allowed.includes(local)) {
          setVideoSource(local as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
          setUserLastSourceInfo({ source: local, at: null });
          return;
        }
      } catch (e) {
        // ignore storage errors
      }

      // Default to videasy for logged-out users or when no other source is found
      console.log('[Client] No saved source found, defaulting to videasy (Source 1)');
      setVideoSource('videasy');
      setUserLastSourceInfo({ source: 'videasy', at: null });
    };
    // Re-run when session changes or query params change (so a resume link can override)
    fetchVideoSource();
  }, [session?.user?.email, searchParams]);

  // If the page was opened via a resume link that includes a source query param, honor it
  useEffect(() => {
    const qsSource = searchParams.get('source');
    if (!qsSource) return;
    const valid = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
    if (!valid.includes(qsSource)) return;

    // Map numeric query values back to names when necessary
    const name = sourceIdToName(qsSource) || qsSource;
    if (name !== videoSource && (name === 'videasy' || name === 'vidlink' || name === 'vidnest' || name === 'vidsrc' || name === 'vidrock')) {
      const overrideId = sourceNameToId(name);
      console.log('[Client] Overriding video source from query param:', overrideId ? `Source ${overrideId}` : 'unknown');
      setVideoSource(name as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
      setUserLastSourceInfo({ source: name, at: new Date().toISOString() });

      // Persist user's preference so future navigations remember this choice
      (async () => {
        try {
          await fetch('/api/user/source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: name, explicit: true, at: new Date().toISOString() }),
          });
        } catch (e) {
          console.warn('Failed to persist source from query param:', e);
        }
      })();
    }
  }, [searchParams, videoSource]);

  // If the page was opened via a resume link that includes a time query param, honor it
  useEffect(() => {
    const qsTime = searchParams.get('time');
    if (!qsTime) return;
    const t = parseInt(qsTime, 10);
    if (Number.isNaN(t) || t <= 0) return;

    // If the time is different from what we fetched from the server, override and force resume
    if (t !== savedProgress) {
      console.log('[Client] Overriding savedProgress from query param time:', t);
      setSavedProgress(t);
      setCurrentPlaybackTime(t);
      setResumeChoice('yes');
      setShowResumePrompt(false);
    }
  }, [searchParams, savedProgress]);

  // Automatically resume if saved progress exists (no prompt needed)
  useEffect(() => {
    if (savedProgress > 0 && resumeChoice === 'pending') {
      console.log('🎬 Auto-resuming from', savedProgress, 'seconds');
      setResumeChoice('yes');
    }
  }, [savedProgress, resumeChoice]);

  // Handle resume choice
  const handleResumeYes = () => {
    console.log('✅ User clicked RESUME - savedProgress:', savedProgress, 'seconds');
    setResumeChoice('yes');
    setShowResumePrompt(false);
  };

  const handleResumeNo = () => {
    setResumeChoice('no');
    setShowResumePrompt(false);
  };

  // Centralize title logic to handle optional properties and provide a fallback.
  // Moved here before handleSelectSource so it can be used in the callback
  const mediaTitle = movie?.title || 'Untitled Movie';

  // Define the select source handler and capture fallback BEFORE any conditional returns
  const handleSelectSource = useCallback(async (source: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock') => {
    const reqId = sourceNameToId(source);
    const curId = sourceNameToId(videoSource);
    console.log('[handleSelectSource] Called with:', { requested: reqId ? `Source ${reqId}` : 'unknown', current: curId ? `Source ${curId}` : 'unknown', source });
    if (videoSource === source) {
      console.log('[handleSelectSource] Already on this source, returning early');
      return;
    }
    
    // Optimistically set in UI
    const prev = videoSource;
    setVideoSource(source);
    setUserLastSourceInfo({ source, at: new Date().toISOString() });

    // Only persist if the user is logged in. When logged out we behave like a normal player: allow switching
    // but do not persist anything (no server call, no local/session storage writes).
    if (session?.user) {
      try {
        // Per-media explicit selection: persist in sessionStorage for this tab
        try { setExplicitSourceForMedia(tmdbId, source); sessionStorage.setItem('jsc_explicit_source_at', new Date().toISOString()); } catch(e) {}

        // Persist source to user profile so it remembers across sessions (same as TV page)
        try {
          const res = await fetch('/api/user/source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, explicit: true, at: new Date().toISOString() }),
          });
          if (!res.ok) {
            console.warn('Failed to persist user source selection (status)', res.status);
          } else {
            const persistedId = sourceNameToId(source);
            console.log('[Client] Source persisted on server:', persistedId ? `Source ${persistedId}` : 'unknown');
          }
        } catch (e) {
          console.warn('Failed to persist user source selection', e);
        }

        // Also save to localStorage for faster initial load
        try { localStorage.setItem('lastUsedSource', source); } catch (e) {}

        // Update the watch history item's source so "Continue Watching" works correctly
        try {
          const payload: any = {
            mediaId: tmdbId,
            mediaType: 'movie',
            currentTime: savedProgress || 0,
            totalDuration: savedDuration || 0,
            progress: savedDuration > 0 ? Math.round((savedProgress / savedDuration) * 100) : 0,
            immediate: true,
            source: source,
            explicit: true,
            title: mediaTitle,
            posterPath: movie?.poster_path || '',
          };
          await fetch('/api/watch-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          console.log('[Client] Watch history item source updated:', source);
        } catch (e) {
          console.warn('Failed to update watch history item source', e);
        }
      } catch (e) {
        console.warn('Failed to apply per-media source selection', e);
      }
    } else {
      // Not logged in: do not persist anywhere. Keep the UI change in-memory only.
      console.log('[Client] User not logged in — applying source change in-memory only');
    }
  }, [videoSource, session?.user, tmdbId, mediaType, savedProgress, savedDuration, mediaTitle, movie?.poster_path]);

  // Capture-phase fallback: if an overlay is intercepting clicks above the source buttons,
  // detect clicks within button bounding rects and trigger the handler programmatically.
  // DISABLED: This was causing double-clicks and incorrect source detection. The direct onClick handlers are sufficient.
  /*
  useEffect(() => {
    const onCaptureClick = (e: MouseEvent) => {
      try {
        const x = e.clientX;
        const y = e.clientY;
        const el = document.elementFromPoint(x, y);
        // If the click already landed on a source button (or its descendant), don't duplicate
        if (el && (el as Element).closest && (el as Element).closest('button[data-source-button]')) return;

        const buttons = Array.from(document.querySelectorAll('button[data-source-button]')) as HTMLButtonElement[];
        for (const b of buttons) {
          const r = b.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            const source = b.getAttribute('data-source-button') as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock' | null;
            if (source && source !== videoSource) {
              const capId = sourceNameToId(source);
              console.log('[Client] Capture fallback triggered for source:', capId ? `Source ${capId}` : 'unknown');
              // Call handler (fire and forget)
              void handleSelectSource(source);
            }
            break;
          }
        }
      } catch (err) {
        // ignore
      }
    };

    document.addEventListener('click', onCaptureClick, true);
    return () => document.removeEventListener('click', onCaptureClick, true);
  }, [videoSource, handleSelectSource]);
  */

  // Construct embed URL with useMemo to prevent unnecessary changes
  const embedUrl = useMemo(
    () => {
      if (videoSource === 'vidnest') {
        return `https://vidnest.fun/movie/${tmdbId}`;
      } else if (videoSource === 'vidsrc') {
        return `https://vidsrc.icu/embed/movie/${tmdbId}`;
      } else if (videoSource === 'vidrock') {
        // For VidRock, we'll fetch from video-proxy API if there's saved progress
        return savedProgress > 0 ? null : `https://vidrock.net/movie/${tmdbId}`;
      } else {
        // For videasy and vidlink sources, we use dedicated player components
        return null; // We'll use VideasyPlayer or VidLinkPlayer instead
      }
    },
    [tmdbId, videoSource, savedProgress]
  );
  const videoSrc = embedUrl;

  // State for VidRock URL when fetched from video-proxy API
  const [vidrockUrl, setVidrockUrl] = useState<string | null>(null);

  // Fetch VidRock URL from video-proxy API when needed
  useEffect(() => {
    if (videoSource === 'vidrock' && savedProgress > 0 && !vidrockUrl) {
      const fetchVidrockUrl = async () => {
        try {
          const response = await fetch('/api/video-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'vidrock',
              tmdbId: tmdbId,
              mediaType: 'movie',
              startTime: savedProgress,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            setVidrockUrl(data.url);
          }
        } catch (error) {
          console.error('Failed to fetch VidRock URL:', error);
        }
      };
      fetchVidrockUrl();
    }
  }, [videoSource, savedProgress, tmdbId, vidrockUrl]);

  // Format saved progress for display


  // If still loading data OR we haven't resolved which source to use yet, show a loading state
  if (loading || videoSource === null) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h2 className="text-2xl text-red-500 font-bold mb-4">Failed to Load Details</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  if (!movie) {
    return null; // Or a "Not Found" component
  }

  const handleConfirmSourceChange = async () => {
    if (pendingSource) {
      setVideoSource(pendingSource);
      if (session?.user) {
        try {
          const res = await fetch('/api/user/source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: pendingSource, explicit: true, at: new Date().toISOString() }),
          });
          try { sessionStorage.setItem('jsc_explicit_source', pendingSource); sessionStorage.setItem('jsc_explicit_source_at', new Date().toISOString()); } catch(e) {}
          try { localStorage.setItem('lastUsedSource', pendingSource); } catch(e) {}
          if (res.ok) setUserLastSourceInfo({ source: pendingSource, at: new Date().toISOString() });
        } catch (e) {
          console.warn('Failed to persist user source selection on confirm', e);
        }
      } else {
        console.log('[Client] Confirmed source change (logged out) — not persisting');
      }
      setPendingSource(null);
    }
    setShowSourceWarning(false);
  };

  const handleCancelSourceChange = () => {
    setPendingSource(null);
    setShowSourceWarning(false);
  };

  // Handle Play button click (original logic extracted)
  const handlePlayClick = async () => {
    // Do NOT include source or time in the URL. Persist user's chosen source only when logged in.
    try {
      // Prefer server-stored user source to avoid persisting a transient history source
      let serverSource: string | undefined = userLastSourceInfo?.source;
      if (session?.user && !serverSource) {
        try {
          const srcRes = await fetch('/api/user/source');
          if (srcRes.ok) {
            const sdata = await srcRes.json();
            if (sdata?.source) {
              serverSource = sdata.source;
              setUserLastSourceInfo({ source: sdata.source, at: sdata.lastUsedSourceAt || null });
              console.log('[Client] Click handler fetched server user source:', serverSource);
            }
          }
        } catch (e) {
          console.warn('[Client] Click handler failed fetching server source', e);
        }
      }

      const resolvedSource = serverSource ?? videoSource ?? (userLastSourceInfo?.source as ('videasy' | 'vidlink' | 'vidnest') | undefined);
      if (resolvedSource && session?.user) {
        try {
          // Persist per-media explicit source (do not change global user preference when clicking Play)
          try { setExplicitSourceForMedia(tmdbId, resolvedSource); console.log('[Client] Set per-media explicit source from click:', { mediaId: tmdbId, source: resolvedSource }); } catch(e) {}

          console.log('[Client] Persisted explicit user source for media (per-media) from click:', resolvedSource);

          // If user explicitly chose VIDNEST and we have saved progress, persist that as an immediate watch-history entry
          try {
            if (resolvedSource === 'vidnest' && typeof savedProgress === 'number' && savedProgress > 0) {
              console.log('[Client] Persisting savedProgress to watch-history for Source 3:', savedProgress);
              fetch('/api/watch-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaId: tmdbId, mediaType, currentTime: savedProgress, totalDuration: savedDuration || 0, progress: (savedDuration ? (savedProgress / Math.max(savedDuration,1)) * 100 : 0), immediate: true, source: resolvedSource, title: mediaTitle, posterPath: movie?.poster_path }),
                keepalive: true,
              }).catch(() => {});
            }
          } catch (e) {
            // ignore failures to persist watch-history from click
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn('[Client] Error persisting resolved source on click', e);
    }

    // Navigate to the watch page without exposing source/time in the URL
    router.push(`/${mediaType}/${tmdbId}`);
  };

  // Handle resume choice from info view
  const handleInfoResumeYes = () => {
    console.log('✅ User clicked RESUME from info view - savedProgress:', savedProgress, 'seconds');
    setResumeChoice('yes');
    setShowInfoResumePrompt(false);
    handlePlayClick();
  };

  const handleInfoResumeNo = () => {
    console.log('🔄 User clicked START OVER from info view');
    setResumeChoice('no');
    setShowInfoResumePrompt(false);
    handlePlayClick();
  };


  return (
    <div>
      <div style={{ backgroundColor: '#121212' }} className="text-white min-h-screen">
      {/* Preload VIDEASY, VidLink and VIDNEST for faster loading */}
      <link rel="dns-prefetch" href="https://player.videasy.net" />
      <link rel="preconnect" href="https://player.videasy.net" />
      <link rel="dns-prefetch" href="https://vidlink.pro" />
      <link rel="preconnect" href="https://vidlink.pro" />
      <link rel="dns-prefetch" href="https://vidnest.fun" />
      <link rel="preconnect" href="https://vidnest.fun" />
      
      {/* Source Warning Dialog */}
      <SourceWarningDialog
        isOpen={showSourceWarning}
        onConfirm={handleConfirmSourceChange}
        onCancel={handleCancelSourceChange}
      />

      <Header />
      {/* Show last-used source badge if available (helps confirm persistence) */}
      {userLastSourceInfo?.source && (
        <div className="container mx-auto px-4 mt-3">
          <div className="inline-flex items-center gap-3 bg-white/3 text-sm rounded-full px-3 py-1">
            <span className="text-gray-300">Last used source</span>
            <span className="font-semibold text-white">{userLastSourceInfo.source}</span>
            {userLastSourceInfo.at && <span className="text-gray-400">• {timeAgo(userLastSourceInfo.at)}</span>}
          </div>
        </div>
      )}

      {view === 'info' && (
        <>
          {/* Hero Section with Trailer Background */}
          <div className="relative h-screen flex flex-col justify-center overflow-hidden">
            {/* Backdrop Image - always shown first as base layer (touches navbar and sits behind it) */}
            {movie?.backdrop_path && (
              <img
                src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
                alt="backdrop"
                className="absolute top-0 left-0 w-full h-full object-cover z-0"
              />
            )}

            {/* Trailer Video Background - fades in on top of backdrop (touches navbar and sits behind it) */}
            {trailerKey && !trailerError && (
              <div 
                className="absolute top-0 left-0 w-screen h-full overflow-hidden z-0"
                style={{ 
                  opacity: trailerLoaded ? 1 : 0, 
                  pointerEvents: trailerLoaded ? 'auto' : 'none',
                  transition: 'opacity 1000ms ease-in-out'
                }}
              >
                <iframe
                  id="trailerPlayer"
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${trailerKey}&start=5&showinfo=0&rel=0&fs=0`}
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  onLoad={() => setTrailerLoaded(true)}
                  onError={() => setTrailerError(true)}
                  className="absolute top-0 left-1/2 min-w-full min-h-full -translate-x-1/2 transform scale-150"
                  style={{ 
                    pointerEvents: 'none', 
                    width: '177.78vh',
                    height: '100vh',
                    border: 'none'
                  }}
                ></iframe>
              </div>
            )}

            {/* Fade Overlay - sits above backdrop/trailer but below content */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent opacity-80 pointer-events-none z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none z-10" />

            {/* Content Overlay */}
            <div className="relative z-20 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 w-full py-8">
              <div className="max-w-2xl">
                {/* Logo or Title */}
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={mediaTitle}
                    draggable={false}
                    className="h-16 md:h-20 lg:h-28 w-auto object-contain mb-2 drop-shadow-lg select-none"
                  />
                ) : (
                  <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-white mb-2 drop-shadow-2xl">
                    {mediaTitle}
                  </h1>
                )}

                {/* Quick Stats - Single Row */}
                <div className="flex flex-wrap gap-2 mb-2 text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs lg:text-sm text-gray-400 uppercase">RATING</span>
                    <span className="text-base md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white">{movie.vote_average.toFixed(1)}</span>
                  </div>
                  
                  {movie.runtime && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">DURATION</span>
                      <span className="text-base md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white">{formatDuration(movie.runtime)}</span>
                    </div>
                  )}

                  {movie.release_date && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">RELEASED</span>
                      <span className="text-xs md:text-sm lg:text-lg xl:text-xl 2xl:text-2xl font-bold text-white">{new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}

                  {movie.status && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">STATUS</span>
                      <span className="text-xs md:text-sm lg:text-lg xl:text-xl 2xl:text-2xl font-bold text-white">
                        {(() => {
                          if (movie.release_date) {
                            const releaseDate = new Date(movie.release_date);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            releaseDate.setHours(0, 0, 0, 0);
                            return releaseDate > today ? 'Unreleased' : 'Released';
                          }
                          return movie.status;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {movie.genres.map((genre) => (
                      <span
                        key={genre.id}
                        className="text-xs md:text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-300 font-medium"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tagline */}
                {movie.tagline && (
                  <p className="text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-2 font-light drop-shadow-lg italic">&quot;{movie.tagline}&quot;</p>
                )}

                {/* Description */}
                {movie.overview && (
                  <p className="text-gray-300 text-xs md:text-xs lg:text-sm xl:text-base 2xl:text-lg leading-relaxed mb-3 max-w-xl drop-shadow-lg line-clamp-2">{movie.overview}</p>
                )}

                {/* Action Buttons - Netflix Style */}
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() => {
                      console.log('🎬 Play button clicked - savedProgress:', savedProgress);
                      // Check if there's saved progress and show resume prompt
                      if (savedProgress > 0) {
                        console.log('📍 Showing resume prompt with savedProgress:', savedProgress);
                        setShowInfoResumePrompt(true);
                        return;
                      }

                      console.log('▶️ No saved progress, proceeding directly to watch');
                      // No saved progress, proceed directly to watch
                      handlePlayClick();
                    }}
                    disabled={movie.release_date ? new Date(movie.release_date) > new Date() : false}
                    className={`font-bold py-2 px-6 md:py-2.5 md:px-7 lg:py-3 lg:px-8 rounded transition-all duration-200 flex items-center justify-center gap-2 text-sm md:text-base lg:text-base shadow-lg ${
                      movie.release_date && new Date(movie.release_date) > new Date()
                        ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-red-600 hover:text-white hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    <Play size={18} fill="currentColor" /> {movie.release_date && new Date(movie.release_date) > new Date() ? 'Coming Soon' : 'Play'}
                  </button>
                  <button
                    onClick={() => setShowMoreInfoModal(true)}
                    className="bg-gray-600/60 text-white font-bold py-2 px-6 md:py-2.5 md:px-7 lg:py-3 lg:px-8 rounded transition-all duration-200 hover:bg-gray-500/70 hover:shadow-lg text-sm md:text-base lg:text-base flex items-center gap-2 transform hover:scale-105"
                  >
                    <Info size={18} /> More Info
                  </button>
                  <button
                    onClick={() => setShowTrailerPopup(true)}
                    className="bg-gray-600/60 text-white font-bold py-2 px-6 md:py-2.5 md:px-7 lg:py-3 lg:px-8 rounded transition-all duration-200 hover:bg-gray-500/70 hover:shadow-lg text-sm md:text-base lg:text-base flex items-center gap-2 transform hover:scale-105"
                  >
                    <Film size={18} /> Watch Trailer
                  </button>
                  <div className="flex items-center gap-2">
                    {similarMovies.length > 0 && (
                      <button
                        onClick={() => {
                          setActiveTab('overview');
                          setForceRender(prev => prev + 1);
                          setTimeout(() => {
                            similarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 50);
                        }}
                        className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-full bg-gray-600/60 text-white font-bold transition-all duration-200 hover:bg-gray-500/70 hover:shadow-lg flex items-center justify-center transform hover:scale-105"
                        title="View recommendations"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                      </button>
                    )}
                    <WatchlistButton
                      mediaId={tmdbId}
                      mediaType={mediaType}
                      title={mediaTitle}
                      posterPath={movie.poster_path}
                      rating={movie.vote_average}
                      initialIsInWatchlist={initialIsInWatchlist}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Section Below Hero */}
          <div className="max-w-7xl mx-auto px-6 py-16 space-y-12">
            {/* Tabs */}
            <div style={{ backgroundColor: '#1A1A1A' }} className="flex gap-2 border-b border-gray-700 rounded-t-lg p-2 flex-wrap">
              <button
                ref={overviewTabRef}
                onClick={() => setActiveTab('overview')}
                style={{ backgroundColor: activeTab === 'overview' ? '#E50914' : 'transparent' }}
                className={`py-3 px-6 font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Reviews
              </button>
              <button
                onClick={() => setActiveTab('cast')}
                style={{ backgroundColor: activeTab === 'cast' ? '#E50914' : 'transparent' }}
                className={`py-3 px-6 font-semibold transition-all ${
                  activeTab === 'cast'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Cast & Crew
              </button>
              <button
                onClick={() => setActiveTab('details')}
                style={{ backgroundColor: activeTab === 'details' ? '#E50914' : 'transparent' }}
                className={`py-3 px-6 font-semibold transition-all ${
                  activeTab === 'details'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Details
              </button>
            </div>

            {/* Reviews Tab */}
            {activeTab === 'overview' && (
              <div key={`overview-${activeTab}-${forceRender}`} style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                {movie.reviews && movie.reviews.results.length > 0 ? (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold mb-6">REVIEWS ({movie.reviews.results.length})</h2>
                    {movie.reviews.results.slice(0, 5).map((review) => (
                      <div key={review.id} style={{ backgroundColor: '#0A0A0A' }} className="p-4 rounded border border-gray-700">
                        <div className="flex items-start gap-4 mb-4">
                          {review.author_details.avatar_path ? (
                            <Image
                              src={(review.author_details.avatar_path.startsWith('/https')
                                ? review.author_details.avatar_path.substring(1)
                                : `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`)}
                              alt={review.author_details.username}
                              width={50}
                              height={50}
                              className="rounded-full flex-shrink-0 border border-gray-700"
                            />
                          ) : (
                            <div style={{ backgroundColor: '#1A1A1A' }} className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-700">
                              <span className="text-white font-bold">{review.author_details.username.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-bold text-white">{review.author_details.username}</p>
                            {review.author_details.rating && (
                              <p className="text-sm text-gray-400 font-semibold">⭐ {review.author_details.rating}/10</p>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-400 leading-relaxed mb-3 text-sm">
                          <MarkdownBoldText text={review.content.substring(0, 400)} />
                          {review.content.length > 400 ? '...' : ''}
                        </p>
                        <a href={review.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:brightness-110 text-sm font-semibold transition-all inline-flex items-center gap-1 group">
                          Read Full Review <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No reviews available yet.</p>
                )}
              </div>
            )}

            {/* Similar Movies Section */}
            {activeTab === 'overview' && similarMovies.length > 0 && (
              <div ref={similarSectionRef} style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6 mt-6 scroll-mt-32">
                <h2 className="text-2xl font-bold mb-6 text-white">SIMILAR TO <span className="text-[#E50914]">{movie?.title?.toUpperCase()}</span></h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {similarMovies.map((movie) => (
                    <a
                      key={movie.id}
                      href={`/movie/${movie.id}?view=info`}
                      className="group cursor-pointer text-left"
                    >
                      <div style={{ backgroundColor: '#0A0A0A' }} className="relative overflow-hidden rounded mb-3 border border-gray-700 group-hover:border-red-600 transition-all">
                        {movie.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                            alt={movie.title}
                            width={200}
                            height={300}
                            className="w-full h-auto group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-zinc-800 flex items-center justify-center">
                            <span className="text-gray-500 text-xs text-center px-2">No Image</span>
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-sm text-white truncate group-hover:text-red-500 transition-colors">{movie.title}</p>
                      {movie.vote_average > 0 && (
                        <p className="text-yellow-400 text-xs font-semibold">⭐ {movie.vote_average.toFixed(1)}</p>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Cast Tab */}
            {activeTab === 'cast' && movie.cast && movie.cast.length > 0 && (
              <div style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                <h2 className="text-xl font-bold mb-4">CAST ({movie.cast.length})</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {movie.cast.slice(0, 21).map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedCastMember({ id: member.id, name: member.name, image: member.profile_path, character: member.character })}
                      className="group cursor-pointer text-left"
                    >
                      <div style={{ backgroundColor: '#0A0A0A' }} className="relative overflow-hidden rounded mb-2 border border-gray-700 group-hover:border-red-600 transition-all aspect-[2/3]">
                        {member.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                            alt={member.name}
                            width={130}
                            height={195}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">No Image</span>
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-xs text-white truncate group-hover:text-red-500 transition-colors">{member.name}</p>
                      <p className="text-gray-500 text-xs truncate line-clamp-1">{member.character}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                <div className="space-y-8">
                  {/* Financial Info - Side by side */}
                  {(movie.budget || movie.revenue) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {movie.budget ? (
                        <div style={{ backgroundColor: '#0A0A0A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                          <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500 mb-3 font-bold">PRODUCTION BUDGET</p>
                          <p className="text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white">
                            ${(movie.budget / 1000000).toFixed(1)}M
                          </p>
                        </div>
                      ) : null}
                      {movie.revenue ? (
                        <div style={{ backgroundColor: '#0A0A0A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                          <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500 mb-3 font-bold">BOX OFFICE REVENUE</p>
                          <p className="text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white">
                            ${(movie.revenue / 1000000).toFixed(1)}M
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Production Details Grid */}
                  {(movie.production_companies || movie.production_countries || movie.spoken_languages) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {movie.production_companies && movie.production_companies.length > 0 && (
                        <div style={{ backgroundColor: '#0A0A0A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                          <h3 className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-4 font-bold">PRODUCTION COMPANIES</h3>
                          <div className="space-y-3">
                            {movie.production_companies.slice(0, 4).map((company, index) => (
                              <p key={`company-${company.id || index}`} className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-400">{company.name}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {movie.production_countries && movie.production_countries.length > 0 && (
                        <div style={{ backgroundColor: '#0A0A0A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                          <h3 className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-4 font-bold">COUNTRIES</h3>
                          <div className="space-y-3">
                            {movie.production_countries.map((country) => (
                              <p key={country.iso_3166_1} className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-400">{country.name}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                        <div style={{ backgroundColor: '#0A0A0A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                          <h3 className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-4 font-bold">LANGUAGES</h3>
                          <div className="space-y-3">
                            {movie.spoken_languages.map((language) => (
                              <p key={language.iso_639_1} className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-400">{language.name}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
        
      {/* Player for watch view - Rendered separately to prevent reload on tab changes */}
      {view !== 'info' && (
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 mt-2 space-y-8">
            {/* Video Player */}
            {videoSource === 'videasy' ? (
              // Use VIDEASY player for source 1
              <VideasyPlayer
                key={`${tmdbId}-videasy`}
                mediaId={tmdbId}
                mediaType={mediaType}
                title={mediaTitle}
                posterPath={movie.poster_path}
                initialTime={currentPlaybackTime || savedProgress}
                onTimeUpdate={(time) => {
                  setCurrentPlaybackTime(time);
                  // Always use a valid totalDuration - either from movie.runtime or default to 2 hours
                  const totalSeconds = Math.max((movie?.runtime && movie.runtime > 0) ? (movie.runtime * 60) : 7200, 1);
                  
                  // Cap progress at 100% even if user watched past movie end
                  const progress = Math.min((time / totalSeconds) * 100, 100);
                  
                  console.log(`🎬 Movie Progress Update: ${time}s / ${totalSeconds}s = ${progress.toFixed(1)}%`);
                  
                  queueUpdate({
                    mediaId: tmdbId,
                    mediaType,
                    title: mediaTitle,
                    currentTime: time,
                    totalDuration: totalSeconds,
                    progress: progress,
                    posterPath: movie.poster_path,
                    source: videoSource,
                  });
                }}
              />
            ) : videoSource === 'vidlink' ? (
              // Use VidLink player for source 2
              <VidLinkPlayer
                key={`${tmdbId}-vidlink`}
                mediaId={tmdbId}
                mediaType={mediaType}
                title={mediaTitle}
                posterPath={movie.poster_path}
                initialTime={currentPlaybackTime || savedProgress}
                onTimeUpdate={(time) => {
                  setCurrentPlaybackTime(time);
                  // Always use a valid totalDuration - either from movie.runtime or default to 2 hours
                  const totalSeconds = Math.max((movie?.runtime && movie.runtime > 0) ? (movie.runtime * 60) : 7200, 1);
                  
                  // Cap progress at 100% even if user watched past movie end
                  const progress = Math.min((time / totalSeconds) * 100, 100);
                  
                  console.log(`🎬 Movie Progress Update: ${time}s / ${totalSeconds}s = ${progress.toFixed(1)}%`);
                  
                  queueUpdate({
                    mediaId: tmdbId,
                    mediaType,
                    title: mediaTitle,
                    currentTime: time,
                    totalDuration: totalSeconds,
                    progress: progress,
                    posterPath: movie.poster_path,
                    source: videoSource,
                  });
                }}
              />
            ) : videoSrc || (videoSource === 'vidrock' && vidrockUrl) ? (
              // Use AdvancedVideoPlayer for sources that support embed URLs
              <AdvancedVideoPlayer
                key={`${tmdbId}-${resumeChoice}`}
                embedUrl={videoSource === 'vidrock' && vidrockUrl ? vidrockUrl : (videoSrc as string)}
                title={mediaTitle}
                mediaId={tmdbId}
                mediaType={mediaType}
                posterPath={movie.poster_path}
                initialTime={currentPlaybackTime || savedProgress}
                videoSource={videoSource}
                onTimeUpdate={(time) => {
                  setCurrentPlaybackTime(time);
                  // VIDNEST supports progress tracking via message events
                  const totalSeconds = Math.max((movie?.runtime && movie.runtime > 0) ? (movie.runtime * 60) : 7200, 1);
                  const progress = Math.min((time / totalSeconds) * 100, 100);
                  console.log(`🎬 Movie Progress Update: ${time}s / ${totalSeconds}s = ${progress.toFixed(1)}%`);
                  queueUpdate({
                    mediaId: tmdbId,
                    mediaType,
                    title: mediaTitle,
                    currentTime: time,
                    totalDuration: totalSeconds,
                    progress: progress,
                    posterPath: movie.poster_path,
                    source: videoSource,
                  });
                }}
              />
            ) : (
              <div className="w-full h-[600px] bg-black flex justify-center items-center text-center p-4 rounded-lg shadow-2xl">
                <div>
                  <h2 className="text-2xl text-gray-400 font-bold mb-4">Video Not Available</h2>
                  <p className="text-gray-500">We couldn&apos;t find a playable source for this title.</p>
                </div>
              </div>
            )}

            {/* Optionally show resume prompt */}
            {showResumePrompt && (
              <ResumePrompt
                show={showResumePrompt}
                title={mediaTitle}
                savedTime={savedProgress}
                totalDuration={savedDuration || 3600}
                posterPath={movie?.poster_path}
                onResume={handleResumeYes}
                onStart={handleResumeNo}
                onDismiss={() => setShowResumePrompt(false)}
              />
            )}

            {/* Content Grid - Info for Watch View */}
            <div className="grid grid-cols-1 gap-6">
              {/* Info Section */}
              <div className="space-y-6">
                {/* Title, Download Button and Quick Info */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-start sm:items-center gap-2 mb-2 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white break-words">
                        {mediaTitle}
                      </h1>
                      <VideoInfoPopup />
                    </div>
                    {movie.tagline && (
                      <p className="text-sm sm:text-base text-gray-400 font-light">&ldquo;{movie.tagline}&rdquo;</p>
                    )}
                  </div>
                  <a
                    href={`https://dl.vidsrc.vip/movie/${tmdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300 hover:bg-gray-700/30 flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                  >
                    <Download size={16} /> Download
                  </a>
                </div>

                {/* Source Selector Buttons */}
                <div className="flex flex-wrap gap-2 sm:gap-3 relative z-50 pointer-events-auto">
                  {/* Developer click debugger (dev only) */}

                  <button
                    data-source-button="videasy"
                    onClick={() => {
                      console.log('[Button Click] Source 1 clicked directly');
                      handleSelectSource('videasy');
                    }}
                    className={`relative z-40 pointer-events-auto font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'videasy'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Source 1 {videoSource === 'videasy' && '✓'}
                  </button>
                  <button
                    data-source-button="vidlink"
                    onClick={() => handleSelectSource('vidlink')}
                    className={`relative z-40 pointer-events-auto font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'vidlink'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Source 2 {videoSource === 'vidlink' && '✓'}
                  </button>
                  <button
                    data-source-button="vidnest"
                    onClick={() => handleSelectSource('vidnest')}
                    className={`relative z-40 pointer-events-auto font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'vidnest'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Source 3 {videoSource === 'vidnest' && '✓'}
                  </button>
                  <button
                    data-source-button="vidsrc"
                    onClick={() => handleSelectSource('vidsrc')}
                    className={`relative z-40 pointer-events-auto font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'vidsrc'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Source 4 {videoSource === 'vidsrc' && '✓'}
                  </button>
                  <button
                    data-source-button="vidrock"
                    onClick={() => handleSelectSource('vidrock')}
                    className={`relative z-40 pointer-events-auto font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'vidrock'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Source 5 {videoSource === 'vidrock' && '✓'}
                  </button>
                  <WatchlistButton
                    mediaId={tmdbId}
                    mediaType={mediaType}
                    title={mediaTitle}
                    posterPath={movie.poster_path}
                    rating={movie.vote_average}
                    initialIsInWatchlist={initialIsInWatchlist}
                  />
                </div>

                {/* VIDNEST Adblocker Disclaimer */}
                {videoSource === 'vidnest' && (
                  <div className="bg-blue-900 bg-opacity-40 border border-blue-600 rounded p-3 mt-4">
                    <p className="text-blue-300 text-xs sm:text-sm">
                      💡 <strong>Tip:</strong> Source 3 may have more ads. Please enable an adblocker for a better viewing experience.
                    </p>
                  </div>
                )}

                {/* VIDSRC Warning */}
                {videoSource === 'vidsrc' && (
                  <div className="bg-yellow-900 bg-opacity-40 border border-yellow-600 rounded p-3 mt-4">
                    <p className="text-yellow-300 text-xs sm:text-sm">
                      ⚠️ <strong>Note:</strong> Some selections may not be accurate. If you encounter issues, try switching to another source. {session?.user && 'Timestamps are not stored for this source.'}
                    </p>
                  </div>
                )}

                {/* Rating and Quick Info */}
                <div className="text-gray-400">
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-base">
                    {movie.vote_average && (
                      <span className="font-semibold">Rating: {movie.vote_average.toFixed(1)}</span>
                    )}
                    {movie.release_date && (
                      <span>Release: {new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    )}
                    {movie.runtime && (
                      <span>Duration: {formatDuration(movie.runtime)}</span>
                    )}
                  </div>
                </div>

                {/* Tab Buttons */}
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  <button
                    onClick={() => setActiveTab('overview')}
                    style={{ backgroundColor: activeTab === 'overview' ? '#E50914' : 'transparent' }}
                    className={`font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-sm sm:text-base transition-all ${
                      activeTab === 'overview'
                        ? 'text-white'
                        : 'text-gray-400 hover:text-white border border-gray-700'
                    }`}
                  >
                    Overview & Reviews
                  </button>
                  <button
                    onClick={() => setActiveTab('cast')}
                    style={{ backgroundColor: activeTab === 'cast' ? '#E50914' : 'transparent' }}
                    className={`font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-sm sm:text-base transition-all ${
                      activeTab === 'cast'
                        ? 'text-white'
                        : 'text-gray-400 hover:text-white border border-gray-700'
                    }`}
                  >
                    Cast
                  </button>
                </div>

                {/* Overview & Reviews Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Genres */}
                    {movie.genres && movie.genres.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2 font-semibold">GENRES</p>
                        <div className="flex flex-wrap gap-2">
                          {movie.genres.map((genre) => (
                            <span
                              key={genre.id}
                              className="border border-gray-600 text-gray-300 px-3 py-1 rounded text-sm"
                            >
                              {genre.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overview */}
                    {movie.overview && (
                      <div>
                        <h2 className="text-xl font-bold mb-3 text-white">SYNOPSIS</h2>
                        <p className="text-gray-400 leading-relaxed">{movie.overview}</p>
                      </div>
                    )}

                    {/* Reviews Section */}
                    {movie.reviews && movie.reviews.results.length > 0 && (
                      <div>
                        <h2 className="text-xl font-bold mb-4 text-white">TOP REVIEWS</h2>
                        <div className="space-y-4">
                          {movie.reviews.results.slice(0, 3).map((review) => (
                            <div key={review.id} style={{ backgroundColor: '#1A1A1A' }} className="p-4 rounded border border-gray-700">
                              <div className="flex items-start gap-3 mb-3">
                                {review.author_details.avatar_path ? (
                                  <Image
                                    src={(review.author_details.avatar_path.startsWith('/https')
                                      ? review.author_details.avatar_path.substring(1)
                                      : `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`)}
                                    alt={review.author_details.username}
                                    width={40}
                                    height={40}
                                    className="rounded-full flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-bold text-sm">{review.author_details.username.charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-white text-sm">{review.author_details.username}</p>
                                  {review.author_details.rating && (
                                    <p className="text-xs text-yellow-500 font-semibold">Rating: {review.author_details.rating}/10</p>
                                  )}
                                </div>
                              </div>
                              <p className="text-gray-300 text-sm leading-relaxed">
                                <MarkdownBoldText text={review.content.substring(0, 300)} />
                                {review.content.length > 300 ? '...' : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cast Tab */}
                {activeTab === 'cast' && movie.cast && movie.cast.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold mb-3 text-white">CAST</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
                      {movie.cast.slice(0, 21).map((member) => (
                        <button
                          key={member.id}
                          onClick={() => setSelectedCastMember({ id: member.id, name: member.name, image: member.profile_path, character: member.character })}
                          className="group cursor-pointer text-left"
                        >
                          <div className="relative overflow-hidden rounded mb-2 bg-gray-800 border border-gray-700 group-hover:border-red-600 transition-all aspect-[2/3]">
                            {member.profile_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                                alt={member.name}
                                width={130}
                                height={195}
                                className="w-full h-full object-cover group-hover:scale-110 transition-all duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs text-gray-500">No Image</div>
                            )}
                          </div>
                          <p className="font-semibold text-white text-xs truncate group-hover:text-red-500 transition-colors">{member.name}</p>
                          <p className="text-gray-500 text-xs truncate line-clamp-1">{member.character}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <MoreInfoModal
        isOpen={showMoreInfoModal}
        onClose={() => setShowMoreInfoModal(false)}
        title={mediaTitle}
        tagline={movie.tagline}
        description={movie.overview}
      />

      {/* Trailer Popup - Always rendered at root level for proper z-index */}
      {showTrailerPopup && trailerKey && (
        <TrailerPopup
          trailerKey={trailerKey}
          onClose={() => setShowTrailerPopup(false)}
        />
      )}

      {/* Resume Prompt - Always rendered at root level for proper z-index */}
      {showInfoResumePrompt && (
        <ResumePrompt
          show={showInfoResumePrompt}
          title={mediaTitle}
          savedTime={savedProgress}
          totalDuration={savedDuration || 3600}
          posterPath={movie?.poster_path}
          onResume={handleInfoResumeYes}
          onStart={handleInfoResumeNo}
          onDismiss={() => setShowInfoResumePrompt(false)}
        />
      )}

      {/* Cast Member Modal */}
      {selectedCastMember && (
        <CastMemberModal
          isOpen={!!selectedCastMember}
          onClose={() => setSelectedCastMember(null)}
          castMemberId={selectedCastMember.id}
          castMemberName={selectedCastMember.name}
          castMemberImage={selectedCastMember.image}
          castMemberCharacter={selectedCastMember.character}
        />
      )}
    </div>
  );
};


export default MovieDetailPage;
