import { NextRequest, NextResponse } from 'next/server';
import { getTvShowDetails } from '@/lib/tmdb';

export async function GET(
  request: NextRequest,
  { params }: { params: { tvShowId: string } }
) {
  try {
    const tvShowId = parseInt(params.tvShowId);
    const season = request.nextUrl.searchParams.get('season') || '1';
    const episode = request.nextUrl.searchParams.get('episode') || '1';

    // Fetch TV show details from TMDB
    const tvShow = await getTvShowDetails(tvShowId);

    if (!tvShow) {
      return NextResponse.json(
        { error: 'TV show not found' },
        { status: 404 }
      );
    }

    // Construct Vidking URL for the TV show
    const vidkingUrl = `https://www.vidking.net/embed/tv/${tvShowId}/${season}/${episode}?autoPlay=true&nextEpisode=true&episodeSelector=true`;

    return NextResponse.json({
      id: tvShow.id,
      name: tvShow.name,
      posterPath: tvShow.poster_path,
      overview: tvShow.overview,
      videoUrl: vidkingUrl,
      currentSeason: season,
      currentEpisode: episode,
    });
  } catch (error) {
    console.error('Error fetching TV show:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TV show' },
      { status: 500 }
    );
  }
}
