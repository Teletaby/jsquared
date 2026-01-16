import { NextResponse } from 'next/server';
import { getTvShowDetails, getTvSeasonDetails } from '@/lib/tmdb';

export async function GET(request: Request, { params }: { params: { tvShowId: string } }) {
  const tvShowId = parseInt(params.tvShowId, 10);

  if (isNaN(tvShowId)) {
    return NextResponse.json({ message: 'Invalid TV Show ID' }, { status: 400 });
  }

  try {
    const tvShow = await getTvShowDetails(tvShowId);

    if (!tvShow) {
      return NextResponse.json({ message: 'TV Show not found' }, { status: 404 });
    }

    const seasonsData = await Promise.all(
      tvShow.seasons.map(async (season: any) => {
        if (season.season_number === 0) { // Skip "Specials" season usually Season 0
          return null;
        }
        const seasonDetails = await getTvSeasonDetails(tvShowId, season.season_number);
        return {
          season_number: season.season_number,
          name: season.name,
          episodes: seasonDetails?.episodes.map((episode: any) => ({
            episode_number: episode.episode_number,
            name: episode.name,
            overview: episode.overview,
            still_path: episode.still_path,
            vote_average: episode.vote_average,
            air_date: episode.air_date,
          })) || [],
        };
      })
    );

    // Filter out nulls from the specials season
    const filteredSeasonsData = seasonsData.filter(Boolean);

    return NextResponse.json({ seasons: filteredSeasonsData });
  } catch (error) {
    console.error('Error fetching TV show seasons:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
