import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import Top20Week from '@/components/Top20Week';
import { Suspense } from 'react';
import { getPopularMovies, discoverMovies, getTopRatedTvShows, getAiringTodayTvShows } from '@/lib/tmdb';
import { GENRE_MAP } from '@/lib/genreMap';

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

export default async function HomePage() {
  const popularMovies = await getPopularMovies();
  const actionMovies = await discoverMovies({ with_genres: GENRE_MAP['action'], page: '1' });
  const comedyMovies = await discoverMovies({ with_genres: GENRE_MAP['comedy'], page: '1' });
  const topRatedTvShows = await getTopRatedTvShows();
  const airingTodayTvShows = await getAiringTodayTvShows();

  return (
    <main className="container mx-auto p-4">
      <Suspense fallback={<ListSkeleton title="Top 20 This Week" />}>
        <Top20Week />
      </Suspense>
      <Suspense fallback={<ListSkeleton title="Popular Movies" />}>
        <MediaListWithTrailer title="Popular Movies" items={popularMovies?.results?.slice(0, 12) || []} />
      </Suspense>
      <Suspense fallback={<ListSkeleton title="Action" />}>
        <MediaListWithTrailer title="Action" items={actionMovies?.results?.slice(0, 12) || []} />
      </Suspense>
      <Suspense fallback={<ListSkeleton title="Comedy" />}>
        <MediaListWithTrailer title="Comedy" items={comedyMovies?.results?.slice(0, 12) || []} />
      </Suspense>
      <Suspense fallback={<ListSkeleton title="Top Rated TV Shows" />}>
        <MediaListWithTrailer title="Top Rated TV Shows" items={topRatedTvShows?.results?.slice(0, 12) || []} />
      </Suspense>
      <Suspense fallback={<ListSkeleton title="Airing Today TV Shows" />}>
        <MediaListWithTrailer title="Airing Today TV Shows" items={airingTodayTvShows?.results?.slice(0, 12) || []} />
      </Suspense>
    </main>
  );
}