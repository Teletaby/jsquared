"use client";

import { getTvShowDetails, ReviewsResponse, getCastDetails, CastDetails, CastMember, getMediaLogos } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import WatchlistButton from '@/components/WatchlistButton';
import Header from '@/components/Header';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EpisodeSelector from '@/components/EpisodeSelector';
import { formatDuration, getVideoSourceSetting, sourceNameToId, sourceIdToName, getExplicitSourceForMedia, setExplicitSourceForMedia } from '@/lib/utils';
import { Download, Play } from 'lucide-react';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';
import VideoInfoPopup from '@/components/VideoInfoPopup';
import MarkdownBoldText from '@/components/MarkdownBoldText';
import SourceWarningDialog from '@/components/SourceWarningDialog';
import AdvancedVideoPlayer from '@/components/AdvancedVideoPlayer';
import VideasyPlayer from '@/components/VideasyPlayer';
import VidLinkPlayer from '@/components/VidLinkPlayer';
import MoreInfoModal from '@/components/MoreInfoModal';
import { useAdvancedPlaytime } from '@/lib/hooks/useAdvancedPlaytime';


interface TvDetailPageProps {
  params: {
    id: string;
  };
}

interface MediaDetails {
  id: number;
  name?: string; // For TV shows
  overview: string;
  poster_path: string;
  backdrop_path?: string;
  vote_average: number;
  episode_run_time?: number[]; // For TV shows
  first_air_date?: string; // For TV shows
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id: string | null };
  seasons: {
    id: number;
    season_number: number;
    name: string;
    episode_count: number;
    poster_path: string;
  }[];
  reviews?: ReviewsResponse; // Added reviews property
}

const TvDetailPage = ({ params }: TvDetailPageProps) => {
  const [tvShow, setTvShow] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0); // Track current playback time for cross-source switching
  const [savedProgress, setSavedProgress] = useState<number>(0); // Track saved progress from history
  const [savedDuration, setSavedDuration] = useState<number>(0); // Track saved duration to clamp resume time
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoaded, setTrailerLoaded] = useState(false);
  const [trailerError, setTrailerError] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // const hasPlayedOnceRef = useRef(false); // Removed, handled by ThemedVideoPlayer
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [castInfo, setCastInfo] = useState<CastDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cast'>('overview');
  const [initialIsInWatchlist, setInitialIsInWatchlist] = useState<boolean | undefined>(undefined);
  const { data: session } = useSession();
  const { checkWatchlistStatus } = useWatchlist();
  const { queueUpdate } = useAdvancedPlaytime();
  const hasFetchedRef = useRef(false); // Track if initial fetch has completed
  // videoSource starts from localStorage when available to avoid flashes
  const [videoSource, setVideoSource] = useState<'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | null>(() => {
    try {
      const local = typeof window !== 'undefined' ? localStorage.getItem('lastUsedSource') : null;
      const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc'];
      if (local && allowed.includes(local)) return local as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc';
    } catch (e) {
      // ignore storage errors
    }
    return null;
  });

    // DISABLED: This defense mechanism was reverting manual source selections on TV page
    // useEffect(() => {
    //   try {
    //     const local = localStorage.getItem('lastUsedSource');
    //     const allowed = ['videasy', 'vidlink', 'vidnest', 'vidsrc'];
    //     if (local && allowed.includes(local) && videoSource === 'videasy' && local !== 'videasy') {
    //       console.log('[Client][DEFENSE] Reverting automatic videasy fallback to local lastUsedSource (TV page):', local);
    //       setVideoSource(local as 'videasy' | 'vidlink' | 'vidnest');
    //     }
    //   } catch (e) {
    //     // ignore
    //   }
    // }, [videoSource]);
  const [userLastSourceInfo, setUserLastSourceInfo] = useState<{ source?: string; at?: string | null } | null>(null);

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
  const [recommendations, setRecommendations] = useState<any[]>([]); // Fallback recs when details fail
  const [retrying, setRetrying] = useState(false);
  const lastMediaIdRef = useRef<number | null>(null); // Track last viewed media for source reset
  const [showResumePrompt, setShowResumePrompt] = useState(false); // Show continue watching prompt
  const [resumeChoice, setResumeChoice] = useState<'pending' | 'yes' | 'no'>('pending'); // User's choice
  const [notificationVisible, setNotificationVisible] = useState(true); // Control notification visibility
  const [showMoreInfoModal, setShowMoreInfoModal] = useState(false);
  const [episodeData, setEpisodeData] = useState<{ overview: string; name: string } | null>(null); // Store current episode data
  const [showEpisodeSynopsis, setShowEpisodeSynopsis] = useState(false); // Toggle episode synopsis display
  
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { id } = params;
  const tmdbId = parseInt(id);
  const view = searchParams.get('view'); // Read the 'view' query parameter

  // For TV page, mediaType should always be 'tv'
  const mediaType = 'tv';
  const currentSeason = searchParams.get('season') ? parseInt(searchParams.get('season')!, 10) : 1;
  const currentEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!, 10) : 1;



  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (showResumePrompt && notificationVisible) {
      const timer = setTimeout(() => {
        setNotificationVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResumePrompt, notificationVisible]);

  

  // Effect to reset state when media ID or episode changes
  useEffect(() => {
    // Do not force-reset the user's chosen source when media changes.
    // Users expect their preferred source to persist across content navigation.
    // Reset resume choice for new media or episode
    setResumeChoice('pending');
    setShowResumePrompt(false);
    lastMediaIdRef.current = tmdbId;
  }, [tmdbId, currentSeason, currentEpisode]);

  // Effect for fetching data
  useEffect(() => {
    const fetchData = async () => {
      // Skip refetch if data has already been fetched for this TV show
      if (hasFetchedRef.current && tvShow?.id === tmdbId) {
        return;
      }

      // Reset states for a new fetch
      setLoading(true);
      setError(null);
      setTvShow(null);
      setCastInfo(null); // Reset cast info as well
      setInitialIsInWatchlist(undefined); // Reset watchlist status
      setTrailerKey(null);
      setTrailerLoaded(false);
      setTrailerError(false);

      try {
        const [tvData, castData] = await Promise.all([
          getTvShowDetails(tmdbId),
          getCastDetails(mediaType, tmdbId), // Fetch cast details here
        ]);

        // Fetch trailer using the API endpoint that checks for age restrictions
        try {
          const trailerResponse = await fetch(`/api/trailer/${tmdbId}?mediaType=tv`);
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

        if (tvData && tvData.id) {
          setTvShow(tvData);
          setCastInfo(castData); // Set cast info
          hasFetchedRef.current = true; // Mark as fetched
          if (session?.user) {
            const status = await checkWatchlistStatus(tmdbId, mediaType);
            setInitialIsInWatchlist(status);
          }
        } else {
          setError('Could not find details for this TV show. It may not exist or there was an API error.');
        }
      } catch (e) {
        console.error("Failed to fetch TV show details or cast details:", e);
        setError('An unexpected error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tmdbId]); // Only depend on tmdbId to prevent unnecessary refetches

  // Fetch logo for the TV show
  useEffect(() => {
    const fetchLogo = async () => {
      if (tmdbId) {
        try {
          const imageData = await getMediaLogos('tv', tmdbId);
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

  // Separate effect to check watchlist status when session becomes available
  useEffect(() => {
    const checkStatus = async () => {
      if (session?.user && tvShow && initialIsInWatchlist === undefined) {
        const status = await checkWatchlistStatus(tmdbId, mediaType);
        setInitialIsInWatchlist(status);
      }
    };
    checkStatus();
  }, [session, tvShow, tmdbId, mediaType, checkWatchlistStatus, initialIsInWatchlist]);

  // Fetch saved watch progress - reset when episode changes
  useEffect(() => {
    // Reset progress when episode changes
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
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Returned watch history count:', data.length);
          // Find history for this specific episode (matching season AND episode)
          const tvHistory = data.find((item: any) => 
            item.mediaId === tmdbId && 
            item.mediaType === 'tv' &&
            item.seasonNumber === currentSeason &&
            item.episodeNumber === currentEpisode
          );
          if (tvHistory && tvHistory.currentTime > 0) {
            console.log('✅ FOUND! Progress:', tvHistory.currentTime, 's for S', currentSeason, 'E', currentEpisode);
            setSavedProgress(tvHistory.currentTime); // Keep full precision, no rounding
            setSavedDuration(tvHistory.totalDuration || 0);
            setCurrentPlaybackTime(tvHistory.currentTime);

            // Prefer the user's stored profile source over a watch-history item's recorded source.
            // Only fall back to the history item's source when no per-user preference exists and no explicit local selection is present.
            const qsSource = searchParams.get('source');
            if (!qsSource && tvHistory.source) {
              // Make a best-effort check with the server's stored user source (avoid race where history loads before server preference)
              let serverSource: string | undefined = userLastSourceInfo?.source;
              if (session?.user && !serverSource) {
                try {
                  const srcRes = await fetch('/api/user/source');
                  if (srcRes.ok) {
                    const sdata = await srcRes.json();
                    if (sdata?.source) {
                      serverSource = sdata.source;
                      setUserLastSourceInfo({ source: sdata.source, at: sdata.lastUsedSourceAt || null });
                      console.log('[Client] Fetched server user source while applying history fallback (tv):', serverSource);
                    }
                  }
                } catch (e) {
                  console.warn('[Client] Failed to fetch server user source during history handling (tv)', e);
                }
              }

              // If server has a stored source, prefer it over the history item's recorded source
              if (serverSource) {
                console.log('[Client] Server has preferred source; skipping watch-history source (tv):', serverSource);
              } else {
                const _id = sourceNameToId(tvHistory.source);
                console.log('[Client] No server/user profile source; using source from watch-history (tv):', _id ? `Source ${_id}` : 'unknown', { tvHistorySource: tvHistory.source, userLastSourceInfo });

                // Only use watch-history source if the user hasn't explicitly selected a source for THIS media in this tab
                let explicit = false;
                try {
                  explicit = !!getExplicitSourceForMedia(tmdbId, false);
                } catch (e) { explicit = false; }

                if (!explicit) {
                  console.log('[Client][DEBUG] Setting video source from history (tv)', { setTo: tvHistory.source, mediaId: tvHistory.mediaId });
                  setVideoSource(tvHistory.source);
                  setUserLastSourceInfo({ source: tvHistory.source, at: tvHistory.lastWatchedAt || null });

                  // Best-effort persist so future navigations pick this up in the user profile
                  try {
                    fetch('/api/user/source', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      /* intentionally not persisting automatic watch-history source to avoid overwriting explicit user preferences */
                      keepalive: true,
                    }).catch(() => {});
                  } catch (e) {
                    // ignore persistence failures
                  }
                } else {
                  console.log('[Client] Skipping applying/persisting watch-history source because explicit local selection exists (tv)');
                }
              }
            }
          } else {
            console.log('❌ NOT FOUND! Looking for S', currentSeason, 'E', currentEpisode, 'mediaId:', tmdbId);
            console.log('Available episodes:', data.filter((h: any) => h.mediaId === tmdbId && h.mediaType === 'tv').map((h: any) => `S${h.seasonNumber}E${h.episodeNumber}`));
          }
        } else {
          console.error('API ERROR! Status:', response.status);
        }
      } catch (error) {
        console.error('FETCH ERROR:', error);
      }
    };

    fetchWatchProgress();
  }, [session, tmdbId, currentSeason, currentEpisode]);

  // Fetch video source setting (but honor `?source=` query param if present)
  useEffect(() => {
    const fetchVideoSource = async () => {
      // If we've already got an explicit selection (and the user is logged in), use it and do not overwrite it
      try {
        if (session?.user) {
          const explicit = getExplicitSourceForMedia(tmdbId, false);
          if (explicit) {
            // explicit per-media selection exists; respect it and set the source immediately
            const name = explicit as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc';
            const explicitAt = sessionStorage.getItem(`jsc_explicit_source_at_${tmdbId}`);
            setVideoSource(name);
            setUserLastSourceInfo({ source: name, at: explicitAt || null });
            return;
          }
        }
      } catch (e) {
        // ignore storage errors
      }

      // If the URL includes a source override, trust it and do not fetch/overwrite from server
      const qsSource = searchParams.get('source');
      if (qsSource) {
        // Accept numeric ids as well as names
        const name = sourceIdToName(qsSource) || (['videasy','vidlink','vidnest','vidsrc'].includes(qsSource) ? qsSource : undefined);
        if (name) {
          const qsId = sourceNameToId(name);
          console.log('[Client] Source query param detected on TV page; skipping server fetch and setting source to:', qsId ? `Source ${qsId}` : 'unknown');
          setVideoSource(name as 'videasy' | 'vidlink' | 'vidnest');
          setUserLastSourceInfo({ source: name, at: new Date().toISOString() });
          return;
        }
      }

      // Prefer per-user saved source if available (only when logged in), otherwise fall back to global setting
      if (session?.user) {
        try {
          const res = await fetch('/api/user/source');
          if (res.ok) {
            const data = await res.json();
            console.log('[Client] /api/user/source returned:', data);
            if (data?.source) {
              // Only set if we don't have an explicit selection saved locally for this media
              try {
                const explicit = getExplicitSourceForMedia(tmdbId, false);
                if (!explicit) {
                  setVideoSource(data.source);
                  setUserLastSourceInfo({ source: data.source, at: data.lastUsedSourceAt || null });
                } else {
                  console.log('[Client] Skipping server source because explicit local selection exists for this media');
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
      }

      const source = await getVideoSourceSetting();
      setVideoSource(source);
    };
    // Re-run when session changes or query params change (so a resume link can override)
    fetchVideoSource();
  }, [session?.user?.email, searchParams]);

  // Automatically resume if saved progress exists (no prompt needed)
  useEffect(() => {
    if (savedProgress > 0 && resumeChoice === 'pending') {
      console.log('📺 Auto-resuming from', savedProgress, 'seconds');
      setResumeChoice('yes');
    }
  }, [savedProgress, resumeChoice]);


  // Construct embed URL with useMemo to prevent unnecessary changes
  const embedUrl = useMemo(
    () => {
      if (videoSource === 'vidnest') {
        return `https://vidnest.fun/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
      } else if (videoSource === 'vidsrc') {
        return `https://vidsrc.icu/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
      } else {
        // For videasy and vidlink sources, we use dedicated player components
        // This is handled by the VideasyPlayer component
        return null; // We'll use VideasyPlayer or VidLinkPlayer instead
      }
    },
    [tmdbId, currentSeason, currentEpisode, videoSource]
  );
  const videoSrc = embedUrl; // Use videoSrc for ThemedVideoPlayer

  // Fetch episode data for episode synopsis display
  useEffect(() => {
    const fetchEpisodeData = async () => {
      try {
        const res = await fetch(`/api/tv/${tmdbId}/seasons`);
        if (res.ok) {
          const data = await res.json();
          const season = data.seasons?.find((s: any) => s.season_number === currentSeason);
          const episode = season?.episodes?.find((e: any) => e.episode_number === currentEpisode);
          
          if (episode) {
            setEpisodeData({
              overview: episode.overview || 'No synopsis available for this episode.',
              name: episode.name || `Episode ${currentEpisode}`
            });
          }
        }
      } catch (error) {
        console.error('Error fetching episode data:', error);
      }
    };

    if (tmdbId) {
      fetchEpisodeData();
    }
  }, [tmdbId, currentSeason, currentEpisode]);

  const handleEpisodeSelect = (seasonNum: number, episodeNum: number) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set('season', seasonNum.toString());
    newSearchParams.set('episode', episodeNum.toString());
    router.push(`?${newSearchParams.toString()}`, { scroll: false });
    setShowEpisodeSelector(false);
  };


  // Define change source handler BEFORE conditional returns so buttons and capture-useEffect can call it safely
  const handleChangeSource = async (source: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc') => {
    try {
      const reqId = sourceNameToId(source);
      const curId = sourceNameToId(videoSource);
      console.log('[Client] handleChangeSource called', { requested: reqId ? `Source ${reqId}` : 'unknown', current: curId ? `Source ${curId}` : 'unknown' });
    } catch (e) {
      // ignore logging errors
    }

    if (videoSource === source) return; // Already on this source

    // Optimistically set the source immediately
    setVideoSource(source);
    setUserLastSourceInfo({ source, at: new Date().toISOString() });
    
    // Only persist when user is logged in. If not logged in, behave like normal player (no persistence).
    if (session?.user) {
      try { sessionStorage.setItem('jsc_explicit_source', source); sessionStorage.setItem('jsc_explicit_source_at', new Date().toISOString()); } catch (e) { /* ignore */ }

      try {
        const res = await fetch('/api/user/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, explicit: true, at: new Date().toISOString() }),
        });
        if (!res.ok) {
          console.warn('Failed to persist user source selection (status)', res.status);
          // Don't revert the source - it's already been applied optimistically in the UI
        } else {
          const persistedId = sourceNameToId(source);
          console.log('[Client] Source persisted on server:', persistedId ? `Source ${persistedId}` : 'unknown');
        }
      } catch (e) {
        console.warn('Failed to persist user source selection', e);
        // Don't revert the source - it's already been applied optimistically in the UI
      }

      try { localStorage.setItem('lastUsedSource', source); } catch (e) {}
    } else {
      // Not logged in: do not persist; keep change in-memory only
      console.log('[Client] User not logged in — applying source change in-memory only');
    }
  };

  // Capture-phase fallback for TV page as well
  // DISABLED: This was causing double-clicks and incorrect source detection. The direct onClick handlers are sufficient.
  // Placed before conditional returns to avoid hook-order mismatches
  /*
  useEffect(() => {
    const onCaptureClick = (e: MouseEvent) => {
      try {
        const x = e.clientX;
        const y = e.clientY;
        const el = document.elementFromPoint(x, y);
        if (el && (el as Element).closest && (el as Element).closest('button[data-source-button]')) return;
        const buttons = Array.from(document.querySelectorAll('button[data-source-button]')) as HTMLButtonElement[];
        for (const b of buttons) {
          const r = b.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            const src = b.getAttribute('data-source-button') as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | null;
            if (src && src !== videoSource) {
              const cfId = sourceNameToId(src);
              console.log('[Client] TV page capture fallback triggered for source:', cfId ? `Source ${cfId}` : 'unknown');
              void handleChangeSource(src);
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
  }, [videoSource]);
  */

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

  if (!tvShow) {
    return null; // Or a "Not Found" component
  }

  const mediaTitle = tvShow?.name || 'Untitled Show';






  return (
    <div style={{ backgroundColor: '#121212' }} className="text-white min-h-screen">
      {/* Preload VIDEASY, VidLink and VIDNEST for faster loading (temporarily commented out during debug) */}
      {/* <link rel="dns-prefetch" href="https://player.videasy.net" /> */}
      {/* <link rel="preconnect" href="https://player.videasy.net" /> */}
      {/* <link rel="dns-prefetch" href="https://vidlink.pro" /> */}
      {/* <link rel="preconnect" href="https://vidlink.pro" /> */}
      {/* <link rel="dns-prefetch" href="https://vidnest.fun" /> */}
      {/* <link rel="preconnect" href="https://vidnest.fun" /> */}

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
          {/* Hero Section */}
          <div className="relative h-screen flex flex-col justify-center overflow-hidden">
            {/* Backdrop Image - always shown first as base layer (touches navbar and sits behind it) */}
            {tvShow?.backdrop_path && (
              <img
                src={`https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}`}
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
                <iframe                  id="trailerPlayer"                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${trailerKey}&start=5&showinfo=0&rel=0`}
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  onLoad={() => setTrailerLoaded(true)}
                  onError={() => setTrailerError(true)}
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full"
                  style={{ 
                    pointerEvents: 'none', 
                    transform: 'translate(-50%, -50%) scale(1.5)',
                    width: '177.78vh',
                    height: '100vh',
                    border: 'none'
                  }}
                ></iframe>
              </div>
            )}
            
            {/* Fade Overlay - sits above backdrop/trailer but below content */}
            <div className="absolute top-0 left-0 w-screen h-full bg-gradient-to-b from-black/30 via-black/50 to-[#121212] pointer-events-none z-10"></div>

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
                    {typeof tvShow.vote_average === 'number' && tvShow.vote_average > 0 ? (
                      <span className="text-base md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white">{tvShow.vote_average.toFixed(1)}</span>
                    ) : (
                      <span className="text-base md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-gray-400">—</span>
                    )}
                  </div>
                  
                  {tvShow.first_air_date && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">FIRST AIRED</span>
                      <span className="text-xs md:text-sm lg:text-lg xl:text-xl 2xl:text-2xl font-bold text-white">{new Date(tvShow.first_air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}

                  {tvShow.episode_run_time && tvShow.episode_run_time.length > 0 && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">EPISODE AVG</span>
                      <span className="text-xs md:text-sm lg:text-lg xl:text-xl 2xl:text-2xl font-bold text-white">{formatDuration(tvShow.episode_run_time[0])}</span>
                    </div>
                  )}

                  {tvShow.seasons && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">SEASONS</span>
                      <span className="text-xs md:text-sm lg:text-lg font-bold text-white">{tvShow.seasons.length}</span>
                    </div>
                  )}

                  {tvShow.first_air_date && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs lg:text-sm text-gray-400 uppercase">STATUS</span>
                      <span className="text-xs md:text-sm lg:text-lg font-bold text-white">
                        {(() => {
                          const firstAirDate = new Date(tvShow.first_air_date);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          firstAirDate.setHours(0, 0, 0, 0);
                          return firstAirDate > today ? 'Unreleased' : 'Released';
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Genres */}
                {tvShow.genres && tvShow.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tvShow.genres.map((genre) => (
                      <span
                        key={genre.id}
                        className="text-xs md:text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-300 font-medium"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                {tvShow.overview && (
                  <p className="text-gray-300 text-xs md:text-xs lg:text-sm xl:text-base 2xl:text-lg leading-relaxed mb-3 max-w-xl drop-shadow-lg line-clamp-2">{tvShow.overview}</p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => {
                      // Do NOT include source or time in the URL. Persist user's chosen source only when logged in.
                      (async () => {
                        try {
                          // Prefer server-stored user source to avoid accidentally persisting a transient history source
                          let serverSource = userLastSourceInfo?.source;
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
                              try { setExplicitSourceForMedia(tmdbId, resolvedSource); console.log('[Client] Set per-media explicit source from click (tv):', { mediaId: tmdbId, source: resolvedSource }); } catch(e) {}

                              console.log('[Client] Persisted explicit user source for media (per-media) from click:', resolvedSource);

                              // If user explicitly chose VIDNEST and we have saved progress, persist that as an immediate watch-history entry
                              try {
                                if (resolvedSource === 'vidnest' && typeof savedProgress === 'number' && savedProgress > 0) {
                                  console.log('[Client] Persisting savedProgress to watch-history for Source 3:', savedProgress);
                                  fetch('/api/watch-history', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ mediaId: tmdbId, mediaType, currentTime: savedProgress, totalDuration: savedDuration || 0, progress: (savedDuration ? (savedProgress / Math.max(savedDuration,1)) * 100 : 0), immediate: true, source: resolvedSource, title: mediaTitle, posterPath: tvShow?.poster_path, seasonNumber: currentSeason, episodeNumber: currentEpisode }),
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
                      })();

                      // include current season/episode in the watch link (but not source/time)
                      try {
                        const s = Number(currentSeason || 1);
                        const e = Number(currentEpisode || 1);
                        const params = new URLSearchParams();
                        if (!Number.isNaN(s)) params.set('season', String(s));
                        if (!Number.isNaN(e)) params.set('episode', String(e));
                        const query = params.toString();
                        // Navigate to the watch page without exposing source/time in the URL
                        router.push(`/${mediaType}/${tmdbId}${query ? '?' + query : ''}`);
                      } catch (err) {
                        // Fallback navigation if something goes wrong
                        router.push(`/${mediaType}/${tmdbId}`);
                      }
                    }}
                    disabled={tvShow.first_air_date ? new Date(tvShow.first_air_date) > new Date() : false}
                    style={{ 
                      backgroundColor: tvShow.first_air_date && new Date(tvShow.first_air_date) > new Date() ? '#666666' : '#E50914'
                    }}
                    className={`text-white font-bold py-2 px-6 md:py-3 md:px-8 lg:py-4 lg:px-10 xl:py-5 xl:px-12 2xl:py-6 2xl:px-16 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl shadow-lg ${
                      tvShow.first_air_date && new Date(tvShow.first_air_date) > new Date()
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:brightness-110'
                    }`}
                  >
                    <Play size={16} /> {tvShow.first_air_date && new Date(tvShow.first_air_date) > new Date() ? 'Coming Soon' : 'Watch'}
                  </button>
                  <button
                    onClick={() => setShowMoreInfoModal(true)}
                    className="text-white font-bold py-2 px-6 md:py-3 md:px-8 lg:py-4 lg:px-10 xl:py-5 xl:px-12 2xl:py-6 2xl:px-16 rounded-lg transition-all duration-300 border-2 border-white hover:bg-white/10 text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl"
                  >
                    More Info
                  </button>
                  <div>
                    <WatchlistButton
                      mediaId={tmdbId}
                      mediaType={mediaType}
                      title={mediaTitle}
                      posterPath={tvShow.poster_path}
                      rating={tvShow.vote_average}
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
            <div style={{ backgroundColor: '#1A1A1A' }} className="flex gap-2 border-b border-gray-700 rounded-t-lg p-2">
              <button
                onClick={() => setActiveTab('overview')}
                style={{ backgroundColor: activeTab === 'overview' ? '#E50914' : 'transparent' }}
                className={`py-3 px-6 font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Overview & Reviews
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
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                {tvShow.overview && (
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-4 text-white">SYNOPSIS</h2>
                    <p className="text-gray-400 leading-relaxed">{tvShow.overview}</p>
                  </div>
                )}

                {/* Genres */}
                {tvShow.genres && tvShow.genres.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2 font-semibold">GENRES</p>
                    <div className="flex flex-wrap gap-2">
                      {tvShow.genres.map((genre) => (
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

                {/* Reviews Section */}
                {tvShow.reviews && tvShow.reviews.results.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6">REVIEWS ({tvShow.reviews.results.length})</h2>
                    <div className="space-y-4">
                      {tvShow.reviews.results.slice(0, 5).map((review) => (
                        <div key={review.id} style={{ backgroundColor: '#0A0A0A' }} className="p-4 rounded border border-gray-700">
                          <div className="flex items-start gap-4 mb-4">
                            {review.author_details.avatar_path ? (
                              <Image
                                src={review.author_details.avatar_path.startsWith('/https')
                                  ? review.author_details.avatar_path.substring(1)
                                  : `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`}
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
                  </div>
                )}
              </div>
            )}

            {/* Cast Tab */}
            {activeTab === 'cast' && castInfo && castInfo.cast.length > 0 && (
              <div style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                <h2 className="text-2xl font-bold mb-6">CAST ({castInfo.cast.length})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {castInfo.cast.slice(0, 15).map((member) => (
                    <div key={member.id} className="group cursor-pointer">
                      <div style={{ backgroundColor: '#0A0A0A' }} className="relative overflow-hidden rounded mb-3 border border-gray-700 group-hover:border-gray-500 transition-all">
                        {member.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                            alt={member.name}
                            width={185}
                            height={278}
                            className="w-full h-auto group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-zinc-800 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">No Image</span>
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-sm text-white truncate group-hover:text-blue-400 transition-colors">{member.name}</p>
                      <p className="text-gray-500 text-xs truncate">{member.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 mt-16">
        {view !== 'info' && (
          <>
          {/* Player Section - Appears at top when watching */}
          <div className="space-y-8 mb-8">
            {/* Video Player - embedded players used directly */}
            {videoSource === 'videasy' ? (
              <VideasyPlayer
                key={`${tmdbId}-S${currentSeason}E${currentEpisode}-videasy`}
                mediaId={tmdbId}
                mediaType={mediaType}
                title={`${mediaTitle} - Season ${currentSeason} Episode ${currentEpisode}`}
                posterPath={tvShow?.poster_path}
                seasonNumber={currentSeason}
                episodeNumber={currentEpisode}
                initialTime={currentPlaybackTime || savedProgress}
                onTimeUpdate={(time) => {
                  setCurrentPlaybackTime(time);
                  const episodeRuntime = tvShow?.episode_run_time?.[0] || 45;
                  const totalSeconds = Math.max(episodeRuntime * 60, 1);
                  const progress = Math.min((time / totalSeconds) * 100, 100);
                  console.log(`📺 TV Progress Update: ${time}s / ${totalSeconds}s = ${progress.toFixed(1)}%`);
                  queueUpdate({
                    mediaId: tmdbId,
                    mediaType,
                    title: mediaTitle,
                    currentTime: time,
                    totalDuration: totalSeconds,
                    progress: progress,
                    posterPath: tvShow?.poster_path,
                    seasonNumber: currentSeason,
                    episodeNumber: currentEpisode,
                    source: videoSource,
                  });
                }}
              />
            ) : videoSource === 'vidlink' ? (
              <VidLinkPlayer
                key={`${tmdbId}-S${currentSeason}E${currentEpisode}-vidlink`}
                mediaId={tmdbId}
                mediaType={mediaType}
                title={`${mediaTitle} - Season ${currentSeason} Episode ${currentEpisode}`}
                posterPath={tvShow?.poster_path}
                seasonNumber={currentSeason}
                episodeNumber={currentEpisode}
                initialTime={currentPlaybackTime || savedProgress}
                onTimeUpdate={(time) => {
                  setCurrentPlaybackTime(time);
                  const episodeRuntime = tvShow?.episode_run_time?.[0] || 45;
                  const totalSeconds = Math.max(episodeRuntime * 60, 1);
                  const progress = Math.min((time / totalSeconds) * 100, 100);
                  console.log(`📺 TV Progress Update: ${time}s / ${totalSeconds}s = ${progress.toFixed(1)}%`);
                  queueUpdate({
                    mediaId: tmdbId,
                    mediaType,
                    title: mediaTitle,
                    currentTime: time,
                    totalDuration: totalSeconds,
                    progress: progress,
                    posterPath: tvShow?.poster_path,
                    seasonNumber: currentSeason,
                    episodeNumber: currentEpisode,
                    source: videoSource,
                  });
                }}
              />
            ) : videoSrc ? (
              <AdvancedVideoPlayer
                key={`${tmdbId}-S${currentSeason}E${currentEpisode}-${resumeChoice}`}
                embedUrl={videoSrc}
                title={`${mediaTitle} - Season ${currentSeason} Episode ${currentEpisode}`}
                mediaId={tmdbId}
                mediaType={mediaType}
                posterPath={tvShow?.poster_path}
                seasonNumber={currentSeason}
                episodeNumber={currentEpisode}
                initialTime={currentPlaybackTime || savedProgress}
                videoSource={videoSource}
                onTimeUpdate={(time) => {
                  setCurrentPlaybackTime(time);
                  const episodeRuntime = tvShow?.episode_run_time?.[0] || 45;
                  const totalSeconds = Math.max(episodeRuntime * 60, 1);
                  const progress = Math.min((time / totalSeconds) * 100, 100);
                  console.log(`📺 TV Progress Update: ${time}s / ${totalSeconds}s = ${progress.toFixed(1)}%`);
                  queueUpdate({
                    mediaId: tmdbId,
                    mediaType,
                    title: mediaTitle,
                    currentTime: time,
                    totalDuration: totalSeconds,
                    progress: progress,
                    posterPath: tvShow?.poster_path,
                    seasonNumber: currentSeason,
                    episodeNumber: currentEpisode,
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
          </div>
          </>
        )}

        {view !== 'info' && (
        <div className="grid grid-cols-1 gap-6">
          {/* Details */}
          <div className="space-y-6">
            {/* Title Section with Download Button */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-start sm:items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white break-words">
                    {mediaTitle}
                  </h1>
                  <VideoInfoPopup />
                </div>
              </div>
              <a
                href={`https://dl.vidsrc.vip/tv/${tmdbId}/${currentSeason}/${currentEpisode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300 hover:bg-gray-700/30 flex items-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                <Download size={16} /> Download
              </a>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3 relative z-50 pointer-events-auto">
              {view !== 'info' ? (
                <>
                  <button
                    onClick={() => setShowEpisodeSelector(true)}
                    style={{ backgroundColor: '#E50914' }}
                    className="text-white font-bold py-2 sm:py-3 px-3 sm:px-6 text-sm sm:text-base rounded transition-all duration-300 hover:brightness-110"
                  >
                    Select Episode (S{currentSeason}E{currentEpisode})
                  </button>
                  <button
                    data-source-button="videasy"
                    onClick={() => handleChangeSource('videasy')}
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
                    onClick={() => handleChangeSource('vidlink')}
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
                    onClick={() => handleChangeSource('vidnest')}
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
                    onClick={() => handleChangeSource('vidsrc')}
                    className={`relative z-40 pointer-events-auto font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'vidsrc'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Source 4 {videoSource === 'vidsrc' && '✓'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    // Do NOT include source or time in the URL. Persist user's chosen source only when logged in.
                    if (videoSource && session?.user) {
                      try { sessionStorage.setItem('jsc_explicit_source', videoSource); sessionStorage.setItem('jsc_explicit_source_at', new Date().toISOString()); } catch(e){}
                      fetch('/api/user/source', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ source: videoSource, explicit: true, at: new Date().toISOString() }),
                        keepalive: true,
                      }).catch(() => {});
                    }

                    try {
                      const s = Number(currentSeason || 1);
                      const e = Number(currentEpisode || 1);
                      const params = new URLSearchParams();
                      if (!Number.isNaN(s)) params.set('season', String(s));
                      if (!Number.isNaN(e)) params.set('episode', String(e));
                      const query = params.toString();
                      router.push(`/${mediaType}/${tmdbId}${query ? '?' + query : ''}`);
                    } catch (e) {
                      router.push(`/${mediaType}/${tmdbId}`);
                    }
                  }}
                  style={{ backgroundColor: '#E50914' }}
                  className="text-white font-bold py-2 sm:py-3 px-3 sm:px-6 text-sm sm:text-base rounded transition-all duration-300 hover:brightness-110"
                >
                  Watch Now
                </button>
              )}
              <WatchlistButton
                mediaId={tmdbId}
                mediaType={mediaType}
                title={mediaTitle}
                posterPath={tvShow.poster_path}
                rating={tvShow.vote_average}
                initialIsInWatchlist={initialIsInWatchlist}
              />
            </div>

            {/* VIDNEST Adblocker Disclaimer */}
            {videoSource === 'vidnest' && (
              <div className="bg-blue-900 bg-opacity-40 border border-blue-600 rounded p-3">
                <p className="text-blue-300 text-xs sm:text-sm">
                  💡 <strong>Tip:</strong> Source 3 may have more ads. Please enable an adblocker for a better viewing experience.
                </p>
              </div>
            )}

            {/* VIDSRC Warning */}
            {videoSource === 'vidsrc' && (
              <div className="bg-yellow-900 bg-opacity-40 border border-yellow-600 rounded p-3">
                <p className="text-yellow-300 text-xs sm:text-sm">
                  ⚠️ <strong>Note:</strong> Some selections may not be accurate. If you encounter issues, try switching to another source. {session?.user && 'Timestamps are not stored for this source.'}
                </p>
              </div>
            )}

            {/* Rating and Quick Info */}
            <div className="text-gray-400">
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-base">
                {typeof tvShow.vote_average === 'number' && tvShow.vote_average > 0 && (
                  <span className="font-semibold">Rating: {tvShow.vote_average.toFixed(1)}</span>
                )}
                {tvShow.first_air_date && (
                  <span>First Air: {new Date(tvShow.first_air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                )}
                {tvShow.episode_run_time && tvShow.episode_run_time.length > 0 && (
                  <span>Episode Avg: {formatDuration(tvShow.episode_run_time[0])}</span>
                )}
              </div>
            </div>

            {/* Tab Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('overview')}
                style={{ backgroundColor: activeTab === 'overview' ? '#E50914' : 'transparent' }}
                className={`font-bold py-3 px-6 rounded transition-all ${
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
                className={`font-bold py-3 px-6 rounded transition-all ${
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
                {tvShow.genres && tvShow.genres.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2 font-semibold">GENRES</p>
                    <div className="flex flex-wrap gap-2">
                      {tvShow.genres.map((genre) => (
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
                <div>
                  <h2 className={`text-xl font-bold mb-3 text-white ${currentEpisode === 1 ? 'cursor-pointer hover:text-gray-300' : ''}`}
                      onClick={() => currentEpisode === 1 && setShowEpisodeSynopsis(!showEpisodeSynopsis)}
                  >
                    {currentEpisode === 1 ? '📺 SYNOPSIS (Click to toggle episode info)' : `📺 SYNOPSIS FOR EPISODE ${currentEpisode}`}
                  </h2>
                  {/* Show episode synopsis if viewing episode 1 and synopsis is toggled on, or for any other episode */}
                  {(currentEpisode === 1 && showEpisodeSynopsis) || currentEpisode !== 1 ? (
                    <>
                      {episodeData && (
                        <div className="mb-4 p-4 border border-gray-700 rounded bg-gray-900/50">
                          <p className="text-sm text-gray-400 font-semibold mb-2">Episode {currentEpisode}: {episodeData.name}</p>
                          <p className="text-gray-400 leading-relaxed">{episodeData.overview}</p>
                        </div>
                      )}
                    </>
                  ) : null}
                  {/* Show show synopsis for episode 1 when not toggled */}
                  {currentEpisode === 1 && !showEpisodeSynopsis && (
                    <p className="text-gray-400 leading-relaxed">{tvShow.overview}</p>
                  )}
                  {/* For other episodes, also show the show synopsis below */}
                  {currentEpisode !== 1 && (
                    <>
                      <p className="text-gray-400 leading-relaxed mb-4">{tvShow.overview}</p>
                    </>
                  )}
                </div>

                {/* Reviews Section */}
                {tvShow.reviews && tvShow.reviews.results.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4 text-white">TOP REVIEWS</h2>
                    <div className="space-y-4">
                      {tvShow.reviews.results.slice(0, 3).map((review) => (
                        <div key={review.id} style={{ backgroundColor: '#1A1A1A' }} className="p-4 rounded border border-gray-700">
                          <div className="flex items-start gap-3 mb-3">
                            {review.author_details.avatar_path ? (
                              <Image
                                src={review.author_details.avatar_path.startsWith('/https')
                                  ? review.author_details.avatar_path.substring(1)
                                  : `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`}
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
            {activeTab === 'cast' && castInfo && castInfo.cast.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-white">CAST</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {castInfo.cast.slice(0, 12).map((member: CastMember) => (
                    <div key={member.id} className="group">
                      <div className="relative overflow-hidden rounded mb-2 bg-gray-800">
                        {member.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                            alt={member.name}
                            width={185}
                            height={278}
                            className="w-full h-auto group-hover:brightness-110 transition-all duration-300"
                          />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center text-xs text-gray-500">No Image</div>
                        )}
                      </div>
                      <p className="font-semibold text-white text-sm truncate">{member.name}</p>
                      <p className="text-gray-500 text-xs truncate">{member.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {showEpisodeSelector && (
          <EpisodeSelector
            tvShowId={id}
            showTitle={mediaTitle}
            posterPath={tvShow.poster_path}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            onClose={() => setShowEpisodeSelector(false)}
            onEpisodeSelect={handleEpisodeSelect}
          />
        )}
        <MoreInfoModal
          isOpen={showMoreInfoModal}
          onClose={() => setShowMoreInfoModal(false)}
          title={mediaTitle}
          tagline={(tvShow as any)?.tagline}
          description={tvShow?.overview}
        />
      </div>
    </div>
  );
};

export default TvDetailPage;

