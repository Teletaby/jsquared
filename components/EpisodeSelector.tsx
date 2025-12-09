'use client';

import { useState, useEffect } from 'react';

interface Episode {
  episode_number: number;
  name: string;
}

interface Season {
  season_number: number;
  episodes: Episode[];
}

interface EpisodeSelectorProps {
  tvShowId: string;
  showTitle: string;
  onClose: () => void;
  onEpisodeSelect: (season: number, episode: number) => void;
}

export default function EpisodeSelector({
  tvShowId,
  showTitle,
  onClose,
  onEpisodeSelect,
}: EpisodeSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-neutral-900 p-5 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl text-white">{showTitle}</h2>
          <button onClick={onClose} className="text-white text-2xl hover:text-gray-400 transition-colors">&times;</button>
        </div>

        {loading && <div className="text-center text-gray-400">Loading episodes...</div>}
        {error && <div className="text-center text-red-500">Error: {error}</div>}
        {!loading && !error && (
          <>
            {seasons.length > 0 ? (
              <>
                <select
                  onChange={handleSeasonChange}
                  value={selectedSeason?.season_number || ''}
                  className="w-full p-2 rounded bg-neutral-800 text-white mb-4 border border-gray-700 focus:ring-accent focus:border-accent transition-all duration-200"
                >
                  {seasons.map(season => (
                    <option key={season.season_number} value={season.season_number}>
                      Season {season.season_number}
                    </option>
                  ))}
                </select>

                {selectedSeason && (
                  <ul className="space-y-2">
                    {selectedSeason.episodes.map(episode => (
                      <li 
                        key={episode.episode_number} 
                        onClick={() => handleEpisodeClick(episode.episode_number)} 
                        className="p-3 bg-neutral-800 rounded hover:bg-neutral-700 cursor-pointer text-gray-300 flex justify-between items-center transition-colors duration-200"
                      >
                        <span className="font-semibold">Episode {episode.episode_number}: {episode.name}</span>
                        {/* Optional: Add episode overview or runtime here */}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500">No seasons found for this show.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}