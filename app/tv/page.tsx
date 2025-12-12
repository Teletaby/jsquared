import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import Header from '@/components/Header';
import { Suspense } from 'react';
import { getPopularTvShows, getTopRatedTvShows, getAiringTodayTvShows } from '@/lib/tmdb';

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

const TvShowsPage = async () => {
  const popularTvShows = await getPopularTvShows();
  const topRatedTvShows = await getTopRatedTvShows();
  const airingTodayTvShows = await getAiringTodayTvShows();

  return (
    <>
      <Header />
      <main className="container mx-auto p-4 pt-24">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">TV Shows</h1>
        <Suspense fallback={<ListSkeleton title="Popular TV Shows" />}>
          <MediaListWithTrailer title="Popular TV Shows" items={popularTvShows?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Top Rated TV Shows" />}>
          <MediaListWithTrailer title="Top Rated TV Shows" items={topRatedTvShows?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Airing Today TV Shows" />}>
          <MediaListWithTrailer title="Airing Today TV Shows" items={airingTodayTvShows?.results?.slice(0, 12) || []} />
        </Suspense>
        {/* Add more TV show categories as needed */}
      </main>
    </>
  );
};

export default TvShowsPage;