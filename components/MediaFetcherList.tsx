'use client';

import MediaCard from './MediaCard';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useWatchlist } from '@/lib/hooks/useWatchlist';

interface MediaFetcherListProps {
  title: string;
  items: any[];
}

const MediaFetcherList = ({ title, items }: MediaFetcherListProps) => {
  const { data: session } = useSession();
  const { checkMultipleWatchlistStatuses } = useWatchlist(); // Call useWatchlist at the top level
  const [watchlistStatuses, setWatchlistStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchStatuses = async () => {
      if (session?.user && items && items.length > 0) {
        const mediaItems = items.map(item => ({
          mediaId: item.id,
          mediaType: (item.media_type === 'tv' || !!item.name ? 'tv' : 'movie') as 'tv' | 'movie',
        }));
        if (typeof checkMultipleWatchlistStatuses === 'function') { // Re-add the typeof check
          const statuses = await checkMultipleWatchlistStatuses(mediaItems);
          setWatchlistStatuses(statuses);
        } else {
          // Log an error if the function is unexpectedly not available
          console.error('checkMultipleWatchlistStatuses is not a function in MediaFetcherList');
          setWatchlistStatuses({});
        }
      } else {
        setWatchlistStatuses({});
      }
    };
    fetchStatuses();
  }, [session, items, checkMultipleWatchlistStatuses]); // Add checkMultipleWatchlistStatuses back to dependencies

  return (
    <div className="my-12">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-white font-orbitron uppercase px-4">
        {title}
      </h2>
      {items && items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-4">
          {items.map((item: any) => {
            const mediaTypeForPath = item.media_type === 'tv' || !!item.name ? 'tv' : 'movie';
            const key = `${item.id}-${mediaTypeForPath}`;
            const initialIsInWatchlist = watchlistStatuses[key];
            return (
              <div key={item.id} className="group relative">
                <MediaCard
                  media={{ ...item, media_type: mediaTypeForPath }}
                  initialIsInWatchlist={initialIsInWatchlist}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 bg-ui-elements p-8 rounded-lg mx-4">
          <h3 className="text-xl mb-2">Could Not Load Content</h3>
          <p>
            This might be because the TMDB API key is not set up correctly or
            no movies were found for this category.
          </p>
        </div>
      )}
    </div>
  );
};

export default MediaFetcherList;