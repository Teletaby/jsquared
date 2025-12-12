import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import Header from '@/components/Header';
import { Suspense } from 'react';
import { getPopularMovies, discoverMovies } from '@/lib/tmdb';
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

const MoviesPage = async () => {
  const popularMovies = await getPopularMovies();
  const actionMovies = await discoverMovies({ with_genres: GENRE_MAP['action'], page: '1' });
  const comedyMovies = await discoverMovies({ with_genres: GENRE_MAP['comedy'], page: '1' });

  return (
    <>
      <Header />
      <main className="container mx-auto p-4 pt-24">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Movies</h1>
        <Suspense fallback={<ListSkeleton title="Popular Movies" />}>
          <MediaListWithTrailer title="Popular Movies" items={popularMovies?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Action" />}>
          <MediaListWithTrailer title="Action" items={actionMovies?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Comedy" />}>
          <MediaListWithTrailer title="Comedy" items={comedyMovies?.results?.slice(0, 12) || []} />
        </Suspense>
      </main>
    </>
  );
};

export default MoviesPage;