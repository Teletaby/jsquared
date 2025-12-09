import { NextResponse } from 'next/server';
import { getMovieVideos, getTvShowVideos } from '@/lib/tmdb';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get('mediaType');

  if (!id || !mediaType) {
    return NextResponse.json({ error: 'Missing mediaType or id' }, { status: 400 });
  }

  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 });
  }

  try {
    let videos;
    if (mediaType === 'movie') {
      videos = await getMovieVideos(Number(id));
    } else if (mediaType === 'tv') {
      videos = await getTvShowVideos(Number(id));
    }

    if (videos && videos.results && videos.results.length > 0) {
      const trailer = videos.results.find((vid: any) => vid.type === 'Trailer' && vid.site === 'YouTube');
      if (trailer) {
        return NextResponse.json({ trailerKey: trailer.key });
      }
    }
    return NextResponse.json({ message: 'No trailer found' }, { status: 404 });
  } catch (error) {
    console.error('Error in API route fetching trailer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
