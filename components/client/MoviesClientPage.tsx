"use client";

import MovieList from '@/components/MovieList';
import LoadingSpinner from '@/components/LoadingSpinner';

interface MoviesClientPageProps {
  movies: any[];
  error: string | null;
}

const MoviesClientPage: React.FC<MoviesClientPageProps> = ({ movies, error }) => {
  // If error is present, display it
  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  // If no movies and no error, it means loading is still in progress (or no movies found)
  // We'll let the parent (server component) handle initial loading state.
  // For now, if movies array is empty, we can show a message or assume parent handles LoadingSpinner.
  if (!movies || movies.length === 0) {
    return <div className="text-white text-center p-4">No popular movies found.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-white mb-6">Popular Movies</h1>
      <MovieList movies={movies} />
    </div>
  );
};

export default MoviesClientPage;
