"use client";

import { getMovieDetails, ReviewsResponse, CastMember, getCastDetails } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import WatchlistButton from '@/components/WatchlistButton';
import Header from '@/components/Header';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ThemedVideoPlayer from '@/components/ThemedVideoPlayer'; // Import the custom video player
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';

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
  // const [isPaused, setIsPaused] = useState(false); // Removed, handled by ThemedVideoPlayer
  // const hasPlayedOnceRef = useRef(false); // Removed, handled by ThemedVideoPlayer
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const [activeTab, setActiveTab] = useState<'overview' | 'cast'>('overview');
  const [initialIsInWatchlist, setInitialIsInWatchlist] = useState<boolean | undefined>(undefined);
  const { data: session } = useSession();
  const { checkWatchlistStatus } = useWatchlist();
  const hasFetchedRef = useRef(false); // Track if initial fetch has completed
  
  const { id } = params;
  const tmdbId = parseInt(id);
  const mediaType = 'movie'; // Define mediaType for watch history

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

      try {
        const data: MediaDetails | null = await getMovieDetails(tmdbId);
        const castData = await getCastDetails('movie', tmdbId);

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

  // Fetch saved watch progress
  useEffect(() => {
    if (!session?.user) return;

    const fetchWatchProgress = async () => {
      try {
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data = await response.json();
          const movieHistory = data.find((item: any) => item.mediaId === tmdbId && item.mediaType === 'movie');
          if (movieHistory) {
            setSavedProgress(Math.floor(movieHistory.currentTime));
            setCurrentPlaybackTime(movieHistory.currentTime);
          }
        }
      } catch (error) {
        console.error('Error fetching watch progress:', error);
      }
    };

    fetchWatchProgress();
  }, [session, tmdbId]);

  // Construct embed URL with useMemo to prevent unnecessary changes
  // Directly use tmdbId for Vidking Player as per their documentation
  const embedUrl = useMemo(
    () => {
      const baseUrl = `https://www.vidking.net/embed/movie/${tmdbId}?color=cccccc&autoplay=1`;
      // Add progress parameter if we have saved progress
      return savedProgress > 0 ? `${baseUrl}&progress=${savedProgress}` : baseUrl;
    },
    [tmdbId, savedProgress]
  );
  const videoSrc = embedUrl;

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
  
  const handleWatchOnTv = () => {
    if (embedUrl) {
      router.push(`/receiver?videoSrc=${encodeURIComponent(embedUrl)}`);
    }
  };

  return (
    <div style={{ backgroundColor: '#121212' }} className="text-white min-h-screen">
      <Header />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 mt-16">
        {view === 'info' && (
          <div className="space-y-8">
            {/* Hero Section with Poster and Title */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Poster */}
              <div className="flex-shrink-0 w-full lg:w-auto">
                <div className="sticky top-24 group max-w-xs mx-auto lg:mx-0">
                  <div className="relative overflow-hidden rounded" style={{ backgroundColor: '#1A1A1A' }}>
                    <Image
                      src={posterUrl}
                      alt={mediaTitle}
                      width={180}
                      height={270}
                      className="w-full h-auto group-hover:brightness-110 transition-all duration-500"
                    />
                  </div>
                </div>
              </div>

              {/* Title and Quick Info */}
              <div className="flex-1 space-y-6">
                {/* Title Section */}
                <div>
                  <h1 className="text-5xl lg:text-6xl font-bold mb-3 text-white">
                    {mediaTitle}
                  </h1>
                  {movie.tagline && (
                    <p className="text-lg text-gray-400 font-light">"{movie.tagline}"</p>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-4 rounded">
                    <p className="text-xs text-gray-500 font-semibold mb-2">RATING</p>
                    <p className="text-2xl font-bold text-white">{movie.vote_average.toFixed(1)}</p>
                  </div>
                  
                  {movie.runtime && (
                    <div style={{ backgroundColor: '#1A1A1A' }} className="p-4 rounded">
                      <p className="text-xs text-gray-500 font-semibold mb-2">DURATION</p>
                      <p className="text-2xl font-bold text-white">{movie.runtime}m</p>
                    </div>
                  )}

                  {movie.release_date && (
                    <div style={{ backgroundColor: '#1A1A1A' }} className="p-4 rounded">
                      <p className="text-xs text-gray-500 font-semibold mb-2">RELEASED</p>
                      <p className="text-lg font-bold text-white">{new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  )}

                  {movie.status && (
                    <div style={{ backgroundColor: '#1A1A1A' }} className="p-4 rounded">
                      <p className="text-xs text-gray-500 font-semibold mb-2">STATUS</p>
                      <p className="text-lg font-bold text-white">{movie.status}</p>
                    </div>
                  )}
                </div>

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                  <div>
                    <h3 className="text-xs text-gray-500 font-bold tracking-widest mb-3">GENRES</h3>
                    <div className="flex flex-wrap gap-2">
                      {movie.genres.map((genre) => (
                        <span
                          key={genre.id}
                          style={{ backgroundColor: '#1A1A1A' }}
                          className="border border-gray-600 text-gray-300 px-4 py-2 rounded text-sm font-medium hover:border-white transition-all duration-300"
                        >
                          {genre.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => router.push(`/${mediaType}/${tmdbId}`)}
                    style={{ backgroundColor: '#E50914' }}
                    className="flex-1 text-white font-bold py-3 px-8 rounded transition-all duration-300 hover:brightness-110 flex items-center justify-center gap-2 group text-base"
                  >
                    <span className="text-lg">▶</span> Watch Now
                  </button>
                  <div className="flex-1">
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

            {/* Overview Section */}
            <div style={{ backgroundColor: '#1A1A1A' }} className="rounded p-8">
              <h2 className="text-2xl font-bold mb-4 text-white">SYNOPSIS</h2>
              <p className="text-gray-400 text-base leading-relaxed">{movie.overview}</p>
            </div>

            {/* Financial Info - Side by side */}
            {(movie.budget || movie.revenue) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {movie.budget ? (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 rounded">
                    <p className="text-xs text-gray-500 mb-3 font-bold">PRODUCTION BUDGET</p>
                    <p className="text-3xl font-bold text-white">
                      ${(movie.budget / 1000000).toFixed(1)}M
                    </p>
                  </div>
                ) : null}
                {movie.revenue ? (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 rounded">
                    <p className="text-xs text-gray-500 mb-3 font-bold">BOX OFFICE REVENUE</p>
                    <p className="text-3xl font-bold text-white">
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
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 rounded">
                    <h3 className="text-sm text-gray-300 mb-4 font-bold">PRODUCTION COMPANIES</h3>
                    <div className="space-y-3">
                      {movie.production_companies.slice(0, 4).map((company) => (
                        <p key={company.id} className="text-sm text-gray-400">{company.name}</p>
                      ))}
                    </div>
                  </div>
                )}
                {movie.production_countries && movie.production_countries.length > 0 && (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 rounded">
                    <h3 className="text-sm text-gray-300 mb-4 font-bold">COUNTRIES</h3>
                    <div className="space-y-3">
                      {movie.production_countries.map((country) => (
                        <p key={country.iso_3166_1} className="text-sm text-gray-400">{country.name}</p>
                      ))}
                    </div>
                  </div>
                )}
                {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                  <div style={{ backgroundColor: '#1A1A1A' }} className="p-6 rounded">
                    <h3 className="text-sm text-gray-300 mb-4 font-bold">LANGUAGES</h3>
                    <div className="space-y-3">
                      {movie.spoken_languages.slice(0, 4).map((lang) => (
                        <p key={lang.iso_639_1} className="text-sm text-gray-400">{lang.name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div style={{ backgroundColor: '#1A1A1A' }} className="flex gap-2 border-b border-gray-700 rounded-t p-2">
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
                        <p className="text-gray-400 leading-relaxed mb-3 text-sm">{review.content.substring(0, 400)}{review.content.length > 400 ? '...' : ''}</p>
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
        )}
        
        {/* Player for watch view - Rendered separately to prevent reload on tab changes */}
        {view !== 'info' && (
          <div className="space-y-8">
            {/* Video Player */}
            {videoSrc ? (
              <ThemedVideoPlayer
                src={videoSrc}
                poster={posterUrl}
                autoplay={true}
                initialTime={savedProgress > 0 ? savedProgress : currentPlaybackTime}
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

            {/* Content Grid - Poster + Info for Watch View */}
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

              {/* Info Section */}
              <div className="md:col-span-3 space-y-6">
                {/* Title and Quick Info */}
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">
                    {mediaTitle}
                  </h1>
                  {movie.tagline && (
                    <p className="text-base text-gray-400 font-light">"{movie.tagline}"</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleWatchOnTv}
                    style={{ backgroundColor: '#E50914' }}
                    className="text-white font-bold py-3 px-6 rounded transition-all duration-300 hover:brightness-110"
                  >
                    Watch on TV
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

                {/* Rating and Quick Info */}
                <div className="text-gray-400">
                  <div className="flex flex-wrap gap-4 text-base">
                    {movie.vote_average && (
                      <span className="font-semibold">Rating: {movie.vote_average.toFixed(1)}</span>
                    )}
                    {movie.release_date && (
                      <span>Release: {new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    )}
                    {movie.runtime && (
                      <span>Duration: {movie.runtime}m</span>
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
                              <p className="text-gray-300 text-sm leading-relaxed">{review.content.substring(0, 300)}{review.content.length > 300 ? '...' : ''}</p>
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
    </div>
  );
};

export default MovieDetailPage;
