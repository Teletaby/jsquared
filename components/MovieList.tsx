"use client";

import MediaCard from './MediaCard';

interface Media {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string;
  vote_average?: number;
  media_type?: 'movie' | 'tv';
  name?: string; // TV shows often use 'name' instead of 'title'
}

interface MovieListProps {
  movies: Media[]; // Expects an array of movie/tv objects
}

const MovieList: React.FC<MovieListProps> = ({ movies }) => {
  if (!movies || movies.length === 0) {
    return (
      <div className="text-center text-gray-500 bg-ui-elements p-8 rounded-lg my-8">
        <h3 className="text-xl mb-2">No Content Found</h3>
        <p>There are no items to display.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 my-8">
        {movies.map((media: Media) => (
          <MediaCard
            key={media.id}
            media={media}
          />
        ))}
      </div>
    </>
  );
};

export default MovieList;