import GenreCarousel from '@/components/GenreCarousel';
import HeroCarousel from '@/components/HeroCarousel';
import RootLayoutContent from '@/components/RootLayoutContent';
import { getPopularMovies } from '@/lib/tmdb';

const MoviesPage = async () => {
  const popularMovies = await getPopularMovies();

  const heroItems = (popularMovies?.results || []).slice(0, 10).map((movie: any) => ({
    ...movie,
    media_type: 'movie'
  }));

  return (
    <RootLayoutContent>
      <HeroCarousel items={heroItems} />
      <GenreCarousel mediaType="movie" />
    </RootLayoutContent>
  );
};

export default MoviesPage;