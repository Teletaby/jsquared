"use client";

import Image from 'next/image';
import Link from 'next/link';
// Removed useState
// Removed TrailerPopup import

interface MovieCardProps {
  id: number;
  title: string;
  posterPath: string;
  voteAverage: number | null | undefined; // Allow null or undefined
  mediaType: 'movie' | 'tv'; // Changed to be more specific for Vidking
}

const MovieCard = ({ id, title, posterPath, voteAverage, mediaType }: MovieCardProps) => {
  // Removed isPopupOpen state

  return (
    <Link href={`/${mediaType}/${id}`} className="block relative"> {/* Link wraps image and overlay */}
      <Image 
        src={posterPath} 
        alt={title}
        width={500}
        height={750}
        className="w-full"
      />
      {/* Unified Overlay for title, rating, and trailer button */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
        <h3 className="text-lg text-white font-bold truncate">{title}</h3>
        <p className="text-yellow-400 mb-2"> {/* Added mb-2 for spacing */}
          Rating: {
            voteAverage !== undefined && voteAverage !== null && !isNaN(voteAverage) ? voteAverage.toFixed(1) : 'N/A'
          }
        </p>
      </div>
    </Link>
  );
};
export default MovieCard;
