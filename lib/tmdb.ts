const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// This log will appear in your terminal when the server starts or when a server component fetches data.
// It's the best way to confirm if your .env.local file is being read.
console.log('TMDB_API_KEY loaded by server:', TMDB_API_KEY ? `${TMDB_API_KEY.substring(0, 4)}...` : 'NOT FOUND');

// A helper function to fetch data from TMDB with error handling and caching
const fetchFromTMDB = async (endpoint: string, params: Record<string, string | number> = {}) => {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not defined. Please check your .env.local file and restart the server.");
    return null;
  }

  const queryParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: 'en-US',
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
  });
  const url = `${TMDB_BASE_URL}/${endpoint}?${queryParams.toString()}`;
  console.log('TMDB API Request URL:', url); // Added for debugging

  try {
    // Use Next.js extended fetch for server-side caching (revalidates every hour)
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) {
      console.error(`TMDB API call failed for endpoint "${endpoint}": ${response.statusText}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching from TMDB endpoint "${endpoint}":`, error);
    return null;
  }
};

// --- Functions for fetching lists of media ---

export const getPopularMovies = () => fetchFromTMDB('movie/popular');

export const getPopularTvShows = () => fetchFromTMDB('tv/popular');

export const getTopRatedTvShows = () => fetchFromTMDB('tv/top_rated');

export const getAiringTodayTvShows = () => fetchFromTMDB('tv/airing_today');

export const getTrendingWeek = () => fetchFromTMDB('trending/all/week');

// This is a versatile endpoint. For now, it fetches a default discovery list.
// It can be expanded to accept filters (e.g., `discover/movie?with_genres=28`)
export const discoverMovies = (params: Record<string, string | number> = {}) => fetchFromTMDB('discover/movie', params);

export const discoverTvShows = (params: Record<string, string | number> = {}) => fetchFromTMDB('discover/tv', params);

// --- Functions for fetching detailed media information ---

export const getMovieDetails = (id: number) => fetchFromTMDB(`movie/${id}`, { append_to_response: 'external_ids' });

export const getTvShowDetails = (id: number) => fetchFromTMDB(`tv/${id}`, { append_to_response: 'external_ids' });

export const getMovieVideos = (id: number) => fetchFromTMDB(`movie/${id}/videos`);

export const getTvShowVideos = (id: number) => fetchFromTMDB(`tv/${id}/videos`);

export const searchMulti = async (query: string, with_genres: string | undefined, page: number = 1) => {
  const params: Record<string, string | number> = { page };

  if (with_genres) {
    params.with_genres = with_genres;
    // When searching by genre, we need to use the discover endpoint
    // We'll search both movies and TV shows and combine the results if query is also present
    const movieResults = await discoverMovies({ ...params, with_text_query: query });
    const tvResults = await discoverTvShows({ ...params, with_text_query: query });

    const combinedResults = [];
    if (movieResults?.results) {
      combinedResults.push(...movieResults.results.map((item: any) => ({ ...item, media_type: 'movie' })));
    }
    if (tvResults?.results) {
      combinedResults.push(...tvResults.results.map((item: any) => ({ ...item, media_type: 'tv' })));
    }
    
    // Basic sorting by popularity (descending)
    combinedResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    return { results: combinedResults };

  } else {
    // Original search behavior when no genres are specified
    let endpoint = 'search/multi';
    params.query = query;
    params.include_adult = false; // Only for multi/movie/tv search

    return fetchFromTMDB(endpoint, params);
  }
};

export const getTvSeasonDetails = (id: number, seasonNumber: number) => fetchFromTMDB(`tv/${id}/season/${seasonNumber}`);


// Placeholder for phobia keywords - these should ideally come from a TMDB keywords list
// or a configuration. For now, using example IDs.
export const phobiaKeywords: Record<string, number> = {
  "arachnophobia": 180547, // Example ID for "spiders"
  "claustrophobia": 180550, // Example ID for "tight spaces"
  "hemophobia": 180553,     // Example ID for "blood"
  "nyctophobia": 180556,    // Example ID for "darkness"
  "ophidiophobia": 180559,  // Example ID for "snakes"
  "scopophobia": 180562,    // Example ID for "being watched"
  "acrophobia": 180565,     // Example ID for "heights"
  "coulrophobia": 180568,   // Example ID for "clowns"
};