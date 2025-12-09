"use client";

import { getTvShowDetails } from '@/lib/tmdb';
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
}

const TvDetailPage = ({ params }: TvDetailPageProps) => {
  const [tvShow, setTvShow] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const hasPlayedOnceRef = useRef(false);
  
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

      try {
        const data: MediaDetails | null = await getTvShowDetails(tmdbId);

        if (data && data.id) {
          setTvShow(data);
        } else {
          setError('Could not find details for this TV show. It may not exist or there was an API error.');
        }
      } catch (e) {
        console.error("Failed to fetch TV show details:", e);
        setError('An unexpected error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tmdbId]); // Only depend on tmdbId, searchParams changes are handled by router.push below

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
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-5xl font-bold">{mediaTitle}</h1>
            <button
              onClick={() => setShowEpisodeSelector(true)}
              className="bg-accent text-white font-bold py-2 px-6 rounded-full hover:bg-red-700 transition-colors duration-300 whitespace-nowrap"
            >
              Select Episode (S{currentSeason} E{currentEpisode})
            </button>
            <button
              onClick={handleWatchOnTv}
              className="bg-blue-600 text-white font-bold py-2 px-6 rounded-full hover:bg-blue-700 transition-colors duration-300 whitespace-nowrap"
            >
              Watch on TV
            </button>
          </div>
          <p className="text-lg text-gray-300 mb-6">{tvShow.overview}</p>
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