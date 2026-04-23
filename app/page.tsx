import RootLayoutContent from '../components/RootLayoutContent';

import HeroCarousel from '../components/HeroCarousel';
import UserWatchHistory from '../components/UserWatchHistory';
import Top10Today from '../components/Top20Week';
import MediaFetcherList from '../components/MediaFetcherList';
import LastWatchedSummary from '../components/LastWatchedSummary';
import { getPopularMovies, getTrendingDay, getPopularTvShows, discoverMovies, discoverTvShows } from '../lib/tmdb';
import { GENRE_MAP } from '../lib/genreMap';

/**
 * Filter items to only include those with release dates within 1 month from today
 */
function filterByReleaseDate(items: any[]): any[] {
  const today = new Date();
  const oneMonthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return items.filter(item => {
    const releaseDate = new Date(item.release_date || item.first_air_date);
    
    // Skip items without a release date
    if (!item.release_date && !item.first_air_date) {
      return false;
    }
    
    // Only include items released within 1 month from today
    return releaseDate <= oneMonthFromNow;
  });
}

export default async function HomePage() {
  let trendingItems: any[] = [];
  let popularMovies = [];
  let popularTvShows = [];
  let actionMovies = [];
  let actionTvShows = [];
  let comedyMovies = [];
  let comedyTvShows = [];
  let dramaMovies = [];
  let dramaTvShows = [];

  try {
const [trendingData, popularMoviesData, popularTvData, actionMoviesData, actionTvData, comedyMoviesData, comedyTvData, dramaMoviesData, dramaTvData] = await Promise.all([
      getTrendingDay(),
      getPopularMovies(),
      getPopularTvShows(),
      discoverMovies({ with_genres: GENRE_MAP['action'] }),
      discoverTvShows({ with_genres: GENRE_MAP['action'] }),
      discoverMovies({ with_genres: GENRE_MAP['comedy'] }),
      discoverTvShows({ with_genres: GENRE_MAP['comedy'] }),
      discoverMovies({ with_genres: GENRE_MAP['drama'] }),
      discoverTvShows({ with_genres: GENRE_MAP['drama'] }),
    ]);

    // Use the top 10 trending items for the day in the hero carousel
    trendingItems = (trendingData?.results || []).slice(0, 10);
    
    // Filter all items to only include those with release dates within 1 month from today
    popularMovies = filterByReleaseDate(popularMoviesData?.results || []);
    popularTvShows = filterByReleaseDate(popularTvData?.results || []);
    actionMovies = filterByReleaseDate(actionMoviesData?.results || []);
    actionTvShows = filterByReleaseDate(actionTvData?.results || []);
    comedyMovies = filterByReleaseDate(comedyMoviesData?.results || []);
    comedyTvShows = filterByReleaseDate(comedyTvData?.results || []);
    dramaMovies = filterByReleaseDate(dramaMoviesData?.results || []);
    dramaTvShows = filterByReleaseDate(dramaTvData?.results || []);

  } catch (err: unknown) {
    console.error("Failed to fetch content:", err);
  }

  return (
    <RootLayoutContent>
      <HeroCarousel items={trendingItems} />
      <UserWatchHistory />
      <Top10Today />

      {/* One-line carousel "Since you watched" placed below Top 20 */}
      <div className="px-4 md:px-0">
        <LastWatchedSummary />
      </div>
      
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
