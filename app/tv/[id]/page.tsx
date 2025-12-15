"use client";

import { getTvShowDetails, ReviewsResponse, getCastDetails, CastDetails, CastMember, Review, getTvShowVideos, getMediaLogos } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import WatchlistButton from '@/components/WatchlistButton';
import Header from '@/components/Header';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EpisodeSelector from '@/components/EpisodeSelector';
import { formatDuration, getVideoSourceSetting } from '@/lib/utils';
import ThemedVideoPlayer from '@/components/ThemedVideoPlayer'; // Import the custom video player
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';
import VideoInfoPopup from '@/components/VideoInfoPopup';
import MarkdownBoldText from '@/components/MarkdownBoldText';
import SourceWarningDialog from '@/components/SourceWarningDialog';


interface TvDetailPageProps {
  params: {
    id: string;
  };
}

interface EpisodeDetails {
  episode_number: number;
  name: string;
  overview: string;
  still_path?: string;
  vote_average: number;
  runtime?: number;
}

interface SeasonDetails {
  season_number: number;
  name: string;
  episodes: EpisodeDetails[];
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
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);
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
  const hasFetchedRef = useRef(false); // Track if initial fetch has completed
  const [videoSource, setVideoSource] = useState<'vidking' | 'vidsrc'>('vidking');
  const [showSourceWarning, setShowSourceWarning] = useState(false);
  const [pendingSource, setPendingSource] = useState<'vidsrc' | null>(null);
  const lastMediaIdRef = useRef<number | null>(null); // Track last viewed media for source reset
  const [showResumePrompt, setShowResumePrompt] = useState(false); // Show continue watching prompt
  const [resumeChoice, setResumeChoice] = useState<'pending' | 'yes' | 'no'>('pending'); // User's choice
  const [notificationVisible, setNotificationVisible] = useState(true); // Control notification visibility
  
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
    if (lastMediaIdRef.current !== null && lastMediaIdRef.current !== tmdbId) {
      // Media has changed, reset to default source
      setVideoSource('vidking');
    }
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
    
    if (!session?.user) return;

    const fetchWatchProgress = async () => {
      try {
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data = await response.json();
          // Find history for this specific episode (matching season AND episode)
          const tvHistory = data.find((item: any) => 
            item.mediaId === tmdbId && 
            item.mediaType === 'tv' &&
            item.seasonNumber === currentSeason &&
            item.episodeNumber === currentEpisode
          );
          if (tvHistory && tvHistory.currentTime > 0) {
            console.log('Found episode-specific progress:', tvHistory.currentTime, 'for S', currentSeason, 'E', currentEpisode);
            setSavedProgress(Math.floor(tvHistory.currentTime));
            setSavedDuration(tvHistory.totalDuration || 0);
            setCurrentPlaybackTime(tvHistory.currentTime);
          } else {
            console.log('No saved progress for S', currentSeason, 'E', currentEpisode);
          }
        }
      } catch (error) {
        console.error('Error fetching watch progress:', error);
      }
    };

    fetchWatchProgress();
  }, [session, tmdbId, currentSeason, currentEpisode]);

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
        return `https://vidsrc.icu/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
      } else {
        let url = `https://www.vidking.net/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}?color=cccccc&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        // Add progress parameter if user chose to resume
        if (resumeChoice === 'yes' && savedProgress > 0) {
          url += `&progress=${Math.floor(savedProgress)}`;
        }
        return url;
      }
    },
    [tmdbId, currentSeason, currentEpisode, videoSource, resumeChoice, savedProgress]
  );
  const videoSrc = embedUrl; // Use videoSrc for ThemedVideoPlayer

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
    () => tvShow?.poster_path 
      ? `https://image.tmdb.org/t/p/w780${tvShow.poster_path}`
      : '/placeholder.png',
    [tvShow?.poster_path]
  );

  const handleEpisodeSelect = (seasonNum: number, episodeNum: number) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set('season', seasonNum.toString());
    newSearchParams.set('episode', episodeNum.toString());
    router.push(`?${newSearchParams.toString()}`, { scroll: false });
    setShowEpisodeSelector(false);
  };

  const handleWatchOnTv = () => {
    if (embedUrl) {
      router.push(`/receiver?videoSrc=${encodeURIComponent(embedUrl)}`);
    }
  };


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

  if (!tvShow) {
    return null; // Or a "Not Found" component
  }

  const mediaTitle = tvShow.name || 'Untitled Show';

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

  return (
    <div style={{ backgroundColor: '#121212' }} className="text-white min-h-screen">
      {/* Source Warning Dialog */}
      <SourceWarningDialog
        isOpen={showSourceWarning}
        onConfirm={handleConfirmSourceChange}
        onCancel={handleCancelSourceChange}
      />

      <Header />

      {view === 'info' && (
        <>
          {/* Hero Section */}
          <div className="relative h-screen flex flex-col justify-center overflow-hidden mt-16">
            {/* Backdrop Image - always shown first as base layer */}
            {tvShow?.backdrop_path && (
              <img
                src={`https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}`}
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
                    <span className="text-base md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white">{tvShow.vote_average.toFixed(1)}</span>
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
                    onClick={() => router.push(`/${mediaType}/${tmdbId}`)}
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
                    <span>▶</span> {tvShow.first_air_date && new Date(tvShow.first_air_date) > new Date() ? 'Coming Soon' : 'Watch'}
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
        {/* Player Section - Appears at top when watching */}
        {view !== 'info' && (
          <div className="space-y-8 mb-8">
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
                key={`${tmdbId}-S${currentSeason}E${currentEpisode}-${resumeChoice}`}
                src={videoSrc}
                poster={posterUrl}
                autoplay={true}
                initialTime={resumeChoice === 'yes' ? savedProgress : 0}
                title={mediaTitle}
                mediaId={tmdbId}
                mediaType={mediaType}
                posterPath={tvShow.poster_path}
                seasonNumber={currentSeason}
                episodeNumber={currentEpisode}
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
          </div>
        )}

        {view !== 'info' && (
        <div className="grid grid-cols-1 gap-6">
          {/* Details */}
          <div className="space-y-6">
            {/* Title Section */}
            <div>
              <div className="flex items-start sm:items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white break-words">
                  {mediaTitle}
                </h1>
                <VideoInfoPopup title={mediaTitle} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
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
                    onClick={handleChangeSource}
                    style={{ 
                      backgroundColor: videoSource === 'vidsrc' ? '#E50914' : '#1A1A1A'
                    }}
                    className={`font-bold py-2 sm:py-3 px-3 sm:px-6 text-sm sm:text-base rounded transition-all ${
                      videoSource === 'vidsrc'
                        ? 'text-white hover:brightness-110'
                        : 'text-gray-400 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {videoSource === 'vidsrc' ? 'Switch to Source 1' : 'Switch to Source 2'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push(`/${mediaType}/${tmdbId}`)}
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

            {/* Source 2 Warning Note */}
            {videoSource === 'vidsrc' && (
              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded p-3">
                <p className="text-yellow-300 text-xs sm:text-sm">
                  ⚠️ You are currently using Source 2. Some selections might not display content properly. If you experience any issues, switch back to Source 1.
                </p>
              </div>
            )}

            {/* Rating and Quick Info */}
            <div className="text-gray-400">
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-base">
                {tvShow.vote_average && (
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
                  <h2 className="text-xl font-bold mb-3 text-white">SYNOPSIS</h2>
                  <p className="text-gray-400 leading-relaxed">{tvShow.overview}</p>
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
            onClose={() => setShowEpisodeSelector(false)}
            onEpisodeSelect={handleEpisodeSelect}
          />
        )}
      </div>
    </div>
  );
};

export default TvDetailPage;

