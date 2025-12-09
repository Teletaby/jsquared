"use client";

import { getMovieDetails, ReviewsResponse, CastMember, getCastDetails } from '@/lib/tmdb';
import Image from 'next/image';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
  vote_average: number;
  runtime?: number; // For movies
  release_date?: string; // For movies
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id: string | null };
  reviews?: ReviewsResponse; // Added reviews property
  cast?: CastMember[];
}

const MovieDetailPage = ({ params }: MovieDetailPageProps) => {
  const [movie, setMovie] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const hasPlayedOnceRef = useRef(false);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'cast'>('overview');
  
  const { id } = params;
  const tmdbId = parseInt(id);

  // Effect to reset player state when content changes
  useEffect(() => {
    hasPlayedOnceRef.current = false;
    setIsPaused(false);
  }, [tmdbId]);

  // Effect for handling player events from the iframe
  useEffect(() => {
    const handlePlayerMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'PLAYER_EVENT') {
          if (message.data.event === 'play') {
            setIsPaused(false);
            hasPlayedOnceRef.current = true; // Mark that playback has successfully started
          } else if (message.data.event === 'pause') {
            // Only show the PAUSED overlay if the video has played at least once.
            // This prevents the overlay from showing if autoplay is blocked on load.
            if (hasPlayedOnceRef.current) {
              setIsPaused(true);
            }
          }
        }
      } catch (error) {
        // Ignore errors from non-player messages
      }
    };

    window.addEventListener("message", handlePlayerMessage);

    return () => {
      window.removeEventListener("message", handlePlayerMessage);
    };
  }, []); // This effect should only run once to set up the listener

  // Effect for fetching data
  useEffect(() => {
    const fetchData = async () => {
      // Reset states for a new fetch
      setLoading(true);
      setError(null);
      setMovie(null);

      try {
        const data: MediaDetails | null = await getMovieDetails(tmdbId);
        const castData = await getCastDetails('movie', tmdbId);

        if (data && data.id) {
          setMovie({ ...data, cast: castData?.cast || [] });
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
  }, [tmdbId]); // Depend on tmdbId

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

  // Construct embed URL based on media type
  // Directly use tmdbId for Vidking Player as per their documentation
  const embedUrl = `https://www.vidking.net/embed/movie/${tmdbId}?color=cccccc&autoplay=1`;

  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
    : '/placeholder.png';
  
  const handleWatchOnTv = () => {
    if (embedUrl) {
      router.push(`/receiver?videoSrc=${encodeURIComponent(embedUrl)}`);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="relative bg-black rounded-lg overflow-hidden shadow-lg mb-8">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            width="100%"
            height="600"
            frameBorder="0"
            allow="autoplay; fullscreen"
            title={mediaTitle}
            className="responsive-iframe"
          ></iframe>
        ) : (
          <div className="w-full h-[600px] bg-black flex justify-center items-center text-center p-4">
            <div>
              <h2 className="text-2xl text-red-500 font-bold mb-4">Video Not Available</h2>
              <p className="text-gray-400">We couldn't find a playable source for this title.</p>
            </div>
          </div>
        )}
        {/* Show PAUSED overlay only if the video has played and is now paused */}
        {isPaused && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center filter grayscale-[100%] pointer-events-none">
            <h2 className="text-white text-4xl font-bold">PAUSED</h2>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Image 
            src={posterUrl} 
            alt={mediaTitle}
            width={780}
            height={1170}
            className="rounded-lg shadow-lg w-full"
          />
        </div>
        <div className="md:col-span-2">
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">{mediaTitle}</h1>
          <button
            onClick={handleWatchOnTv}
            disabled
            className="mb-4 bg-accent text-white font-bold py-2 px-4 rounded-full opacity-50 cursor-not-allowed whitespace-nowrap text-sm sm:text-base w-full sm:w-auto"
          >
            Watch on TV
          </button>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-4 rounded-full text-sm sm:text-base ${
                activeTab === 'overview'
                  ? 'bg-accent text-white font-bold'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Overview & Reviews
            </button>
            <button
              onClick={() => setActiveTab('cast')}
              className={`py-2 px-4 rounded-full text-sm sm:text-base ${
                activeTab === 'cast'
                  ? 'bg-accent text-white font-bold'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Cast
            </button>
          </div>
          {activeTab === 'overview' && (
            <>
                        {activeTab === 'overview' && (
                          <>
                            <p className="text-base sm:text-lg text-gray-300 mb-6">{movie.overview}</p>
                            
                            <div className="flex flex-wrap gap-4 text-base sm:text-lg mb-6">
                              <span className="font-bold">Rating: <span className="text-yellow-400">{movie.vote_average.toFixed(1)}</span></span>
                              <span>|</span>
                              <span className="font-bold">Runtime: <span className="text-gray-300">{movie.runtime} mins</span></span>
                              <span>|</span>
                              <span className="font-bold">Released: <span className="text-gray-300">{movie.release_date}</span></span>
                            </div>
              
                            <div className="flex flex-wrap gap-2 mb-6"> {/* Added mb-6 for spacing */}
                              <span className="font-bold mr-2">Genres:</span>
                              {movie.genres?.map((genre) => (
                                <span key={genre.id} className="bg-ui-elements px-3 py-1 rounded-full text-sm">
                                  {genre.name}
                                </span>
                              ))}
                            </div>
                          </>
                        )}              {movie.reviews && movie.reviews.results.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-2xl font-bold mb-4">Reviews</h2>
                  <div className="space-y-6">
                    {movie.reviews.results.map((review) => ( // Display all reviews
                      <div key={review.id} className="bg-ui-elements p-4 rounded-lg shadow">
                        <div className="flex items-center mb-2">
                          {review.author_details.avatar_path ? (
                            <Image
                              src={review.author_details.avatar_path.startsWith('/https')
                                ? review.author_details.avatar_path.substring(1)
                                : `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`}
                              alt={review.author_details.username}
                              width={45}
                              height={45}
                              className="rounded-full mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center mr-3">
                              <span className="text-white text-sm">{review.author_details.username.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-lg">{review.author_details.username}</p>
                            {review.author_details.rating && (
                              <p className="text-sm text-yellow-400">Rating: {review.author_details.rating}/10</p>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-300 italic">"{review.content.substring(0, 300)}{review.content.length > 300 ? '...' : ''}"</p>
                        <a href={review.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm mt-2 block hover:underline">Read Full Review</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'cast' && movie.cast && movie.cast.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Cast</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {movie.cast.slice(0, 10).map((member) => ( // Display top 10 cast members
                  <div key={member.id} className="text-center">
                    {member.profile_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                        alt={member.name}
                        width={185}
                        height={278}
                        className="rounded-lg shadow-lg mx-auto mb-2"
                      />
                    ) : (
                      <div className="w-[185px] h-[278px] bg-ui-elements rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <span className="text-white text-sm">No Image</span>
                      </div>
                    )}
                    <p className="font-bold text-sm">{member.name}</p>
                    <p className="text-gray-400 text-xs">{member.character}</p>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default MovieDetailPage;
