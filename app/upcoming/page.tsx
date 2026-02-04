import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import HeroCarousel from '@/components/HeroCarousel';
import RootLayoutContent from '@/components/RootLayoutContent';
import { Suspense } from 'react';
import { getUnreleasedMovies, getUnreleasedTvShows } from '@/lib/tmdb';

const ListSkeleton = () => (
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
    return (items || []).filter((item: any) => {
      // Must have a poster
      if (!item.poster_path) return false;
      
      // Must have a valid date and it must be strictly in the future
      const dateStr = item[dateField];
      if (!dateStr) return false;
      
      const itemDate = new Date(dateStr);
      itemDate.setHours(0, 0, 0, 0);
      
      // Only show if date is AFTER today
      return itemDate > today;
    });
  };

  const upcomingMovies = filterItemsWithPoster(unreleasedMovies?.results || [], 'release_date');
  const upcomingTvShows = filterItemsWithPoster(unreleasedTvShows?.results || [], 'first_air_date');
  
  const heroItems = [...upcomingMovies.slice(0, 5), ...upcomingTvShows.slice(0, 5)]
    .sort((a, b) => {
      const dateA = new Date(a.release_date || a.first_air_date || '');
      const dateB = new Date(b.release_date || b.first_air_date || '');
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 10)
    .map((item: any) => ({
      ...item,
      media_type: item.title ? 'movie' : 'tv'
    }));

  return (
    <RootLayoutContent>
      <HeroCarousel items={heroItems} />
      <div className="container mx-auto p-4 pt-0">
        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer 
            title="Upcoming Movies" 
            items={filterItemsWithPoster(unreleasedMovies?.results?.slice(0, 20), 'release_date')
              .map(item => ({ ...item, isUpcoming: true }))
              .slice(0, 12)} 
          />
        </Suspense>

        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer 
            title="Upcoming TV Shows" 
            items={filterItemsWithPoster(unreleasedTvShows?.results?.slice(0, 20), 'first_air_date')
              .map(item => ({ ...item, isUpcoming: true }))
              .slice(0, 12)} 
          />
        </Suspense>
      </div>
    </RootLayoutContent>
  );
};

export default UpcomingPage;
