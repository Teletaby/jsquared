"use client";

import { getTvShowDetails, ReviewsResponse, getCastDetails, CastDetails, CastMember, Review } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import WatchlistButton from '@/components/WatchlistButton';
import Header from '@/components/Header';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EpisodeSelector from '@/components/EpisodeSelector';
import { formatDuration } from '@/lib/utils';
import ThemedVideoPlayer from '@/components/ThemedVideoPlayer'; // Import the custom video player
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';


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
  // const [isPaused, setIsPaused] = useState(false); // Removed, handled by ThemedVideoPlayer
  // const hasPlayedOnceRef = useRef(false); // Removed, handled by ThemedVideoPlayer
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [castInfo, setCastInfo] = useState<CastDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cast'>('overview');
  const [initialIsInWatchlist, setInitialIsInWatchlist] = useState<boolean | undefined>(undefined);
  const { data: session } = useSession();
  const { checkWatchlistStatus } = useWatchlist();
  const hasFetchedRef = useRef(false); // Track if initial fetch has completed
  
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { id } = params;
  const tmdbId = parseInt(id);
  const view = searchParams.get('view'); // Read the 'view' query parameter

  // For TV page, mediaType should always be 'tv'
  const mediaType = 'tv';
  const currentSeason = searchParams.get('season') ? parseInt(searchParams.get('season')!, 10) : 1;
  const currentEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!, 10) : 1;

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

      try {
        const [tvData, castData] = await Promise.all([
          getTvShowDetails(tmdbId),
          getCastDetails(mediaType, tmdbId) // Fetch cast details here
        ]);

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

  // Construct embed URL with useMemo to prevent unnecessary changes
  // NOTE: We intentionally don't use the progress parameter as it causes the player to get stuck
  // Instead, we show the user their saved progress and let them manually seek if needed
  const embedUrl = useMemo(
    () => `https://www.vidking.net/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}?color=cccccc&autoPlay=true&nextEpisode=true&episodeSelector=true`,
    [tmdbId, currentSeason, currentEpisode]
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

  return (
    <div style={{ backgroundColor: '#121212' }} className="text-white min-h-screen">
      <Header />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 mt-16">
        {/* Player Section - Appears at top when watching */}
        {view !== 'info' && (
          <div className="space-y-8 mb-8">
            {/* Video Player */}
            {videoSrc ? (
              <ThemedVideoPlayer
                src={videoSrc}
                poster={posterUrl}
                autoplay={true}
                initialTime={0}
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Poster */}
          <div className="md:col-span-1">
            <div className="sticky top-24 group">
              <div className="relative overflow-hidden rounded">
                <Image 
                  src={posterUrl} 
                  alt={mediaTitle}
                  width={200}
                  height={300}
                  className="w-full h-auto group-hover:brightness-110 transition-all duration-500"
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-3 space-y-6">
            {/* Title Section */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">
                {mediaTitle}
              </h1>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {view !== 'info' ? (
                <>
                  <button
                    onClick={() => setShowEpisodeSelector(true)}
                    style={{ backgroundColor: '#E50914' }}
                    className="text-white font-bold py-3 px-6 rounded transition-all duration-300 hover:brightness-110"
                  >
                    Select Episode (S{currentSeason}E{currentEpisode})
                  </button>
                  <button
                    disabled
                    style={{ backgroundColor: '#1A1A1A' }}
                    className="text-gray-500 font-bold py-3 px-6 rounded opacity-50 cursor-not-allowed border border-gray-700"
                  >
                    Watch on TV
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push(`/${mediaType}/${tmdbId}`)}
                  style={{ backgroundColor: '#E50914' }}
                  className="text-white font-bold py-3 px-6 rounded transition-all duration-300 hover:brightness-110"
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

            {/* Rating and Quick Info */}
            <div className="text-gray-400">
              <div className="flex flex-wrap gap-4 text-base">
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
                          <p className="text-gray-300 text-sm leading-relaxed">{review.content.substring(0, 300)}{review.content.length > 300 ? '...' : ''}</p>
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

        {showEpisodeSelector && (
          <EpisodeSelector
            tvShowId={id}
            showTitle={mediaTitle}
            onClose={() => setShowEpisodeSelector(false)}
            onEpisodeSelect={handleEpisodeSelect}
          />
        )}
      </div>
    </div>
  );
};

export default TvDetailPage;

