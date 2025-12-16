import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Video Proxy API - Handles Videasy, VidLink, and VidSrc video extraction
 * This allows us to:
 * 1. Get direct video URLs (if available)
 * 2. Track playback without iframe limitations
 * 3. Implement custom player controls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, tmdbId, season, episode, mediaType } = body;

    // Validate input
    if (!source || !tmdbId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    let videoUrl = '';
    let metadata = {};

    // Handle Videasy (Source 1)
    if (source === 'videasy') {
      const embedUrl = mediaType === 'movie'
        ? `https://player.videasy.net/movie/${tmdbId}?color=E50914&overlay=true&autoplay=true`
        : `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}?color=E50914&overlay=true&autoplay=true`;
      
      videoUrl = embedUrl;
      metadata = {
        source: 'videasy',
        embedUrl,
        features: {
          supportsProgress: true,
          supportsSubtitles: true,
          supportsQualitySelect: true,
        },
      };
    }

    // Handle VidLink (Source 2)
    if (source === 'vidlink') {
      const embedUrl = mediaType === 'movie'
        ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=E50914&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=true`
        : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=E50914&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=true`;
      
      videoUrl = embedUrl;
      metadata = {
        source: 'vidlink',
        embedUrl,
        features: {
          supportsProgress: true,
          supportsSubtitles: true,
          supportsQualitySelect: true,
        },
      };
    }

    // Handle VidSrc (Source 3)
    if (source === 'vidsrc') {
      const embedUrl = `https://vidsrc.icu/embed/${mediaType}/${tmdbId}${
        season && episode ? `/${season}/${episode}` : ''
      }`;
      videoUrl = embedUrl;
      metadata = {
        source: 'vidsrc',
        embedUrl,
        features: {
          supportsProgress: false, // VidSrc doesn't support progress parameter
          supportsSubtitles: true,
          supportsQualitySelect: false,
        },
      };
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'Unsupported video source' }, { status: 400 });
    }

    return NextResponse.json({
      url: videoUrl,
      metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Video proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to process video request', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for retrieving video information
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const source = params.get('source');
    const tmdbId = params.get('tmdbId');
    const mediaType = params.get('mediaType') || 'movie';

    if (!source || !tmdbId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Return capabilities of each source
    const capabilities = {
      videasy: {
        name: 'Videasy',
        supportsProgress: true,
        supportsAutoResume: true,
        supportsQuality: true,
        supportsSubtitles: true,
        latency: 'low',
      },
      vidlink: {
        name: 'VidLink',
        supportsProgress: true,
        supportsAutoResume: true,
        supportsQuality: true,
        supportsSubtitles: true,
        latency: 'low',
      },
      vidsrc: {
        name: 'VidSrc',
        supportsProgress: false,
        supportsAutoResume: false,
        supportsQuality: false,
        supportsSubtitles: true,
        latency: 'medium',
      },
    };

    return NextResponse.json({
      source,
      tmdbId,
      mediaType,
      capabilities: (capabilities as any)[source] || null,
    });
  } catch (error) {
    console.error('Video info error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve video information' },
      { status: 500 }
    );
  }
}
