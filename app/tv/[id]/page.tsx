"use client";

import { getTvShowDetails, ReviewsResponse, getCastDetails, CastDetails, CastMember } from '@/lib/tmdb';

import Image from 'next/image';

import LoadingSpinner from '@/components/LoadingSpinner';

import { useEffect, useState, useRef } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';

import EpisodeSelector from '@/components/EpisodeSelector';



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

  const [isPaused, setIsPaused] = useState(false);

  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);

  const hasPlayedOnceRef = useRef(false);

  const [castInfo, setCastInfo] = useState<CastDetails | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'cast'>('overview');

  

  const searchParams = useSearchParams();

  const router = useRouter();

  

  const { id } = params;

  const tmdbId = parseInt(id);



  // For TV page, mediaType should always be 'tv'

  const mediaType = 'tv';

  const currentSeason = searchParams.get('season') ? parseInt(searchParams.get('season')!, 10) : 1;

  const currentEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!, 10) : 1;



  // Effect to reset player state when content changes

  useEffect(() => {

    hasPlayedOnceRef.current = false;

    setIsPaused(false);

  }, [tmdbId, currentSeason, currentEpisode]);



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

      setTvShow(null);

      setCastInfo(null); // Reset cast info as well



      try {

        const [tvData, castData] = await Promise.all([

          getTvShowDetails(tmdbId),

          getCastDetails(mediaType, tmdbId) // Fetch cast details here

        ]);



        if (tvData && tvData.id) {

          setTvShow(tvData);

          setCastInfo(castData); // Set cast info

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

  }, [tmdbId, mediaType]); // Add mediaType to dependencies



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



  // Construct embed URL based on media type, season, and episode

  const embedUrl = `https://www.vidking.net/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}?color=cccccc&autoplay=1&nextEpisode=true`;



  const posterUrl = tvShow.poster_path 

    ? `https://image.tmdb.org/t/p/w780${tvShow.poster_path}`

    : '/placeholder.png';



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

            title={`${mediaTitle} S${currentSeason} E${currentEpisode}`}

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

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">

            <button

              onClick={() => setShowEpisodeSelector(true)}

              className="bg-accent text-white font-bold py-2 px-4 rounded-full hover:bg-accent-darker transition-colors duration-300 whitespace-nowrap text-sm sm:text-base w-full sm:w-auto"

            >

              Select Episode (S{currentSeason} E{currentEpisode})

            </button>

                        <button

                          disabled

                          className="bg-primary text-white font-bold py-2 px-4 rounded-full opacity-50 cursor-not-allowed whitespace-nowrap text-sm sm:text-base w-full sm:w-auto"

                        >

                          Watch on TV

                        </button>

          </div>

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

              <p className="text-base sm:text-lg text-gray-300 mb-6">{tvShow.overview}</p>

              

              <div className="flex flex-wrap gap-4 text-base sm:text-lg mb-6">

                <span className="font-bold">Rating: <span className="text-yellow-400">{tvShow.vote_average.toFixed(1)}</span></span>

                {tvShow.episode_run_time && tvShow.episode_run_time.length > 0 && (

                  <>

                    <span>|</span>

                    <span className="font-bold">Avg. Episode Runtime: <span className="text-gray-300">{tvShow.episode_run_time[0]} mins</span></span>

                  </>

                )}

                {tvShow.first_air_date && (

                  <>

                    <span>|</span>

                    <span className="font-bold">First Air Date: <span className="text-gray-300">{tvShow.first_air_date}</span></span>

                  </>

                )}

              </div>

              <div className="flex flex-wrap gap-2 mb-6"> {/* Added mb-6 for spacing */}

                <span className="font-bold mr-2">Genres:</span>

                {tvShow.genres?.map((genre) => (

                  <span key={genre.id} className="bg-ui-elements px-3 py-1 rounded-full text-sm">

                    {genre.name}

                  </span>

                ))}

              </div>



              {tvShow.reviews && tvShow.reviews.results.length > 0 && (

                <div className="mt-8">

                  <h2 className="text-2xl font-bold mb-4">Top Reviews</h2>

                  <div className="space-y-6">

                    {tvShow.reviews.results.slice(0, 3).map((review) => ( // Display top 3 reviews

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



          {activeTab === 'cast' && castInfo && castInfo.cast.length > 0 && (

            <div className="mt-8">

              <h2 className="text-2xl font-bold mb-4">Cast</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {castInfo.cast.slice(0, 15).map((member) => ( // Display top 15 cast members

                  <div key={member.id} className="bg-ui-elements p-4 rounded-lg shadow flex items-center">

                    {member.profile_path ? (

                      <Image

                        src={`https://image.tmdb.org/t/p/w92${member.profile_path}`}

                        alt={member.name}

                        width={46}

                        height={46}

                        className="rounded-full mr-3"

                      />

                    ) : (

                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center mr-3">

                        <span className="text-white text-sm">{member.name.charAt(0).toUpperCase()}</span>

                      </div>

                    )}

                    <div>

                      <p className="font-bold text-lg">{member.name}</p>

                      <p className="text-gray-400 text-sm">{member.character}</p>

                    </div>

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

  );

};



export default TvDetailPage;
