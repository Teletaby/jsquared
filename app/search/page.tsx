import { searchMulti, searchPerson, discoverMovies, discoverTvShows, getPersonDetails } from '@/lib/tmdb';
import MovieList from '@/components/MovieList';
import LoadingSpinner from '@/components/LoadingSpinner';
import Header from '@/components/Header';
import { GENRE_MAP } from '@/lib/genreMap';
import Image from 'next/image';
import ArtistAIChat from '@/components/ArtistAIChat';

interface SearchPageProps {
  searchParams: {
    query?: string;
    type?: string;
    with_genres?: string;
    minRating?: string;
  };
}

const SearchPage = async ({ searchParams }: SearchPageProps) => {
  const { query, type, with_genres, minRating: minRatingString } = searchParams;
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
  let personInfo: any = null;
  let loading = true;
  let pageTitle = '';

  try {
    if (type === 'person' && query) {
      // Search for person
      const searchData = await searchPerson(query, '1');
      
      if (searchData?.results && searchData.results.length > 0) {
        // Get the first person result with the most popularity
        const person = searchData.results.sort((a: any, b: any) => b.popularity - a.popularity)[0];
        
        if (person && person.id) {
          const personDetails = await getPersonDetails(person.id);
          personInfo = personDetails;
          
          // Get combined credits (movies and TV shows)
          if (personDetails?.combined_credits?.cast) {
            const allMedia = personDetails.combined_credits.cast
              .filter((item: any) => item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv'))
              .sort((a: any, b: any) => {
                const dateA = new Date(a.release_date || a.first_air_date || '').getTime();
                const dateB = new Date(b.release_date || b.first_air_date || '').getTime();
                return dateB - dateA;
              });
            
            results = allMedia;
          }
          
          pageTitle = `${personDetails.name}`;
        }
      } else {
        error = 'No artists found with that name.';
      }
    } else if (query) {
      // Search for movies or TV shows
      const searchData = await searchMulti(query, with_genres, '1');
      
      if (searchData?.results) {
        const rawResults = searchData.results.filter((item: any) => item.poster_path);
        
        // When searching for media, include both movies and TV shows
        results = rawResults.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
        results = results.filter((item: any) => item.vote_average >= minRating);
      }
      
      pageTitle = `Results for "${query}"`;
    } else if (with_genres) {
      const [movieResults, tvResults] = await Promise.all([
        discoverMovies({ with_genres, 'vote_average.gte': minRating.toString() }),
        discoverTvShows({ with_genres, 'vote_average.gte': minRating.toString() }),
      ]);
      
      const movies = movieResults?.results?.map((m: any) => ({ ...m, media_type: 'movie' })) || [];
      const tvs = tvResults?.results?.map((t: any) => ({ ...t, media_type: 'tv' })) || [];
      results = [...movies, ...tvs].sort((a, b) => b.popularity - a.popularity);
      
      const genreNames = with_genres?.split(',').map(id => 
        Object.keys(GENRE_MAP).find(key => GENRE_MAP[key as keyof typeof GENRE_MAP] === id)
      ).filter(Boolean).join(', ') || '';
      pageTitle = `Results for: ${genreNames}`;
    }
    
    if (results.length === 0 && !error) {
      error = 'No results found for your search.';
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

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pt-24">
        {personInfo && (
          <div className="backdrop-blur-2xl bg-white/20 border border-white/20 p-6 rounded-lg shadow-lg mb-8">
            <div className="flex flex-col md:flex-row gap-6">
              {personInfo.profile_path && (
                <div className="flex-shrink-0">
                  <Image
                    src={`https://image.tmdb.org/t/p/w300${personInfo.profile_path}`}
                    alt={personInfo.name}
                    width={200}
                    height={300}
                    className="rounded-lg shadow-lg"
                  />
                </div>
              )}
              <div className="flex-grow">
                <h1 className="text-4xl font-bold text-white mb-2">{personInfo.name}</h1>
                {personInfo.known_for_department && (
                  <p className="text-accent text-lg mb-4">
                    Known for: <span className="font-semibold">{personInfo.known_for_department}</span>
                  </p>
                )}
                {personInfo.biography && (
                  <p className="text-gray-300 mb-4 line-clamp-4">{personInfo.biography}</p>
                )}
                {personInfo.birthday && (
                  <p className="text-gray-400 text-sm">
                    Born: {new Date(personInfo.birthday).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                )}
                {personInfo.place_of_birth && (
                  <p className="text-gray-400 text-sm">Place of Birth: {personInfo.place_of_birth}</p>
                )}
                <div className="mt-6">
                  <ArtistAIChat artistName={personInfo.name} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">{pageTitle}</h2>
        
        {error && (
          <p className="text-white text-center py-8">{error}</p>
        )}
        
        {results.length > 0 ? (
          <MovieList movies={results} />
        ) : !error ? (
          <p className="text-white text-center">No results found for your query.</p>
        ) : null}
      </div>
    </>
  );
};

export default SearchPage;