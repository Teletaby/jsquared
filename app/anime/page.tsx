import GenreCarousel from '@/components/GenreCarousel';
import HeroCarousel from '@/components/HeroCarousel';
import RootLayoutContent from '@/components/RootLayoutContent';
import { getPopularAnime } from '@/lib/tmdb';

const AnimePage = async () => {
  const popularAnime = await getPopularAnime();

  const heroItems = (popularAnime?.results || []).slice(0, 10).map((show: any) => ({
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

export default AnimePage;
