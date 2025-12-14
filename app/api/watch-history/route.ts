import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchHistory, User, Settings } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('GET /api/watch-history - Session:', session?.user?.email);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    console.log('Connected to database');

    const user = await User.findOne({ email: session.user.email });
    console.log('User found:', user?._id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const limit = request.nextUrl.searchParams.get('limit') || '10';
    const watchHistory = await WatchHistory.find({ userId: user._id })
      .sort({ lastWatchedAt: -1 })
      .limit(parseInt(limit));

    console.log('Watch history items:', watchHistory.length);
    return NextResponse.json(watchHistory);
  } catch (error) {
    console.error('Error fetching watch history:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('POST /api/watch-history - Session:', session?.user?.email);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });
    console.log('User found:', user?._id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current video source setting
    let settings = await Settings.findOne({ key: 'app_settings' });
    const videoSource = settings?.videoSource || 'vidking';
    const isVidsrcMode = videoSource === 'vidsrc';

    const { mediaId, mediaType, title, posterPath, progress, currentTime, totalDuration, seasonNumber, episodeNumber, finished, totalPlayedSeconds } = await request.json();
    console.log('Saving watch history:', { mediaId, mediaType, title, progress, currentTime, totalDuration, seasonNumber, episodeNumber, totalPlayedSeconds, videoSource });

    // Build the update object dynamically
    const updateData: any = {
      userId: user._id,
      mediaId,
      mediaType,
      title,
      posterPath,
      finished: finished || false,
    };

    // Only update progress-related fields if NOT in vidsrc mode
    if (!isVidsrcMode) {
      // Calculate progress as percentage if not provided
      let calculatedProgress = progress;
      
      if (calculatedProgress === undefined || calculatedProgress === null) {
        if (totalDuration && currentTime) {
          calculatedProgress = Math.round((currentTime / totalDuration) * 100);
        } else if (currentTime && !totalDuration) {
          // For embed players without duration info, estimate based on typical movie/episode length
          const estimatedDuration = 120 * 60; // Default to 120 minutes in seconds
          calculatedProgress = Math.round((currentTime / estimatedDuration) * 100);
          // Cap progress at 99% to show it's not fully watched
          if (calculatedProgress > 99) calculatedProgress = 99;
        } else {
          calculatedProgress = 0;
        }
      } else {
        // If progress is provided (from embed player)
        if (calculatedProgress < 1) {
          calculatedProgress = Math.round(calculatedProgress * 10) / 10;
        } else {
          calculatedProgress = Math.max(0, Math.min(100, Math.round(calculatedProgress)));
        }
      }

      updateData.progress = calculatedProgress;
      updateData.currentTime = currentTime || 0;
      updateData.totalDuration = totalDuration || 0;
      updateData.totalPlayedSeconds = totalPlayedSeconds || 0;
      updateData.lastWatchedAt = new Date();
    } else {
      // In vidsrc mode: only track history metadata (title, season, episode), no progress counter
      updateData.progress = 0;
      updateData.currentTime = 0;
      updateData.totalDuration = 0;
      updateData.totalPlayedSeconds = 0;
      // Still update lastWatchedAt so it shows in Continue Watching
      updateData.lastWatchedAt = new Date();
    }

    // Only include seasonNumber and episodeNumber if they have valid values
    if (seasonNumber !== undefined && seasonNumber !== null) {
      updateData.seasonNumber = seasonNumber;
    }
    if (episodeNumber !== undefined && episodeNumber !== null) {
      updateData.episodeNumber = episodeNumber;
    }

    // Build the query - for TV shows, include season and episode to track per-episode progress
    const query: any = { userId: user._id, mediaId, mediaType };
    if (mediaType === 'tv' && seasonNumber !== undefined && episodeNumber !== undefined) {
      query.seasonNumber = seasonNumber;
      query.episodeNumber = episodeNumber;
    }

    const watchHistory = await WatchHistory.findOneAndUpdate(
      query,
      {
        $set: updateData,
      },
      { upsert: true, new: true }
    );

    console.log('Watch history saved successfully:', watchHistory._id);
    return NextResponse.json(watchHistory);
  } catch (error) {
    console.error('Error updating watch history:', error);
    console.error('Full error details:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
