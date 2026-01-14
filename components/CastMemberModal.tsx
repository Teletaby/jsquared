'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X } from 'lucide-react';
import { getPersonDetails } from '@/lib/tmdb';

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  popularity: number;
  also_known_as: string[];
  combined_credits?: {
    cast: any[];
  };
}

interface CastMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  castMemberId: number;
  castMemberName: string;
  castMemberImage: string | null;
  castMemberCharacter: string;
}

export default function CastMemberModal({
  isOpen,
  onClose,
  castMemberId,
  castMemberName,
  castMemberImage,
  castMemberCharacter,
}: CastMemberModalProps) {
  const [personDetails, setPersonDetails] = useState<PersonDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && castMemberId) {
      setLoading(true);
      getPersonDetails(castMemberId)
        .then((data) => {
          setPersonDetails(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching person details:', error);
          setLoading(false);
        });
    }
  }, [isOpen, castMemberId]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-gray-950 via-gray-900 to-black rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-[10000] p-2 hover:bg-red-600 rounded-full transition-all duration-300 hover:scale-110"
        >
          <X size={28} className="text-white" strokeWidth={3} />
        </button>

        {/* Hero Section with Image */}
        <div className="relative h-80 overflow-hidden group">
          {(castMemberImage || personDetails?.profile_path) && (
            <>
              <Image
                src={`https://image.tmdb.org/t/p/w342${castMemberImage || personDetails?.profile_path}`}
                alt={castMemberName}
                fill
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950" />
            </>
          )}
          {!castMemberImage && !personDetails?.profile_path && (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <span className="text-gray-500 text-lg">No Image Available</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Header with Name and Character */}
          <div className="mb-8 border-b border-gray-800 pb-6">
            <h1 className="text-5xl font-bold text-white mb-2">{castMemberName}</h1>
            {castMemberCharacter && (
              <p className="text-xl text-red-500 font-semibold">
                as <span className="text-gray-300">{castMemberCharacter}</span>
              </p>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-400 mt-4">Loading details...</p>
            </div>
          ) : personDetails ? (
            <>
              {/* Personal Info Grid */}
              <div className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {personDetails.birthday && (
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                      <p className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wider">
                        Date of Birth
                      </p>
                      <p className="text-white font-bold text-lg">
                        {new Date(personDetails.birthday).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  {personDetails.place_of_birth && (
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                      <p className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wider">
                        Place of Birth
                      </p>
                      <p className="text-white font-bold text-lg">{personDetails.place_of_birth}</p>
                    </div>
                  )}
                  {personDetails.popularity && (
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                      <p className="text-gray-500 text-sm font-semibold mb-2 uppercase tracking-wider">
                        Popularity
                      </p>
                      <p className="text-white font-bold text-lg">
                        {Math.round(personDetails.popularity * 10) / 10}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Biography */}
              {personDetails.biography && personDetails.biography.trim() && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">Biography</h2>
                  <p className="text-gray-300 leading-relaxed text-base line-clamp-4">
                    {personDetails.biography}
                  </p>
                </div>
              )}

              {/* Also Known As */}
              {personDetails.also_known_as && personDetails.also_known_as.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-white mb-4">Also Known As</h2>
                  <div className="flex flex-wrap gap-3">
                    {personDetails.also_known_as.slice(0, 6).map((name, idx) => (
                      <span
                        key={idx}
                        className="px-4 py-2 bg-gradient-to-r from-red-900/30 to-red-800/20 text-red-300 rounded-full text-sm font-medium border border-red-600/30 hover:border-red-500 transition-colors"
                      >
                        {name}
                      </span>
                    ))}
                    {personDetails.also_known_as.length > 6 && (
                      <span className="px-4 py-2 text-gray-400 text-sm">
                        +{personDetails.also_known_as.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Known For */}
              {personDetails.combined_credits?.cast && personDetails.combined_credits.cast.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">Known For</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {personDetails.combined_credits.cast
                      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
                      .slice(0, 4)
                      .map((item: any, idx: number) => (
                        <div key={idx} className="group cursor-pointer">
                          <div className="relative overflow-hidden rounded-lg mb-3 aspect-[2/3] bg-gray-800 border border-gray-700 group-hover:border-red-600 transition-all">
                            {item.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                                alt={item.title || item.name}
                                fill
                                className="object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                                <span className="text-gray-500 text-xs text-center px-2">
                                  {item.title || item.name}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-white font-semibold text-sm truncate group-hover:text-red-400 transition-colors">
                            {item.title || item.name}
                          </p>
                          {item.character && (
                            <p className="text-gray-400 text-xs truncate">
                              as {item.character}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Filmography Preview */}
              {personDetails.combined_credits?.cast && personDetails.combined_credits.cast.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">
                    Filmography
                    <span className="text-red-500 text-lg ml-3">
                      {personDetails.combined_credits.cast.length} credits
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {personDetails.combined_credits.cast.slice(0, 8).map((item: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-red-600/50 hover:bg-gray-900 transition-all"
                      >
                        <p className="text-white font-semibold truncate">
                          {item.title || item.name}
                        </p>
                        {item.character && (
                          <p className="text-gray-400 text-sm truncate mt-1">
                            as <span className="text-red-400">{item.character}</span>
                          </p>
                        )}
                        {item.release_date && (
                          <p className="text-gray-500 text-xs mt-2">
                            {new Date(item.release_date).getFullYear()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-center py-12">Failed to load details</p>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
