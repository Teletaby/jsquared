'use client';

import { useState, useEffect } from 'react';
import { useDisableScroll } from '@/lib/hooks/useDisableScroll';
import { getMediaLogos } from '@/lib/tmdb';

interface Episode {
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string;
  vote_average?: number;
}

interface Season {
  season_number: number;
  episodes: Episode[];
  poster_path?: string;
}

interface EpisodeSelectorProps {
  tvShowId: string;
  showTitle?: string;
  posterPath?: string;
  currentSeason?: number;
  currentEpisode?: number;
  onClose: () => void;
  onEpisodeSelect: (season: number, episode: number) => void;
}

export default function EpisodeSelector({
  tvShowId,
  showTitle,
  posterPath,
  currentSeason,
  currentEpisode,
  onClose,
  onEpisodeSelect,
}: EpisodeSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useDisableScroll(true);

  // Fetch logo on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const tvId = parseInt(tvShowId);
        const imageData = await getMediaLogos('tv', tvId);
        if (imageData?.logos && imageData.logos.length > 0) {
          const englishLogo = imageData.logos.find((logo: unknown) => (logo as { iso_639_1: string }).iso_639_1 === 'en');
          const logoPath = englishLogo?.file_path || imageData.logos[0]?.file_path;
          if (logoPath) {
            // Logo fetched but not used
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
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[999999] p-4 backdrop-blur-sm pt-24">
      <div className="bg-neutral-950 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-neutral-800">
        {/* Minimal Header with Close Button */}
        <div className="relative bg-white/10 backdrop-blur-md p-4 sm:p-6 border-b border-white/20 flex items-center justify-between sticky top-0 z-10">
          <div className="text-lg font-bold text-white tracking-wider">
            Select Season & Episode
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white text-3xl transition-colors flex-shrink-0 z-10 -mr-2 hover:scale-110 duration-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-8">
          {loading && (
            <div className="text-center text-gray-400 py-12">Loading episodes...</div>
          )}
          {error && (
            <div className="text-center text-red-500 py-12">Error: {error}</div>
          )}
          {!loading && !error && (
            <>
              {seasons.length > 0 ? (
                <>
                  <div className="mb-10">
                    <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-[0.15em] text-opacity-80">
                      Season
                    </label>
                    <select
                      onChange={handleSeasonChange}
                      value={selectedSeason?.season_number || ''}
                      className="w-full px-4 py-3 rounded-lg bg-neutral-900 text-white border border-neutral-700 hover:border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-600/30 transition-all duration-200 font-medium cursor-pointer"
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
                      <h3 className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-[0.15em] text-opacity-70">
                        Season {selectedSeason.season_number} — {selectedSeason.episodes.length} Episodes
                      </h3>
                      <div className="space-y-4">
                        {selectedSeason.episodes.map(episode => {
                          const isCurrentEpisode = 
                            currentSeason === selectedSeason.season_number && 
                            currentEpisode === episode.episode_number;
                          
                          return (
                            <button
                              key={episode.episode_number}
                              onClick={() => handleEpisodeClick(episode.episode_number)}
                              className={`w-full rounded-xl cursor-pointer transition-all duration-300 border-2 focus:outline-none focus:ring-2 focus:ring-red-600/50 overflow-hidden group ${
                                isCurrentEpisode
                                  ? 'bg-red-600/20 border-red-600'
                                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 hover:border-red-600'
                              }`}
                            >
                              <div className="flex gap-4 p-4">
                                {/* Episode Image */}
                                <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-700">
                                  {episode.still_path ? (
                                    <img 
                                      src={`https://image.tmdb.org/t/p/w300${episode.still_path}`} 
                                      alt={episode.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                      No Image
                                    </div>
                                  )}
                                </div>

                                {/* Episode Info */}
                                <div className="flex-1 flex flex-col justify-between text-left min-w-0">
                                  <div>
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className={`text-2xl font-bold transition-colors duration-200 ${
                                        isCurrentEpisode ? 'text-red-600' : 'text-red-500'
                                      }`}>
                                        {episode.episode_number}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold transition-colors duration-200 truncate ${
                                          isCurrentEpisode ? 'text-white' : 'text-white group-hover:text-red-400'
                                        }`}>
                                          {episode.name || `Episode ${episode.episode_number}`}
                                        </h4>
                                      </div>
                                      {isCurrentEpisode && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 whitespace-nowrap ml-2">Now Playing</span>
                                      )}
                                    </div>
                                    {episode.vote_average && (
                                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                                        <span>★</span>
                                        <span>{episode.vote_average.toFixed(1)}/10</span>
                                      </div>
                                    )}
                                  </div>
                                  {episode.overview && (
                                    <p className={`text-sm line-clamp-2 transition-colors duration-200 ${
                                      isCurrentEpisode ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-300'
                                    }`}>
                                      {episode.overview}
                                    </p>
                                  )}
                                </div>
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