import { NextRequest, NextResponse } from 'next/server';
import { discoverMovies, discoverTvShows } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('mediaType') || 'movie';
    
    // Build filters from query params
    const filters: Record<string, string> = {
      sort_by: 'popularity.desc', // Sort by popularity by default
    };
    
    if (searchParams.has('with_genres')) {
      filters.with_genres = searchParams.get('with_genres') || '';
    }

    // Fetch data based on media type
    let data;
    if (mediaType === 'tv') {
      data = await discoverTvShows(filters);
    } else {
      data = await discoverMovies(filters);
    }

    return NextResponse.json(data || { results: [] });
  } catch (error) {
    console.error('Discover API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discover content' },
      { status: 500 }
    );
  }
}
