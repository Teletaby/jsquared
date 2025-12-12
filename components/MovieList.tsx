"use client";

import { useEffect, useState } from 'react';
import MediaCard from './MediaCard';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import { useSession } from 'next-auth/react';

interface Media {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
  name?: string; // TV shows often use 'name' instead of 'title'
}

interface MovieListProps {
  movies: Media[]; // Expects an array of movie/tv objects
}

type WatchlistStatusMap = {
  [key: string]: boolean; // "mediaId-mediaType": boolean
};

const MovieList: React.FC<MovieListProps> = ({ movies }) => {
  const { data: session } = useSession();
  const { checkMultipleWatchlistStatuses } = useWatchlist(); // Call useWatchlist at the top level
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatusMap>({});
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      if (session?.user && movies.length > 0) {
        setIsLoadingWatchlist(true);
        const mediaItems = movies.map(movie => ({
          mediaId: movie.id,
          mediaType: (movie.media_type === 'tv' || !!movie.name ? 'tv' : 'movie') as 'tv' | 'movie',
        }));
        if (typeof checkMultipleWatchlistStatuses === 'function') { // Re-add the typeof check
          const statuses = await checkMultipleWatchlistStatuses(mediaItems);
          setWatchlistStatus(statuses);
        } else {
          // Log an error if the function is unexpectedly not available
          console.error('checkMultipleWatchlistStatuses is not a function in MovieList');
          setWatchlistStatus({});
        }
        setIsLoadingWatchlist(false);
      } else {
        setWatchlistStatus({});
        setIsLoadingWatchlist(false);
      }
    };
    fetchStatuses();
  }, [session, movies, checkMultipleWatchlistStatuses]); // Add checkMultipleWatchlistStatuses back to dependencies

  if (!movies || movies.length === 0) {
    return (
      <div className="text-center text-gray-500 bg-ui-elements p-8 rounded-lg my-8">
        <h3 className="text-xl mb-2">No Content Found</h3>
        <p>There are no items to display.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 my-8">
        {movies.map((media: Media) => {
          const mediaTypeForPath = media.media_type === 'tv' || !!media.name ? 'tv' : 'movie';
          const statusKey = `${media.id}-${mediaTypeForPath}`;
          const initialIsInWatchlist = watchlistStatus[statusKey];

          return (
            <MediaCard
              key={media.id}
              media={media}
              initialIsInWatchlist={initialIsInWatchlist}
            />
          );
        })}
      </div>
    </>
  );
};

export default MovieList;