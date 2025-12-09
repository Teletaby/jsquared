import { searchMulti, discoverMovies, discoverTvShows } from '@/lib/tmdb';
import MovieList from '@/components/MovieList';
import LoadingSpinner from '@/components/LoadingSpinner';
import { GENRE_MAP } from '@/lib/genreMap';

interface SearchPageProps {
  searchParams: {
    query?: string;
    with_genres?: string;
    minRating?: string;
  };
}

const SearchPage = async ({ searchParams }: SearchPageProps) => {
  const { query, with_genres, minRating: minRatingString } = searchParams;
  const minRating = minRatingString ? parseFloat(minRatingString) : 0;

  if (!query && !with_genres) {
    return (
      <div className="container mx-auto p-4 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">Search Results</h1>
        <p>Please enter a search query or select a genre.</p>
      </div>
    );
  }

  let results: any[] = [];
  let error: string | null = null;
  let loading = true;

  try {
    let rawResults: any[] = [];
    if (query) {
      const searchData = await searchMulti(query, with_genres, 1);
      if (searchData?.results) {
        rawResults = searchData.results;
      }
    } else if (with_genres) {
      const [movieResults, tvResults] = await Promise.all([
        discoverMovies({ with_genres, 'vote_average.gte': minRating }),
        discoverTvShows({ with_genres, 'vote_average.gte': minRating }),
      ]);
      
      const movies = movieResults?.results?.map((m: any) => ({ ...m, media_type: 'movie' })) || [];
      const tvs = tvResults?.results?.map((t: any) => ({ ...t, media_type: 'tv' })) || [];
      rawResults = [...movies, ...tvs].sort((a, b) => b.popularity - a.popularity);
    }
    
    if (rawResults.length > 0) {
      results = rawResults.filter((item: any) => 
        (item.media_type === 'movie' || item.media_type === 'tv') &&
        item.vote_average >= minRating &&
        item.poster_path
      );
    } else {
      error = 'No results found or failed to fetch data.';
    }
  } catch (err) {
    console.error('Error fetching search results:', err);
    error = 'An unexpected error occurred while fetching search results.';
  } finally {
    loading = false;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-red-500 text-center">
        <h1 className="text-3xl font-bold mb-4">Search Results</h1>
        <p>{error}</p>
      </div>
    );
  }

  const genreNames = with_genres?.split(',').map(id => 
    Object.keys(GENRE_MAP).find(key => GENRE_MAP[key as keyof typeof GENRE_MAP] === parseInt(id))
  ).filter(Boolean).join(', ') || '';

  const pageTitle = query 
    ? `Search Results for "${query}"` 
    : `Results for: ${genreNames}`;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">{pageTitle}</h1>
      {results.length > 0 ? (
        <MovieList movies={results} />
      ) : (
        <p className="text-white text-center">No results found for your query and filters.</p>
      )}
    </div>
  );
};

export default SearchPage;