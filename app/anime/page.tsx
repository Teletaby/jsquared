import MediaListWithTrailer from '@/components/MediaListWithTrailer';
import MediaFetcherList from '@/components/MediaFetcherList';
import HeroCarousel from '@/components/HeroCarousel';
import RootLayoutContent from '@/components/RootLayoutContent';
import { Suspense } from 'react';
import { getPopularAnime, getTopRatedAnime, getPopularAnimeMovies, getTopRatedAnimeMovies } from '@/lib/tmdb';

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

const AnimePage = async () => {
  const popularAnime = await getPopularAnime();
  const topRatedAnime = await getTopRatedAnime();
  const popularAnimeMovies = await getPopularAnimeMovies();
  const topRatedAnimeMovies = await getTopRatedAnimeMovies();

  const heroItems = (popularAnime?.results || []).slice(0, 10).map((show: any) => ({
    ...show,
    media_type: 'tv'
  }));

  return (
    <RootLayoutContent>
      <HeroCarousel items={heroItems} />
      <div className="container mx-auto p-4 pt-0">
        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer title="Popular Anime Series" items={popularAnime?.results?.slice(0, 12) || []} />
        </Suspense>
        <Suspense fallback={<ListSkeleton />}>
          <MediaListWithTrailer title="Top Rated Anime Series" items={topRatedAnime?.results?.slice(0, 12) || []} />
        </Suspense>
      </div>
      <MediaFetcherList title="Popular Anime Movies" items={popularAnimeMovies?.results?.slice(0, 12) || []} />
      <MediaFetcherList title="Top Rated Anime Movies" items={topRatedAnimeMovies?.results?.slice(0, 12) || []} />
    </RootLayoutContent>
  );
};

export default AnimePage;
