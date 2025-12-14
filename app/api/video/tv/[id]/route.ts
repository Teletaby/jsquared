import { NextRequest, NextResponse } from 'next/server';
import { getTvShowDetails } from '@/lib/tmdb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tvId = parseInt(params.id);

    // Fetch TV show details from TMDB
    const tv = await getTvShowDetails(tvId);

    if (!tv) {
      return NextResponse.json(
        { error: 'TV show not found' },
        { status: 404 }
      );
    }

    // Construct Vidking URL for TV show
    const season = request.nextUrl.searchParams.get('season') || '1';
    const episode = request.nextUrl.searchParams.get('episode') || '1';
    const vidkingUrl = `https://www.vidking.net/embed/tv/${tvId}/${season}/${episode}?autoPlay=true&nextEpisode=true&episodeSelector=true`;

    return NextResponse.json({
      id: tv.id,
      name: tv.name,
      posterPath: tv.poster_path,
      overview: tv.overview,
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
