import { NextRequest, NextResponse } from 'next/server';
import { getMovieRecommendations, getTvRecommendations } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const mediaType = request.nextUrl.searchParams.get('mediaType');
    const id = parseInt(request.nextUrl.searchParams.get('id') || '0');

    if (!mediaType || !id) {
      return NextResponse.json({ results: [] });
    }

    if (mediaType === 'movie') {
      const data = await getMovieRecommendations(id);
      return NextResponse.json(data || { results: [] });
    }

    if (mediaType === 'tv') {
      const data = await getTvRecommendations(id);
      return NextResponse.json(data || { results: [] });
    }

    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json({ results: [] });
  }
}