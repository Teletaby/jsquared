import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchHistory, User } from '@/lib/models';

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

    const { mediaId, mediaType, title, posterPath, progress, currentTime, totalDuration, seasonNumber, episodeNumber, finished } = await request.json();
    console.log('Saving watch history:', { mediaId, mediaType, title, progress, seasonNumber, episodeNumber });

    // Calculate progress as percentage if not provided
    // For embed players where totalDuration might be 0, estimate based on typical video length
    let calculatedProgress = progress;
    
    if (!calculatedProgress) {
      if (totalDuration && currentTime) {
        calculatedProgress = Math.round((currentTime / totalDuration) * 100);
      } else if (currentTime && !totalDuration) {
        // For embed players without duration info, estimate based on typical movie/episode length
        // Assume average movie is ~120 minutes or episode is ~45 minutes
        const estimatedDuration = 120 * 60; // Default to 120 minutes in seconds
        calculatedProgress = Math.round((currentTime / estimatedDuration) * 100);
        // Cap progress at 99% to show it's not fully watched
        if (calculatedProgress > 99) calculatedProgress = 99;
      } else {
        calculatedProgress = 0;
      }
    }

    // Build the update object dynamically
    const updateData: any = {
      userId: user._id,
      mediaId,
      mediaType,
      title,
      posterPath,
      progress: calculatedProgress,
      currentTime: currentTime || 0,
      totalDuration: totalDuration || 0,
      finished: finished || false,
      lastWatchedAt: new Date(),
    };

    // Only include seasonNumber and episodeNumber if they have valid values
    if (seasonNumber !== undefined && seasonNumber !== null) {
      updateData.seasonNumber = seasonNumber;
    }
    if (episodeNumber !== undefined && episodeNumber !== null) {
      updateData.episodeNumber = episodeNumber;
    }

    const watchHistory = await WatchHistory.findOneAndUpdate(
      { userId: user._id, mediaId, mediaType },
      {
        $set: updateData,
      },
      { upsert: true, new: true }
    );

    console.log('Watch history saved successfully:', watchHistory._id);
    return NextResponse.json(watchHistory);
  } catch (error) {
    console.error('Error updating watch history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
