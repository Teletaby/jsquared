import { discoverMovies, discoverTvShows } from '@/lib/tmdb';
import MovieList from '@/components/MovieList';
import CountryCarousel from '@/components/CountryCarousel';
import Header from '@/components/Header';
import Link from 'next/link';

interface CountryPageProps {
  params: {
    country: string;
  };
  searchParams: {
    genres?: string;
  };
}

const COUNTRY_INFO: { [key: string]: { name: string; code: string } } = {
  us: { name: 'United States', code: 'US' },
  cn: { name: 'China', code: 'CN' },
  kr: { name: 'South Korea', code: 'KR' },
  jp: { name: 'Japan', code: 'JP' },
  th: { name: 'Thailand', code: 'TH' },
  vn: { name: 'Vietnam', code: 'VN' },
  id: { name: 'Indonesia', code: 'ID' },
  my: { name: 'Malaysia', code: 'MY' },
  ph: { name: 'Philippines', code: 'PH' },
  sg: { name: 'Singapore', code: 'SG' },
};

const CountryPage = async ({ params, searchParams }: CountryPageProps) => {
  const countryKey = params.country.toLowerCase();
  const genreFilter = searchParams.genres; // e.g., "27" for Horror
  const countryInfo = COUNTRY_INFO[countryKey];

  if (!countryInfo) {
    return (
      <div className="container mx-auto p-4 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">Country Not Found</h1>
        <p>The country you&apos;re looking for is not available.</p>
        <Link href="/" className="text-blue-500 hover:text-blue-400 mt-4">
          Back to Home
        </Link>
      </div>
    );
  }

  let movies: any[] = [];
  let tvShows: any[] = [];
  let topTrendingThisWeek: any[] = [];
  let error: string | null = null;

  try {
    // Fetch popular movies and TV shows for the country (sorted by popularity)
    const movieFilters: any = {
      'with_origin_country': countryInfo.code,
      'sort_by': 'popularity.desc',
      'page': '1',
    };

    const tvFilters: any = {
      'with_origin_country': countryInfo.code,
      'sort_by': 'popularity.desc',
      'page': '1',
    };

    // Add genre filter if provided
    if (genreFilter) {
      movieFilters['with_genres'] = genreFilter;
      tvFilters['with_genres'] = genreFilter;
    }

    const [moviesData, tvData] = await Promise.all([
      discoverMovies(movieFilters),
      discoverTvShows(tvFilters),
    ]);

    // Get all movies and TV shows for the country
    const allMovies = moviesData?.results?.filter((m: any) => m.poster_path) || [];
    const allTvShows = tvData?.results?.filter((t: any) => t.poster_path) || [];

    movies = allMovies.slice(0, 12);
    tvShows = allTvShows.slice(0, 12);
    
    // Create top 20 trending by combining movies and TV shows and sorting by popularity
    topTrendingThisWeek = [
      ...allMovies.map((m: any) => ({ ...m, media_type: 'movie' })),
      ...allTvShows.map((t: any) => ({ ...t, media_type: 'tv' })),
    ]
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20);

    if (movies.length === 0 && tvShows.length === 0) {
      error = `No content found for ${countryInfo.name}${genreFilter ? ' in this genre' : ''}.`;
    }
  } catch (err) {
    console.error('Error fetching country content:', err);
    error = 'An error occurred while fetching content.';
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 pt-24">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">
              {countryInfo.name}
            </h1>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pt-24">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-8">
          Popular in {countryInfo.name}
        </h1>

        {/* Top 20 This Week Carousel - Mixed Movies & TV Shows */}
        {topTrendingThisWeek.length > 0 && (
          <CountryCarousel
            items={topTrendingThisWeek}
            title="🔥 Top 20 This Week"
          />
        )}

        {movies.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-white mb-4">
              🎬 Movies
            </h2>
            <MovieList
              movies={movies.map((m: any) => ({
                ...m,
                media_type: 'movie',
              }))}
            />
          </div>
        )}

        {tvShows.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-white mb-4">
              📺 TV Series
            </h2>
            <MovieList
              movies={tvShows.map((t: any) => ({
                ...t,
                media_type: 'tv',
              }))}
            />
          </div>
        )}

        {movies.length === 0 && tvShows.length === 0 && (
          <p className="text-white text-center">
            No content found for {countryInfo.name}.
          </p>
        )}
      </div>
    </>
  );
};

export default CountryPage;
