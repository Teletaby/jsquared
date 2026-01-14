import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchHistory, User, Settings } from '@/lib/models';
import { queuePlaytimeUpdate } from '@/lib/playtimeBatch';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { trimWatchHistory, updateUserLastUsedSource } from '@/lib/watchHistoryUtils';
import { sourceIdToName } from '@/lib/utils';

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

    // Enforce a maximum of 20 items returned (and default to 20)
    const requestedLimit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const limit = Math.min(requestedLimit, 20);
    // Fetch watch history entries (lean objects for easy modification)
    const watchHistory = await WatchHistory.find({ userId: user._id })
      .sort({ lastWatchedAt: -1 })
      .limit(limit)
      .lean();

    // Prefer the history item's own source unless the user's stored lastUsedSource is *significantly* newer.
    // Rationale: a history item recorded more recently than the user's global preference should be trusted
    // for per-item resume decisions. To avoid noisy heartbeats or very recent transient writes stealing
    // precedence, require the user's preference to be at least USER_PREFERENCE_GRACE_MS newer to win.
    // Prefer the user's preference when it is newer than the history item.
    // Previously we required the user's pref to be 60s newer to avoid noisy flips;
    // explicit user actions now persist via POST /api/user/source with server timestamps,
    // so prefer the user's preference immediately when it's newer.
    const USER_PREFERENCE_GRACE_MS = 0; // no grace window for explicit preferences

    // Each watch history item retains its own source (the source used when that content was last watched).
    // The user's global lastUsedSource is only used as a fallback when a history item has no source.
    // This ensures "Continue Watching" resumes on the same source the user last used for that specific content.
    const adjusted = watchHistory.map((h: any) => {
      const historySource = h.source || null;
      const userSource = user.lastUsedSource || null;

      // Prefer the history item's own source. Only fall back to user's global preference if item has no source.
      let chosenSource: string | null = historySource;
      if (!historySource && userSource) {
        // Fallback: if history lacks a source but the user has one, use it
        chosenSource = userSource;
        console.log('[WatchHistory][INFO] History item missing source; using user preference as fallback', { userId: String(user._id), mediaId: h.mediaId, userSource });
      }

      console.log('[WatchHistory][DEBUG] Returning history item', { mediaId: h.mediaId, returnedSource: chosenSource, historySource, userSource });
      return {
        ...h,
        source: chosenSource,
      };
    });

    console.log('Watch history items:', adjusted.length);
    return NextResponse.json(adjusted);
  } catch (error) {
    console.error('Error fetching watch history:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Identify the requester IP for rate limiting and diagnostics
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // NOTE: Rate limiting is enforced *after* we parse the request body so that
    // explicit user-triggered actions (explicit=true) can be exempted from the
    // playback heartbeat limits and still be saved. We check the rate limit
    // later once we know whether this is an explicit write or an automated beacon.

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
    const settings = await Settings.findOne({ key: 'app_settings' });
    const videoSource = settings?.videoSource || 'vidking';

    // Handle both JSON and form-encoded data (sendBeacon uses form-encoded)
    let mediaId: number | undefined,
      mediaType: string | undefined,
      title: string | undefined,
      posterPath: string | undefined,
      progress: number | undefined,
      currentTime: number | undefined,
      totalDuration: number | undefined,
      seasonNumber: number | undefined,
      episodeNumber: number | undefined,
      finished: boolean | undefined,
      totalPlayedSeconds: number | undefined,
      immediate: boolean | undefined;

    // Optional source variable (string or undefined)
    let source: string | undefined;

    const contentType = request.headers.get('content-type') || '';
    let explicitUpdateFlag: boolean | undefined;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse form-encoded data from sendBeacon
      const formData = await request.formData();
      mediaId = parseInt(formData.get('mediaId') as string);
      mediaType = formData.get('mediaType') as string | undefined;
      title = formData.get('title') as string | undefined;
      posterPath = formData.get('posterPath') as string | undefined;
      progress = parseFloat(formData.get('progress') as string);
      currentTime = parseFloat(formData.get('currentTime') as string);
      totalDuration = parseFloat(formData.get('totalDuration') as string);
      seasonNumber = formData.get('seasonNumber') ? parseInt(formData.get('seasonNumber') as string) : undefined;
      episodeNumber = formData.get('episodeNumber') ? parseInt(formData.get('episodeNumber') as string) : undefined;
      finished = formData.get('finished') === 'true';
      totalPlayedSeconds = parseFloat(formData.get('totalPlayedSeconds') as string) || undefined;
      immediate = formData.get('immediate') === 'true';
      // Optional: video source name (videasy, vidlink, vidnest) or numeric id (1,2,3)
      source = (formData.get('source') as string) || undefined;
      // Normalize numeric id to canonical name when present
      source = source ? (sourceIdToName(source) || source) : undefined;
      // Explicit flag: formData may include explicit=true if this was a user-triggered action
      explicitUpdateFlag = formData.get('explicit') === 'true';
      console.log('[Beacon] Form-encoded data received (normalized source):', { mediaId, mediaType, currentTime, immediate, source, explicit: explicitUpdateFlag });
    } else {
      // Parse JSON data (standard fetch)
      const jsonData: any = await request.json();
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
      source = jsonData.source;
      // Normalize numeric id to canonical name when present in JSON payload
      source = source ? (sourceIdToName(source) || source) : undefined;
      explicitUpdateFlag = jsonData.explicit === true;
    };

    // If source isn't provided by the client, try to fall back to the user's last used source
    if (!source && user.lastUsedSource) {
      const normalizedUser = sourceIdToName(user.lastUsedSource) || user.lastUsedSource;
      console.log('No source provided in request - falling back to user.lastUsedSource (normalized):', normalizedUser);
      source = normalizedUser;
    }

    // Build the update object (used for immediate writes and for batching)
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
      if ((totalDuration ?? 0) > 0 && (currentTime ?? 0) > 0) {
        // If we have both duration and currentTime, calculate percentage
        calculatedProgress = Math.round(((currentTime ?? 0) / (totalDuration ?? 0)) * 100);
      } else if ((currentTime ?? 0) > 0 && !(totalDuration ?? 0)) {
        // For embed players without duration info, estimate based on typical movie/episode length
        const estimatedDuration = 120 * 60; // Default to 120 minutes in seconds
        calculatedProgress = Math.round(((currentTime ?? 0) / estimatedDuration) * 100);
        // Cap progress at 99% to show it's not fully watched
        if (calculatedProgress > 99) calculatedProgress = 99;
      } else if ((currentTime ?? 0) === 0) {
        // Don't update progress if currentTime is 0 (player just started)
        calculatedProgress = undefined;
      } else {
        calculatedProgress = 0;
      }
    } else {
      // If progress is provided (from embed player)
      if ((calculatedProgress as number) < 1) {
        calculatedProgress = Math.round((calculatedProgress as number) * 10) / 10;
      } else {
        calculatedProgress = Math.max(0, Math.min(100, Math.round(calculatedProgress as number)));
      }
    }

    // Only update if we have a valid calculation
    if (calculatedProgress !== undefined) {
      updateData.progress = calculatedProgress;
    }
    updateData.currentTime = (currentTime ?? 0);
    updateData.totalDuration = (totalDuration ?? 0);
    updateData.totalPlayedSeconds = (totalPlayedSeconds ?? 0);

    // Validate required fields
    if (!mediaId || !mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) {
      console.warn('Missing or invalid mediaId/mediaType in watch-history POST:', { mediaId, mediaType });
      return NextResponse.json({ error: 'Missing or invalid mediaId/mediaType' }, { status: 400 });
    }

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
      // For TV shows, delete other episodes of the same series when switching episodes
      if (mediaType === 'tv' && seasonNumber !== undefined && episodeNumber !== undefined) {
        await WatchHistory.deleteMany({
          userId: user._id,
          mediaId,
          mediaType: 'tv',
          $or: [
            { seasonNumber: { $ne: seasonNumber } },
            { episodeNumber: { $ne: episodeNumber } },
          ]
        });
        console.log(`🗑️ Deleted other episodes for S${seasonNumber}E${episodeNumber}`);
      }

      // Write directly to database for important events
      const filter: any = {
        userId: user._id,
        mediaId,
        mediaType,
      };

      // For TV shows, include season and episode in the filter for precision
      if (mediaType === 'tv' && seasonNumber !== undefined && episodeNumber !== undefined) {
        filter.seasonNumber = seasonNumber;
        filter.episodeNumber = episodeNumber;
      }

      // Use a consistent timestamp for DB write and last-used-source decision
      const now = new Date();

      // Only include fields that should be updated
      const updateFields: any = {
        title: updateData.title,
        posterPath: updateData.posterPath,
        finished: updateData.finished,
        currentTime: updateData.currentTime,
        totalDuration: updateData.totalDuration,
        lastWatchedAt: now,
      };

      // Only set source on immediate writes if the client explicitly indicated a user action.
      // This prevents automated playback beacons from overwriting an explicit per-media choice.
      // For VidSrc (when logged in), don't count any timestamp
      if (explicitUpdateFlag) {
        updateFields.source = source || undefined;
        // Don't set timestamp for VidSrc when logged in
        if (source !== 'vidsrc') {
          updateFields.sourceSetAt = now; // record when source was explicitly set
        }
      } else if (source) {
        console.log('[WatchHistory] Skipping source on immediate automated write (not explicit)', { mediaId, incomingSource: source });
      }
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

      try {
        await WatchHistory.updateOne(filter, { $set: updateFields }, { upsert: true });
      } catch (e: any) {
        // Handle duplicate key race where two concurrent upserts may attempt to insert the same unique key
        if (e && (e.code === 11000 || e.name === 'MongoServerError')) {
          console.warn('[WatchHistory] Duplicate key on upsert - attempting safe retry by finding existing document', { filter, duplicateError: e.message });
          // Try a few times to find the inserted document (it may be committing concurrently)
          let resolved = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const existing = await WatchHistory.findOne({
                userId: user._id,
                mediaId,
                mediaType,
                seasonNumber: updateFields.seasonNumber,
                episodeNumber: updateFields.episodeNumber,
                source: updateFields.source,
              }).lean();

              if (existing) {
                await WatchHistory.updateOne({ _id: existing._id }, { $set: updateFields });
                console.log('[WatchHistory] Resolved duplicate by updating existing document', { existingId: String(existing._id), attempt });
                resolved = true;
                break;
              }
            } catch (finderErr) {
              // ignore and retry
            }
            // small backoff
            await new Promise((r) => setTimeout(r, 50));
          }

          if (!resolved) {
            try {
              // Final fallback: try non-upsert update (won't create a new doc) to merge fields if it exists
              await WatchHistory.updateOne(filter, { $set: updateFields }, { upsert: false });
              console.log('[WatchHistory] Resolved duplicate by retrying non-upsert update (final fallback)');
            } catch (finalErr) {
              // Don't throw 500 on duplicate races; log and continue to keep the endpoint resilient
              console.error('[WatchHistory] Unable to resolve duplicate key error after retries; continuing without failing request', finalErr);
            }
          }
        } else {
          // Not a duplicate-key error - rethrow for outer handler to catch/log
          throw e;
        }
      }

      // After writing the watch history, log user's lastUsedSource at this moment for tracing
      try {
        const freshUser = await User.findById(user._id).lean();
        console.log('[WatchHistory] After immediate write, current user.lastUsedSource:', { userId: String(user._id), lastUsedSource: freshUser?.lastUsedSource, lastUsedSourceAt: freshUser?.lastUsedSourceAt });
      } catch (e) {
        console.error('[WatchHistory] Error reading user after immediate watch history write', e);
      }

      // Note: we intentionally DO NOT update the user's last-used source here from automated playback
      // events (heartbeats) to avoid overwriting an explicit user selection. User source preference
      // must be explicitly persisted via POST /api/user/source (for example when the user clicks
      // a source button or clicks Resume). This minimizes race conditions between background
      // heartbeat writes and user choices.

      // Trim history to maximum 20 items per user
      await trimWatchHistory(user._id, 20);

      console.log('Watch history written immediately (important event):', { mediaId, currentTime, progress: updateData.progress, source });
      return NextResponse.json({ message: 'Watch history updated immediately' });
    }

    // Queue playtime update for batch writing (much more efficient!)
    await queuePlaytimeUpdate({
      userId: user._id.toString(),
      mediaId: Number(mediaId),
      mediaType: mediaType as 'movie' | 'tv',
      currentTime: (currentTime ?? 0),
      totalDuration: (totalDuration ?? 0),
      progress: updateData.progress,
      totalPlayedSeconds: (totalPlayedSeconds ?? 0),
      finished: (finished ?? false),
      seasonNumber,
      episodeNumber,
      title: title || '',
      posterPath,
      source: source || undefined,
      explicit: explicitUpdateFlag, // Pass explicit flag for source persistence
    });

    // Enforce rate limiting for automated heartbeats but allow explicit writes through.
    // If this is NOT an explicit user action, apply the normal VIDEO rate limit.
    if (!explicitUpdateFlag && !checkRateLimit(`playtime_${ip}`, RATE_LIMITS.VIDEO)) {
      return NextResponse.json(
        { error: 'Too many playback updates. Please try again later.' },
        { status: 429 }
      );
    }

    // If source was provided with a batched update, update the user's last-used source only if the client
    // explicitly marked this update as an explicit user action. We must avoid automated heartbeats overwriting
    // explicit selections. Check both JSON and form-encoded payloads for an `explicit` flag.

    // Use explicitUpdateFlag captured earlier to decide whether to persist source
    if (source && explicitUpdateFlag) {
      const reqId = `wh_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      console.log(`[WatchHistory][${reqId}] Attempting to persist source from explicit action`, { userId: String(user._id), source, explicit: explicitUpdateFlag });
      // Pass force:true for explicit user actions so they can override the previous preference
      await updateUserLastUsedSource(user._id, source, new Date(), true);
      console.log(`[WatchHistory][${reqId}] Finished persisting source from explicit action`, { userId: String(user._id), source });
    } else if (source && !explicitUpdateFlag) {
      console.log('[WatchHistory] Skipping persistence of source from heartbeat (not explicit)', { source, userId: String(user._id) });
    } else {
      // no source provided; nothing to do
    }

    // Immediately return success (actual DB write happens in batch)
    console.log('Watch history queued for batch update', { mediaId, source });
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
