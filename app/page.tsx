import RootLayoutContent from '../components/RootLayoutContent';
import MoviesClientPage from '../components/client/MoviesClientPage';
import HeroCarousel from '../components/HeroCarousel';
import UserWatchHistory from '../components/UserWatchHistory';
import Top20Week from '../components/Top20Week';
import MediaFetcherList from '../components/MediaFetcherList';
import { getPopularMovies, getTrendingMovies, getPopularTvShows, discoverMovies, discoverTvShows } from '../lib/tmdb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/auth';
import { GENRE_MAP } from '../lib/genreMap';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  let trendingMovies = [];
  let popularMovies = [];
  let popularTvShows = [];
  let actionMovies = [];
  let actionTvShows = [];
  let comedyMovies = [];
  let comedyTvShows = [];
  let dramaMovies = [];
  let dramaTvShows = [];
  let error = null;

  try {
    const [trendingMoviesData, popularMoviesData, popularTvData, actionMoviesData, actionTvData, comedyMoviesData, comedyTvData, dramaMoviesData, dramaTvData] = await Promise.all([
      getTrendingMovies(),
      getPopularMovies(),
      getPopularTvShows(),
      discoverMovies({ with_genres: GENRE_MAP['action'] }),
      discoverTvShows({ with_genres: GENRE_MAP['action'] }),
      discoverMovies({ with_genres: GENRE_MAP['comedy'] }),
      discoverTvShows({ with_genres: GENRE_MAP['comedy'] }),
      discoverMovies({ with_genres: GENRE_MAP['drama'] }),
      discoverTvShows({ with_genres: GENRE_MAP['drama'] }),
    ]);

    trendingMovies = trendingMoviesData?.results || [];
    popularMovies = popularMoviesData?.results || [];
    popularTvShows = popularTvData?.results || [];
    actionMovies = actionMoviesData?.results || [];
    actionTvShows = actionTvData?.results || [];
    comedyMovies = comedyMoviesData?.results || [];
    comedyTvShows = comedyTvData?.results || [];
    dramaMovies = dramaMoviesData?.results || [];
    dramaTvShows = dramaTvData?.results || [];

  } catch (err: any) {
    console.error("Failed to fetch content:", err);
    error = err.message || "Failed to load content.";
  }

  return (
    <RootLayoutContent>
      <HeroCarousel items={trendingMovies} />
      <UserWatchHistory />
      <Top20Week />
      
      {/* Popular Movies */}
      <MediaFetcherList title="Popular Movies" items={popularMovies.slice(0, 12)} />
      
      {/* Popular TV Shows */}
      <MediaFetcherList title="Popular TV Shows" items={popularTvShows.slice(0, 12)} />
      
      {/* Mixed Genre Content */}
      <MediaFetcherList title="Action Movies & Shows" items={[...actionMovies.slice(0, 6), ...actionTvShows.slice(0, 6)]} />
      <MediaFetcherList title="Comedy Movies & Shows" items={[...comedyMovies.slice(0, 6), ...comedyTvShows.slice(0, 6)]} />
      <MediaFetcherList title="Drama Movies & Shows" items={[...dramaMovies.slice(0, 6), ...dramaTvShows.slice(0, 6)]} />
    </RootLayoutContent>
  );
}
