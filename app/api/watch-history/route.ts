import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchHistory, User, Settings } from '@/lib/models';
import { queuePlaytimeUpdate } from '@/lib/playtimeBatch';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

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
    // Rate limit video updates to prevent excessive requests
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(`playtime_${ip}`, RATE_LIMITS.VIDEO)) {
      return NextResponse.json(
        { error: 'Too many playback updates. Please try again later.' },
        { status: 429 }
      );
    }

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

    // Handle both JSON and form-encoded data (sendBeacon uses form-encoded)
    let mediaId, mediaType, title, posterPath, progress, currentTime, totalDuration, seasonNumber, episodeNumber, finished, totalPlayedSeconds, immediate;
    
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse form-encoded data from sendBeacon
      const formData = await request.formData();
      mediaId = parseInt(formData.get('mediaId') as string);
      mediaType = formData.get('mediaType');
      title = formData.get('title');
      posterPath = formData.get('posterPath');
      progress = parseFloat(formData.get('progress') as string);
      currentTime = parseFloat(formData.get('currentTime') as string);
      totalDuration = parseFloat(formData.get('totalDuration') as string);
      seasonNumber = formData.get('seasonNumber') ? parseInt(formData.get('seasonNumber') as string) : undefined;
      episodeNumber = formData.get('episodeNumber') ? parseInt(formData.get('episodeNumber') as string) : undefined;
      finished = formData.get('finished') === 'true';
      totalPlayedSeconds = parseFloat(formData.get('totalPlayedSeconds') as string) || undefined;
      immediate = formData.get('immediate') === 'true';
      console.log('[Beacon] Form-encoded data received:', { mediaId, mediaType, currentTime, immediate });
    } else {
      // Parse JSON data (standard fetch)
      const jsonData = await request.json();
      mediaId = jsonData.mediaId;
      mediaType = jsonData.mediaType;
      title = jsonData.title;
      posterPath = jsonData.posterPath;
      progress = jsonData.progress;
      currentTime = jsonData.currentTime;
      totalDuration = jsonData.totalDuration;
      seasonNumber = jsonData.seasonNumber;
      episodeNumber = jsonData.episodeNumber;
      finished = jsonData.finished;
      totalPlayedSeconds = jsonData.totalPlayedSeconds;
      immediate = jsonData.immediate;
    }

    console.log('Saving watch history:', { mediaId, mediaType, title, progress, currentTime, totalDuration, seasonNumber, episodeNumber, totalPlayedSeconds, videoSource, immediate });
    if (totalDuration === 0) {
      console.warn('⚠️  WARNING: totalDuration is 0 when saving watch history for', mediaId);
    }

    // Build the update object dynamically
    const updateData: any = {
      userId: user._id,
      mediaId,
      mediaType,
      title,
      posterPath,
      finished: finished || false,
    };

    // Calculate progress as percentage if not provided
    let calculatedProgress = progress;
    
    if (calculatedProgress === undefined || calculatedProgress === null) {
      if (totalDuration && currentTime > 0) {
        // If we have both duration and currentTime, calculate percentage
        calculatedProgress = Math.round((currentTime / totalDuration) * 100);
      } else if (currentTime && currentTime > 0 && !totalDuration) {
        // For embed players without duration info, estimate based on typical movie/episode length
        const estimatedDuration = 120 * 60; // Default to 120 minutes in seconds
        calculatedProgress = Math.round((currentTime / estimatedDuration) * 100);
        // Cap progress at 99% to show it's not fully watched
        if (calculatedProgress > 99) calculatedProgress = 99;
      } else if (currentTime === 0 || !currentTime) {
        // Don't update progress if currentTime is 0 (player just started)
        calculatedProgress = undefined;
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

    // Only update if we have a valid calculation
    if (calculatedProgress !== undefined) {
      updateData.progress = calculatedProgress;
    }
    updateData.currentTime = currentTime || 0;
    updateData.totalDuration = totalDuration || 0;
    updateData.totalPlayedSeconds = totalPlayedSeconds || 0;

    // Only include seasonNumber and episodeNumber if they have valid values
    if (seasonNumber !== undefined && seasonNumber !== null) {
      updateData.seasonNumber = seasonNumber;
    }
    if (episodeNumber !== undefined && episodeNumber !== null) {
      updateData.episodeNumber = episodeNumber;
    }

    // If immediate flag is set (for seek, pause, ended events), write directly to DB
    // Otherwise, batch the update for efficiency
    if (immediate) {
      // Write directly to database for important events
      const filter = {
        userId: user._id,
        mediaId,
        mediaType,
      };

      // Only include fields that should be updated
      const updateFields: any = {
        title: updateData.title,
        posterPath: updateData.posterPath,
        finished: updateData.finished,
        currentTime: updateData.currentTime,
        totalDuration: updateData.totalDuration,
        lastWatchedAt: new Date(),
      };

      // Only update progress if it was calculated
      if (updateData.progress !== undefined) {
        updateFields.progress = updateData.progress;
      }

      if (updateData.seasonNumber !== undefined) {
        updateFields.seasonNumber = updateData.seasonNumber;
      }

      if (updateData.episodeNumber !== undefined) {
        updateFields.episodeNumber = updateData.episodeNumber;
      }

      await WatchHistory.updateOne(filter, { $set: updateFields }, { upsert: true });

      console.log('Watch history written immediately (important event):', { mediaId, currentTime, progress: updateData.progress });
      return NextResponse.json({ message: 'Watch history updated immediately' });
    }

    // Queue playtime update for batch writing (much more efficient!)
    await queuePlaytimeUpdate({
      userId: user._id.toString(),
      mediaId,
      mediaType,
      currentTime: currentTime || 0,
      totalDuration: totalDuration || 0,
      progress: updateData.progress,
      totalPlayedSeconds: totalPlayedSeconds || 0,
      finished: finished || false,
      seasonNumber,
      episodeNumber,
      title,
      posterPath,
    });

    // Immediately return success (actual DB write happens in batch)
    console.log('Watch history queued for batch update');
    return NextResponse.json({ message: 'Watch history updated' });
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
