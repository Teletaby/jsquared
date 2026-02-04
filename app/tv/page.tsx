import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import HeroCarousel from '@/components/HeroCarousel';
import RootLayoutContent from '@/components/RootLayoutContent';
import { Suspense } from 'react';
import { getPopularTvShows, getTopRatedTvShows, getAiringTodayTvShows } from '@/lib/tmdb';

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

const TvShowsPage = async () => {
  const popularTvShows = await getPopularTvShows();
  const topRatedTvShows = await getTopRatedTvShows();
  const airingTodayTvShows = await getAiringTodayTvShows();

  const heroItems = (popularTvShows?.results || []).slice(0, 10).map((show: any) => ({
    ...show,
    media_type: 'tv'
  }));

  return (
    <RootLayoutContent>
      <HeroCarousel items={heroItems} />
      <div className="container mx-auto p-4 pt-0">
        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer title="Popular TV Shows" items={popularTvShows?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer title="Top Rated TV Shows" items={topRatedTvShows?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer title="Airing Today TV Shows" items={airingTodayTvShows?.results?.slice(0, 12) || []} />
        </Suspense>
        {/* Add more TV show categories as needed */}
      </div>
    </RootLayoutContent>
  );
};

export default TvShowsPage;