import { NextResponse } from 'next/server';
import { getMovieVideos, getTvShowVideos } from '@/lib/tmdb';

// Function to check if a YouTube video is age-restricted
async function isVideoAgeRestricted(videoId: string): Promise<boolean> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('YouTube API key not configured - skipping age restriction check');
      return false;
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=contentDetails`
    );

    if (!response.ok) {
      console.warn('Failed to check video age restriction:', response.statusText);
      return false;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const contentDetails = data.items[0].contentDetails;
      // Check if video has age-restricted rating (18+)
      const rating = contentDetails?.contentRating?.ytRating;
      const isRestricted = rating === 'ytAgeRestricted';
      if (isRestricted) {
        console.log(`Video ${videoId} is age-restricted`);
      }
      return isRestricted;
    }
  } catch (error) {
    console.error('Error checking video age restriction:', error);
    // Default to allowing the video if we can't check
    return false;
  }
  return false;
}

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
      // First, try to find a YouTube Trailer type video
      let trailer = videos.results.find((vid: any) => vid.type === 'Trailer' && vid.site === 'YouTube');
      
      // If no Trailer found, try other video types in order of preference
      if (!trailer) {
        // Try Teaser
        trailer = videos.results.find((vid: any) => vid.type === 'Teaser' && vid.site === 'YouTube');
      }
      
      if (!trailer) {
        // Try Clip
        trailer = videos.results.find((vid: any) => vid.type === 'Clip' && vid.site === 'YouTube');
      }
      
      if (!trailer) {
        // Last resort: any YouTube video
        trailer = videos.results.find((vid: any) => vid.site === 'YouTube');
      }
      
      if (trailer) {
        // Check if the video is age-restricted
        const isRestricted = await isVideoAgeRestricted(trailer.key);
        if (isRestricted) {
          // Return indication that video is age-restricted
          return NextResponse.json({ 
            trailerKey: null,
            ageRestricted: true,
            message: 'Trailer is age-restricted and cannot be embedded'
          });
        }
        return NextResponse.json({ trailerKey: trailer.key });
      } else {
        console.log(`No suitable YouTube video found for media ID ${id}. All videos found:`, videos.results);
      }
    } else {
      console.log(`No video results found for media ID ${id}.`);
    }
    return NextResponse.json({ message: 'No trailer found' }, { status: 404 });
  } catch (error) {
    console.error('Error in API route fetching trailer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
