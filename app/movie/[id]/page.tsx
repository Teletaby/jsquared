"use client";

import { getMovieDetails, ReviewsResponse, CastMember, getCastDetails, getMovieVideos, getMediaLogos } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import WatchlistButton from '@/components/WatchlistButton';
import Header from '@/components/Header';
import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { formatDuration, getVideoSourceSetting } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';
import MarkdownBoldText from '@/components/MarkdownBoldText';
import SourceWarningDialog from '@/components/SourceWarningDialog';

// Lazy load the video player for better performance
const ThemedVideoPlayer = dynamic(() => import('@/components/ThemedVideoPlayer'), {
  loading: () => <div className="w-full h-[600px] bg-gray-900 flex items-center justify-center rounded-lg"><div className="text-gray-400">Loading player...</div></div>,
  ssr: false,
});

import VideoInfoPopup from '@/components/VideoInfoPopup';

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

const MovieDetailPage = ({ params }: MovieDetailPageProps) => {
  const [movie, setMovie] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);
  const [savedProgress, setSavedProgress] = useState<number>(0); // Track saved progress from history
  const [savedDuration, setSavedDuration] = useState<number>(0); // Track saved duration to clamp resume time
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoaded, setTrailerLoaded] = useState(false);
  const [trailerError, setTrailerError] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // const hasPlayedOnceRef = useRef(false); // Removed, handled by ThemedVideoPlayer
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const [activeTab, setActiveTab] = useState<'overview' | 'cast'>('overview');
  const [initialIsInWatchlist, setInitialIsInWatchlist] = useState<boolean | undefined>(undefined);
  const { data: session } = useSession();
  const { checkWatchlistStatus } = useWatchlist();
  const hasFetchedRef = useRef(false); // Track if initial fetch has completed
  const [videoSource, setVideoSource] = useState<'vidking' | 'vidsrc'>('vidking');
  const [showSourceWarning, setShowSourceWarning] = useState(false);
  const [pendingSource, setPendingSource] = useState<'vidsrc' | null>(null);
  const lastMediaIdRef = useRef<number | null>(null); // Track last viewed media for source reset
  const [showResumePrompt, setShowResumePrompt] = useState(false); // Show continue watching prompt
  const [resumeChoice, setResumeChoice] = useState<'pending' | 'yes' | 'no'>('pending'); // User's choice
  const [notificationVisible, setNotificationVisible] = useState(true); // Control notification visibility
  
  const { id } = params;
  const tmdbId = parseInt(id);
  const mediaType = 'movie'; // Define mediaType for watch history

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (showResumePrompt && notificationVisible) {
      const timer = setTimeout(() => {
        setNotificationVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResumePrompt, notificationVisible]);

  // Effect to reset player state when content changes - no longer needed here
  // useEffect(() => {
  //   hasPlayedOnceRef.current = false;
  //   setIsPaused(false);
  // }, [tmdbId]);

  // Effect for handling player events from the iframe - no longer needed
  // useEffect(() => {
  //   const handlePlayerMessage = (event: MessageEvent) => {
  //     try {
  //       const message = JSON.parse(event.data);
  //       if (message.type === 'PLAYER_EVENT') {
  //         if (message.data.event === 'play') {
  //           setIsPaused(false);
  //           hasPlayedOnceRef.current = true; // Mark that playback has successfully started
  //         } else if (message.data.event === 'pause') {
  //           // Only show the PAUSED overlay if the video has played at least once.
  //           // This prevents the overlay from showing if autoplay is blocked on load.
  //           if (hasPlayedOnceRef.current) {
  //             setIsPaused(true);
  //           }
  //         }
  //       }
  //     } catch (error) {
  //       // Ignore errors from non-player messages
  //     }
  //   };

  //   window.addEventListener("message", handlePlayerMessage);

  //   return () => {
  //     window.removeEventListener("message", handlePlayerMessage);
  //   };
  // }, []); // This effect should only run once to set up the listener

  // Effect to reset state when media ID changes
  useEffect(() => {
    if (lastMediaIdRef.current !== null && lastMediaIdRef.current !== tmdbId) {
      // Media has changed, reset to default source
      setVideoSource('vidking');
      // Reset resume choice for new media
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

  // Fetch saved watch progress - reset on new movie
  useEffect(() => {
    // Reset progress when movie changes
    setSavedProgress(0);
    setSavedDuration(0);
    setCurrentPlaybackTime(0);
    
    if (!session?.user) return;

    const fetchWatchProgress = async () => {
      try {
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data = await response.json();
          console.log('All watch history:', data);
          const movieHistory = data.find((item: any) => item.mediaId === tmdbId && item.mediaType === 'movie');
          console.log('Movie history for ID', tmdbId, ':', movieHistory);
          if (movieHistory && movieHistory.currentTime > 0) {
            console.log('Setting savedProgress to:', movieHistory.currentTime, 'progress:', movieHistory.progress);
            setSavedProgress(Math.floor(movieHistory.currentTime));
            setSavedDuration(movieHistory.totalDuration || 0);
            setCurrentPlaybackTime(movieHistory.currentTime);
          } else {
            console.log('No saved progress found for movie', tmdbId);
          }
        }
      } catch (error) {
        console.error('Error fetching watch progress:', error);
      }
    };

    fetchWatchProgress();
  }, [session, tmdbId]);

  // Fetch video source setting
  useEffect(() => {
    const fetchVideoSource = async () => {
      const source = await getVideoSourceSetting();
      setVideoSource(source);
    };
    fetchVideoSource();
  }, []);

  // Show resume prompt when we have saved progress and user hasn't made a choice yet
  useEffect(() => {
    if (savedProgress > 0 && resumeChoice === 'pending') {
      setShowResumePrompt(true);
    }
  }, [savedProgress, resumeChoice]);

  // Handle resume choice
  const handleResumeYes = () => {
    setResumeChoice('yes');
    setShowResumePrompt(false);
  };

  const handleResumeNo = () => {
    setResumeChoice('no');
    setShowResumePrompt(false);
  };

  // Construct embed URL with useMemo to prevent unnecessary changes
  const embedUrl = useMemo(
    () => {
      if (videoSource === 'vidsrc') {
        return `https://vidsrc.icu/embed/movie/${tmdbId}`;
      } else {
        let url = `https://www.vidking.net/embed/movie/${tmdbId}?color=cccccc&autoPlay=true`;
        // Add progress parameter if user chose to resume
        if (resumeChoice === 'yes' && savedProgress > 0) {
          url += `&progress=${Math.floor(savedProgress)}`;
        }
        return url;
      }
    },
    [tmdbId, videoSource, resumeChoice, savedProgress]
  );
  const videoSrc = embedUrl;

  // Format saved progress for display
  const formatProgressTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const posterUrl = useMemo(
    () => movie?.poster_path 
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
      : '/placeholder.png',
    [movie?.poster_path]
  );

  if (loading) {
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

  const imdbId = movie.external_ids?.imdb_id;

  // Centralize title logic to handle optional properties and provide a fallback.
  const mediaTitle = movie.title || 'Untitled Movie';
  
  const handleChangeSource = async () => {
    // If already on source 2, toggle back to source 1
    if (videoSource === 'vidsrc') {
      setVideoSource('vidking');
      return;
    }

    // Otherwise, try to switch to source 2
    // If user is logged in and switching to source 2, show warning
    if (session) {
      setPendingSource('vidsrc');
      setShowSourceWarning(true);
    } else {
      // If not logged in, just switch without warning
      setVideoSource('vidsrc');
    }
  };

  const handleConfirmSourceChange = () => {
    if (pendingSource) {
      setVideoSource(pendingSource);
      setPendingSource(null);
    }
    setShowSourceWarning(false);
  };

  const handleCancelSourceChange = () => {
    setPendingSource(null);
    setShowSourceWarning(false);
  };

  const handleWatchOnTv = () => {
    if (embedUrl) {
      router.push(`/receiver?videoSrc=${encodeURIComponent(embedUrl)}`);
    }
  };

  return (
    <div style={{ backgroundColor: '#121212' }} className="text-white min-h-screen">
      {/* Preload vidking.net for faster video loading */}
      <link rel="dns-prefetch" href="https://www.vidking.net" />
      <link rel="preconnect" href="https://www.vidking.net" />
      <link rel="preload" as="frame" href={embedUrl} />
      
      {/* Source Warning Dialog */}
      <SourceWarningDialog
        isOpen={showSourceWarning}
        onConfirm={handleConfirmSourceChange}
        onCancel={handleCancelSourceChange}
      />

      <Header />

      {view === 'info' && (
        <>
          {/* Hero Section with Trailer Background */}
          <div className="relative h-screen flex flex-col justify-center overflow-hidden mt-16">
            {/* Backdrop Image - always shown first as base layer */}
            {movie?.backdrop_path && (
              <img
                src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
                alt="backdrop"
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            )}

            {/* Trailer Video Background - fades in on top of backdrop */}
            {trailerKey && !trailerError && (
              <div 
                className="absolute top-0 left-0 w-screen h-full overflow-hidden"
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

            {/* Fade Overlay */}
            <div className="absolute top-0 left-0 w-screen h-full bg-gradient-to-b from-black/30 via-black/50 to-[#121212] pointer-events-none"></div>

            {/* Content Overlay */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 w-full py-8">
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
                  <p className="text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-2 font-light drop-shadow-lg italic">"{movie.tagline}"</p>
                )}

                {/* Description */}
                {movie.overview && (
                  <p className="text-gray-300 text-xs md:text-xs lg:text-sm xl:text-base 2xl:text-lg leading-relaxed mb-3 max-w-xl drop-shadow-lg line-clamp-2">{movie.overview}</p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => router.push(`/${mediaType}/${tmdbId}`)}
                    disabled={movie.release_date ? new Date(movie.release_date) > new Date() : false}
                    style={{ 
                      backgroundColor: movie.release_date && new Date(movie.release_date) > new Date() ? '#666666' : '#E50914'
                    }}
                    className={`text-white font-bold py-2 px-6 md:py-3 md:px-8 lg:py-4 lg:px-10 xl:py-5 xl:px-12 2xl:py-6 2xl:px-16 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl shadow-lg ${
                      movie.release_date && new Date(movie.release_date) > new Date()
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:brightness-110'
                    }`}
                  >
                    <span>▶</span> {movie.release_date && new Date(movie.release_date) > new Date() ? 'Coming Soon' : 'Play'}
                  </button>
                  <button
                    onClick={() => setActiveTab('overview')}
                    className="text-white font-bold py-2 px-6 md:py-3 md:px-8 lg:py-4 lg:px-10 xl:py-5 xl:px-12 2xl:py-6 2xl:px-16 rounded-lg transition-all duration-300 border-2 border-white hover:bg-white/10 text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl"
                  >
                    More Info
                  </button>
                  <div>
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
            {/* Financial Info - Side by side */}
            {(movie.budget || movie.revenue) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {movie.budget ? (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                    <p className="text-xs lg:text-sm xl:text-base 2xl:text-lg text-gray-500 mb-3 font-bold">PRODUCTION BUDGET</p>
                    <p className="text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white">
                      ${(movie.budget / 1000000).toFixed(1)}M
                    </p>
                  </div>
                ) : null}
                {movie.revenue ? (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
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
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                    <h3 className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-4 font-bold">PRODUCTION COMPANIES</h3>
                    <div className="space-y-3">
                      {movie.production_companies.slice(0, 4).map((company, index) => (
                        <p key={`company-${company.id || index}`} className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-400">{company.name}</p>
                      ))}
                    </div>
                  </div>
                )}
                {movie.production_countries && movie.production_countries.length > 0 && (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                    <h3 className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-4 font-bold">COUNTRIES</h3>
                    <div className="space-y-3">
                      {movie.production_countries.map((country) => (
                        <p key={country.iso_3166_1} className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-400">{country.name}</p>
                      ))}
                    </div>
                  </div>
                )}
                {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 lg:p-8 xl:p-10 2xl:p-12 rounded-lg">
                    <h3 className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-300 mb-4 font-bold">LANGUAGES</h3>
                    <div className="space-y-3">
                      {movie.spoken_languages.slice(0, 4).map((lang) => (
                        <p key={lang.iso_639_1} className="text-sm lg:text-base xl:text-lg 2xl:text-xl text-gray-400">{lang.name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
            </div>

            {/* Reviews Tab */}
            {activeTab === 'overview' && (
              <div style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                {movie.reviews && movie.reviews.results.length > 0 ? (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold mb-6">REVIEWS ({movie.reviews.results.length})</h2>
                    {movie.reviews.results.slice(0, 5).map((review) => (
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
                ) : (
                  <p className="text-gray-400 text-center py-8">No reviews available yet.</p>
                )}
              </div>
            )}

            {/* Cast Tab */}
            {activeTab === 'cast' && movie.cast && movie.cast.length > 0 && (
              <div style={{ backgroundColor: '#1A1A1A' }} className="border border-t-0 border-gray-700 rounded-b-lg p-6">
                <h2 className="text-2xl font-bold mb-6">CAST ({movie.cast.length})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {movie.cast.slice(0, 15).map((member) => (
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
        
      {/* Player for watch view - Rendered separately to prevent reload on tab changes */}
      {view !== 'info' && (
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 mt-16 space-y-8">
            {/* Resume Watching Prompt */}
            {showResumePrompt && savedProgress > 0 && notificationVisible && (
              <div className="fixed top-20 right-4 z-[9999] max-w-xs animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-yellow-900 bg-opacity-90 rounded-lg p-4 shadow-lg border border-yellow-700 flex items-start justify-between gap-3">
                  <p className="text-yellow-300 text-sm flex-1">
                    ⚠️ Source 1 is having issues with automatic resume. You left off at <span className="font-bold text-white">{formatProgressTime(currentPlaybackTime > 0 ? currentPlaybackTime : savedProgress)}</span>. Please manually seek to continue watching.
                  </p>
                  <button
                    onClick={() => setNotificationVisible(false)}
                    className="text-yellow-300 hover:text-yellow-100 transition-colors flex-shrink-0 mt-0.5"
                    aria-label="Close notification"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Video Player - Show immediately with notification if resuming */}
            {videoSrc ? (
              <ThemedVideoPlayer
                key={`${tmdbId}-${resumeChoice}`}
                src={videoSrc}
                poster={posterUrl}
                autoplay={true}
                initialTime={resumeChoice === 'yes' ? savedProgress : 0}
                title={mediaTitle}
                mediaId={tmdbId}
                mediaType={mediaType}
                posterPath={movie.poster_path}
                onTimeUpdate={setCurrentPlaybackTime}
              />
            ) : (
              <div className="w-full h-[600px] bg-black flex justify-center items-center text-center p-4 rounded-lg shadow-2xl">
                <div>
                  <h2 className="text-2xl text-gray-400 font-bold mb-4">Video Not Available</h2>
                  <p className="text-gray-500">We couldn't find a playable source for this title.</p>
                </div>
              </div>
            )}

            {/* Content Grid - Info for Watch View */}
            <div className="grid grid-cols-1 gap-6">
              {/* Info Section */}
              <div className="space-y-6">
                {/* Title and Quick Info */}
                <div>
                  <div className="flex items-start sm:items-center gap-2 mb-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white break-words">
                      {mediaTitle}
                    </h1>
                    <VideoInfoPopup title={mediaTitle} />
                  </div>
                  {movie.tagline && (
                    <p className="text-sm sm:text-base text-gray-400 font-light">"{movie.tagline}"</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={handleChangeSource}
                    style={{ 
                      backgroundColor: videoSource === 'vidsrc' ? '#E50914' : '#1A1A1A'
                    }}
                    className={`font-bold py-2 sm:py-3 px-4 sm:px-6 rounded text-xs sm:text-sm transition-all ${
                      videoSource === 'vidsrc'
                        ? 'text-white hover:brightness-110'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {videoSource === 'vidsrc' ? 'Switch to Source 1' : 'Switch to Source 2'}
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

                {/* Source 2 Warning Note */}
                {videoSource === 'vidsrc' && (
                  <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded p-3 mt-4">
                    <p className="text-yellow-300 text-xs sm:text-sm">
                      ⚠️ You are currently using Source 2. Source 2 might be faster than Source 1, but some selections might not display content properly. If you experience any issues, switch back to Source 1.
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
                {activeTab === 'cast' && movie.cast && movie.cast.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4 text-white">CAST</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {movie.cast.slice(0, 12).map((member) => (
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
          </div>
        )}
      </div>
  );
};


export default MovieDetailPage;
