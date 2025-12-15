'use client';

import { useState, useEffect } from 'react';
import { useDisableScroll } from '@/lib/hooks/useDisableScroll';
import { getMediaLogos } from '@/lib/tmdb';

interface Episode {
  episode_number: number;
  name: string;
}

interface Season {
  season_number: number;
  episodes: Episode[];
  poster_path?: string;
}

interface EpisodeSelectorProps {
  tvShowId: string;
  showTitle: string;
  posterPath?: string;
  mediaType?: 'tv' | 'movie';
  onClose: () => void;
  onEpisodeSelect: (season: number, episode: number) => void;
}

export default function EpisodeSelector({
  tvShowId,
  showTitle,
  posterPath,
  mediaType = 'tv',
  onClose,
  onEpisodeSelect,
}: EpisodeSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useDisableScroll(true);

  const posterUrl = posterPath
    ? `https://image.tmdb.org/t/p/w342${posterPath}`
    : '/placeholder.png';

  // Fetch logo on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const tvId = parseInt(tvShowId);
        const imageData = await getMediaLogos('tv', tvId);
        if (imageData?.logos && imageData.logos.length > 0) {
          const englishLogo = imageData.logos.find((logo: any) => logo.iso_639_1 === 'en');
          const logoPath = englishLogo?.file_path || imageData.logos[0]?.file_path;
          if (logoPath) {
            setLogoUrl(`https://image.tmdb.org/t/p/w500${logoPath}`);
          }
        }
      } catch (error) {
        console.error('Error fetching logo:', error);
      }
    };

    if (tvShowId) {
      fetchLogo();
    }
  }, [tvShowId]);

  useEffect(() => {
    if (!tvShowId) return;

    const fetchSeasons = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tv/${tvShowId}/seasons`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch seasons');
        }
        const data = await res.json();
        setSeasons(data.seasons);
        if (data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [tvShowId]);

  const handleSeasonChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const seasonNumber = parseInt(event.target.value, 10);
    const season = seasons.find(s => s.season_number === seasonNumber) || null;
    setSelectedSeason(season);
  };

  const handleEpisodeClick = (episodeNumber: number) => {
    if (selectedSeason) {
      onEpisodeSelect(selectedSeason.season_number, episodeNumber);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 pt-24">
      <div className="bg-neutral-900 rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header with Logo and Title */}
        <div className="relative bg-gradient-to-b from-neutral-800 to-neutral-900 p-4 sm:p-6 border-b border-gray-700">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400 transition-colors flex-shrink-0 z-10"
          >
            &times;
          </button>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Logo or Poster */}
            {logoUrl ? (
              <div className="flex-shrink-0">
                <img
                  src={logoUrl}
                  alt={showTitle}
                  className="h-32 object-contain"
                />
              </div>
            ) : posterPath ? (
              <div className="flex-shrink-0">
                <img
                  src={posterUrl}
                  alt={showTitle}
                  className="rounded-lg border border-gray-600 shadow-lg w-32 h-auto"
                />
              </div>
            ) : null}
            
            {/* Title */}
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 break-words">
                {showTitle}
              </h2>
              <div className="text-gray-400 text-sm">
                Select a season and episode to watch
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Loading episodes...</div>
          )}
          {error && (
            <div className="text-center text-red-500 py-8">Error: {error}</div>
          )}
          {!loading && !error && (
            <>
              {seasons.length > 0 ? (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Select Season
                    </label>
                    <select
                      onChange={handleSeasonChange}
                      value={selectedSeason?.season_number || ''}
                      className="w-full p-3 rounded bg-neutral-800 text-white border border-gray-700 focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 font-medium"
                    >
                      {seasons.map(season => (
                        <option key={season.season_number} value={season.season_number}>
                          Season {season.season_number}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSeason && (
                    <div>
                      <h3 className="text-lg font-bold text-white mb-3">
                        Episodes - Season {selectedSeason.season_number}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedSeason.episodes.map(episode => (
                          <div
                            key={episode.episode_number}
                            onClick={() => handleEpisodeClick(episode.episode_number)}
                            className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded cursor-pointer transition-colors duration-200 border border-gray-700 hover:border-accent group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-10 h-10 bg-accent rounded flex items-center justify-center font-bold text-black text-sm group-hover:bg-red-600 transition-colors">
                                {episode.episode_number}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold text-sm group-hover:text-accent transition-colors truncate">
                                  {episode.name || `Episode ${episode.episode_number}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No seasons found for this show.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}