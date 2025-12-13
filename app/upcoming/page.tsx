import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import Header from '@/components/Header';
import { Suspense } from 'react';
import { getUnreleasedMovies, getUnreleasedTvShows } from '@/lib/tmdb';

const ListSkeleton = ({ title }: { title: string }) => (
  <div className="my-8 animate-pulse">
    <div className="h-8 w-1/4 bg-gray-800 rounded mb-4"></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>
      ))}
    </div>
  </div>
);

const UpcomingPage = async () => {
  const unreleasedMovies = await getUnreleasedMovies();
  const unreleasedTvShows = await getUnreleasedTvShows();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter out items without poster_path AND make sure date is strictly in the future
  const filterItemsWithPoster = (items: any[], dateField: 'release_date' | 'first_air_date') => {
    return items?.filter((item: any) => {
      // Must have a poster
      if (!item.poster_path) return false;
      
      // Must have a valid date and it must be strictly in the future
      const dateStr = item[dateField];
      if (!dateStr) return false;
      
      const itemDate = new Date(dateStr);
      itemDate.setHours(0, 0, 0, 0);
      
      // Only show if date is AFTER today
      return itemDate > today;
    }) || [];
  };

  return (
    <>
      <Header />
      <main className="container mx-auto p-4 pt-24">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Coming Soon</h1>
        
        <Suspense fallback={<ListSkeleton title="Upcoming Movies" />}>
          <MediaListWithTrailer 
            title="Upcoming Movies" 
            items={filterItemsWithPoster(unreleasedMovies?.results?.slice(0, 20), 'release_date')
              .map(item => ({ ...item, isUpcoming: true }))
              .slice(0, 12)} 
          />
        </Suspense>

        <Suspense fallback={<ListSkeleton title="Upcoming TV Shows" />}>
          <MediaListWithTrailer 
            title="Upcoming TV Shows" 
            items={filterItemsWithPoster(unreleasedTvShows?.results?.slice(0, 20), 'first_air_date')
              .map(item => ({ ...item, isUpcoming: true }))
              .slice(0, 12)} 
          />
        </Suspense>
      </main>
    </>
  );
};

export default UpcomingPage;
