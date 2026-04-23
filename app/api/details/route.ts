import { NextRequest, NextResponse } from 'next/server';
import { getMovieDetails, getTvShowDetails } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('mediaType') as 'movie' | 'tv';
    const id = searchParams.get('id');

    if (!mediaType || !id) {
      return NextResponse.json(
        { error: 'Missing mediaType or id' },
        { status: 400 }
      );
    }

    let details;
    if (mediaType === 'movie') {
      details = await getMovieDetails(parseInt(id));
    } else if (mediaType === 'tv') {
      details = await getTvShowDetails(parseInt(id));
    } else {
      return NextResponse.json(
        { error: 'Invalid mediaType' },
        { status: 400 }
      );
    }

    return NextResponse.json(details || {});
  } catch (error) {
    console.error('Error fetching details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch details' },
      { status: 500 }
    );
  }
}
