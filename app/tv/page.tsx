import GenreCarousel from '@/components/GenreCarousel';
import HeroCarousel from '@/components/HeroCarousel';
import RootLayoutContent from '@/components/RootLayoutContent';
import { getPopularTvShows } from '@/lib/tmdb';

const TvShowsPage = async () => {
  const popularTvShows = await getPopularTvShows();

  const heroItems = (popularTvShows?.results || []).slice(0, 10).map((show: any) => ({
    ...show,
    media_type: 'tv'
  }));

  return (
    <RootLayoutContent>
      <HeroCarousel items={heroItems} />
      <GenreCarousel mediaType="tv" />
    </RootLayoutContent>
  );
};

export default TvShowsPage;