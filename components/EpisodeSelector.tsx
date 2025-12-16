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
  currentSeason?: number;
  currentEpisode?: number;
  onClose: () => void;
  onEpisodeSelect: (season: number, episode: number) => void;
}

export default function EpisodeSelector({
  tvShowId,
  showTitle,
  posterPath,
  mediaType = 'tv',
  currentSeason,
  currentEpisode,
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
          // If currentSeason is provided, select that season; otherwise select the first
          const seasonToSelect = currentSeason 
            ? data.seasons.find((s: Season) => s.season_number === currentSeason) || data.seasons[0]
            : data.seasons[0];
          setSelectedSeason(seasonToSelect);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [tvShowId, currentSeason]);

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
      <div className="bg-neutral-900 rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Minimal Header with Close Button */}
        <div className="relative bg-gradient-to-r from-neutral-800 to-neutral-900 p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-300">
            Select Season & Episode
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-3xl transition-colors flex-shrink-0 z-10 -mr-2"
            aria-label="Close"
          >
            ×
          </button>
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
                  <div className="mb-8">
                    <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                      Season
                    </label>
                    <select
                      onChange={handleSeasonChange}
                      value={selectedSeason?.season_number || ''}
                      className="w-full px-4 py-3 rounded-lg bg-neutral-800 text-white border border-neutral-700 hover:border-gray-500 focus:border-accent focus:ring-2 focus:ring-accent focus:ring-opacity-50 transition-all duration-200 font-medium cursor-pointer"
                    >
                      {seasons.map(season => (
                        <option key={season.season_number} value={season.season_number}>
                          Season {season.season_number}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSeason && selectedSeason.episodes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">
                        Season {selectedSeason.season_number} — {selectedSeason.episodes.length} Episodes
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {selectedSeason.episodes.map(episode => {
                          const isCurrentEpisode = 
                            currentSeason === selectedSeason.season_number && 
                            currentEpisode === episode.episode_number;
                          
                          return (
                            <button
                              key={episode.episode_number}
                              onClick={() => handleEpisodeClick(episode.episode_number)}
                              className={`group relative w-full p-4 rounded-lg cursor-pointer transition-all duration-200 border font-medium focus:outline-none focus:ring-2 focus:ring-accent ${
                                isCurrentEpisode
                                  ? 'bg-accent text-black border-accent shadow-lg shadow-accent/50'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 hover:border-accent hover:shadow-lg'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className={`text-2xl font-bold transition-colors duration-200 ${
                                  isCurrentEpisode ? 'text-black' : 'text-accent group-hover:text-white'
                                }`}>
                                  Ep. {episode.episode_number}
                                </div>
                                <p className={`text-xs text-center line-clamp-2 w-full transition-colors duration-200 ${
                                  isCurrentEpisode 
                                    ? 'text-black font-semibold' 
                                    : 'text-white group-hover:text-accent'
                                }`}>
                                  {episode.name || `Episode ${episode.episode_number}`}
                                </p>
                                {isCurrentEpisode && (
                                  <span className="text-xs font-bold uppercase tracking-wider">Now Playing</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
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