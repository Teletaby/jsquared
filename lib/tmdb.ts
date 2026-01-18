import { getFromCache, setCache, CACHE_TTL } from './cache';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Types
export interface ReviewAuthorDetails {
  avatar_path: string | null;
  rating: number | null;
  username: string;
}

export interface Review {
  id: string;
  author: string;
  author_details: ReviewAuthorDetails;
  content: string;
  created_at: string;
  url: string;
}

export interface ReviewsResponse {
  results: Review[];
  total_results: number;
  total_pages: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CastDetails {
  cast: CastMember[];
  crew: any[];
}

export interface TvShowDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  vote_average: number;
  first_air_date: string;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id: string | null };
  seasons: {
    id: number;
    season_number: number;
    name: string;
    episode_count: number;
    poster_path: string;
  }[];
  reviews?: ReviewsResponse;
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  vote_average: number;
  release_date: string;
  runtime: number;
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id: string | null };
  reviews?: ReviewsResponse;
}

export interface EpisodeDetails {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  vote_average: number;
  runtime?: number;
  air_date?: string;
}

export interface SeasonDetails {
  season_number: number;
  name: string;
  episodes: EpisodeDetails[];
}

// Phobia keywords for filtering
export const phobiaKeywords: { [key: string]: number } = {
  'Acrophobia (Fear of Heights)': 16660,
  'Agoraphobia (Fear of Open Spaces)': 16661,
  'Arachnophobia (Fear of Spiders)': 16662,
  'Claustrophobia (Fear of Enclosed Spaces)': 16663,
  'Hemophobia (Fear of Blood)': 16664,
  'Nyctophobia (Fear of Darkness)': 16665,
  'Trypophobia (Fear of Holes)': 16666,
  'Ophidiophobia (Fear of Snakes)': 16667,
  'Cynophobia (Fear of Dogs)': 16668,
};

// Helper function to fetch from TMDB API with caching
async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}) {
  // Create cache key from endpoint and params
  const cacheKey = `tmdb_${endpoint}_${JSON.stringify(params)}`;
  
  // Check cache first
  const cached = getFromCache<any>(cacheKey);
  if (cached) {
    console.log(`[TMDB Cache] Hit: ${endpoint}`);
    return cached;
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY || '');

  // Add additional parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`TMDB API Error: ${response.status} - ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Cache the result (generic TMDB data: 24 hours)
    if (data) {
      setCache(cacheKey, data, CACHE_TTL.TMDB_DETAILS);
      console.log(`[TMDB Cache] Stored: ${endpoint}`);
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch from TMDB:', error);
    return null;
  }
}

// Get popular movies
export async function getPopularMovies(page: string = '1') {
  return fetchFromTMDB('/movie/popular', { page });
}

// Get trending movies
export async function getTrendingMovies(page: string = '1') {
  return fetchFromTMDB('/trending/movie/week', { page });
}

// Get top rated TV shows
export async function getTopRatedTvShows(page: string = '1') {
  return fetchFromTMDB('/tv/top_rated', { page });
}

// Get airing today TV shows
export async function getAiringTodayTvShows(page: string = '1') {
  return fetchFromTMDB('/tv/on_the_air', { page });
}

// Get trending this week
export async function getTrendingWeek() {
  return fetchFromTMDB('/trending/all/week');
}

// Get trending today (daily top)
export async function getTrendingDay() {
  return fetchFromTMDB('/trending/all/day');
}

// Get popular TV shows
export async function getPopularTvShows(page: string = '1') {
  return fetchFromTMDB('/tv/popular', { page });
}

// Get unreleased movies (with future release dates, sorted by popularity)
export async function getUnreleasedMovies(page: string = '1') {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Get tomorrow's date in YYYY-MM-DD format
  return fetchFromTMDB('/discover/movie', {
    'primary_release_date.gte': tomorrowStr,
    'sort_by': 'popularity.desc',
    'page': page,
  });
}

// Get unreleased TV shows (with future air dates, sorted by popularity)
export async function getUnreleasedTvShows(page: string = '1') {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Get tomorrow's date in YYYY-MM-DD format
  return fetchFromTMDB('/discover/tv', {
    'first_air_date.gte': tomorrowStr,
    'sort_by': 'popularity.desc',
    'page': page,
  });
}

// Get movie details
export async function getMovieDetails(movieId: number): Promise<MovieDetails | null> {
  const params = {
    append_to_response: 'external_ids,reviews',
  };
  return fetchFromTMDB(`/movie/${movieId}`, params);
}

// Get TV show details
export async function getTvShowDetails(tvShowId: number): Promise<TvShowDetails | null> {
  const params = {
    append_to_response: 'external_ids,reviews',
  };
  return fetchFromTMDB(`/tv/${tvShowId}`, params);
}

// Get TV season details
export async function getTvSeasonDetails(tvShowId: number, seasonNumber: number): Promise<SeasonDetails | null> {
  return fetchFromTMDB(`/tv/${tvShowId}/season/${seasonNumber}`);
}

// Get cast details
export async function getCastDetails(mediaType: 'movie' | 'tv', id: number): Promise<CastDetails | null> {
  const endpoint = mediaType === 'movie' ? `/movie/${id}/credits` : `/tv/${id}/aggregate_credits`;
  const data = await fetchFromTMDB(endpoint);

  if (!data) return null;

  // For TV shows, the aggregate_credits response has a different structure
  if (mediaType === 'tv') {
    // TV aggregate_credits returns cast with roles array, need to extract the character name from the first role
    const processedCast = (data.cast || []).map((member: any) => ({
      id: member.id,
      name: member.name,
      character: member.roles?.[0]?.character || member.character || '', // Try roles first, then character field
      profile_path: member.profile_path || null,
      order: member.order || 0,
    }));
    
    return {
      cast: processedCast.slice(0, 50),
      crew: data.crew || [],
    };
  }

  return {
    cast: data.cast?.slice(0, 50) || [],
    crew: data.crew || [],
  };
}

// Get movie videos
export async function getMovieVideos(movieId: number) {
  return fetchFromTMDB(`/movie/${movieId}/videos`);
}

// Get TV show videos
export async function getTvShowVideos(tvShowId: number) {
  return fetchFromTMDB(`/tv/${tvShowId}/videos`);
}

// Get recommendations for a movie
export async function getMovieRecommendations(movieId: number) {
  return fetchFromTMDB(`/movie/${movieId}/recommendations`);
}

// Get recommendations for a TV show
export async function getTvRecommendations(tvId: number) {
  return fetchFromTMDB(`/tv/${tvId}/recommendations`);
}

// Search multi (movies, TV shows, and people)
export async function searchMulti(query: string, withGenres: string = '', page: string = '1') {
  const params: Record<string, string> = {
    query: encodeURIComponent(query),
    page,
  };

  if (withGenres) {
    params.with_genres = withGenres;
  }

  return fetchFromTMDB('/search/multi', params);
}

// Discover movies with filters
export async function discoverMovies(filters: Record<string, string> = {}) {
  return fetchFromTMDB('/discover/movie', filters);
}

// Discover TV shows with filters
export async function discoverTvShows(filters: Record<string, string> = {}) {
  return fetchFromTMDB('/discover/tv', filters);
}

// Get movie/TV show logos and images
export async function getMediaLogos(mediaType: 'movie' | 'tv', id: number) {
  const endpoint = mediaType === 'movie' ? `/movie/${id}/images` : `/tv/${id}/images`;
  const data = await fetchFromTMDB(endpoint);
  
  if (!data) return null;

  // Return logos if available, otherwise return null
  return {
    logos: data.logos || [],
    posters: data.posters || [],
  };
}

// Get person details
export async function getPersonDetails(personId: number) {
  return fetchFromTMDB(`/person/${personId}`, {
    append_to_response: 'combined_credits',
  });
}

// Get similar movies
export async function getSimilarMovies(movieId: number) {
  return fetchFromTMDB(`/movie/${movieId}/similar`);
}

// Get similar TV shows
export async function getSimilarTvShows(tvId: number) {
  return fetchFromTMDB(`/tv/${tvId}/similar`);
}
