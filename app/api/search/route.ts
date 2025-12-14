import { NextRequest, NextResponse } from 'next/server';
import { searchMulti } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const type = searchParams.get('type') || 'multi';

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters', results: [] },
        { status: 400 }
      );
    }

    // Use TMDB search function
    const response = await searchMulti(query);

    if (!response) {
      return NextResponse.json({ results: [] });
    }

    // Filter out results without poster images and format response
    const results = response.results
      .filter((item: any) => item.poster_path)
      .slice(0, 20)
      .map((item: any) => ({
        id: item.id,
        title: item.title || item.name,
        name: item.name,
        poster_path: item.poster_path,
        media_type: item.media_type,
      }));

    return NextResponse.json({
      query,
      results,
      total: response.total_results,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search', results: [] },
      { status: 500 }
    );
  }
}
