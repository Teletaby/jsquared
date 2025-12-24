import { WatchHistory } from '@/lib/models';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * Batch configuration for watch history updates
 * Instead of writing every playtime update, batch them
 */
const BATCH_SIZE = 10; // Write after 10 playtime updates
const BATCH_TIMEOUT = 10 * 1000; // Write after 10 seconds

import { trimWatchHistory, updateUserLastUsedSource } from './watchHistoryUtils';
import { sourceNameToId } from './utils';

interface PlaytimeUpdate {
  userId: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  currentTime: number;
  totalDuration: number;
  progress?: number;
  totalPlayedSeconds?: number;
  finished?: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
  title: string;
  posterPath?: string;
  // optional source name for this update
  source?: 'videasy' | 'vidlink' | 'vidnest' | string;
}

let updateBatch: PlaytimeUpdate[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

/**
 * Flush all pending playtime updates to database
 */
async function flushPlaytimeUpdates(): Promise<void> {
  if (updateBatch.length === 0) {
    return;
  }

  try {
    await connectToDatabase();
    
    // Group updates by user-media combo (take the latest for each)
    const updateMap = new Map<string, PlaytimeUpdate>();
    
    for (const update of updateBatch) {
      const key = `${update.userId}-${update.mediaId}-${update.mediaType}`;
      updateMap.set(key, update); // Latest update overwrites
    }

    // Write all unique updates
    let written = 0;
    const updates = Array.from(updateMap.values());
    for (const update of updates) {
      const filter = {
        userId: update.userId,
        mediaId: update.mediaId,
        mediaType: update.mediaType,
      };

      const updateData = {
        userId: update.userId,
        mediaId: update.mediaId,
        mediaType: update.mediaType,
        title: update.title,
        posterPath: update.posterPath,
        currentTime: update.currentTime,
        totalDuration: update.totalDuration,
        totalPlayedSeconds: update.totalPlayedSeconds ?? 0,
        finished: update.finished ?? false,
        seasonNumber: update.seasonNumber,
        episodeNumber: update.episodeNumber,
        lastWatchedAt: new Date(),
        source: update.source,
      } as any;

      // Only update progress if it's provided and valid
      if (update.progress !== undefined && update.progress !== null) {
        updateData.progress = update.progress;
      }

      // Update or create watch history (handle potential duplicate-key race on upsert)
      try {
        await WatchHistory.updateOne(filter, { $set: updateData }, { upsert: true });
      } catch (e: any) {
        if (e && (e.code === 11000 || e.name === 'MongoServerError')) {
          console.warn('[Playtime Batching] Duplicate key on upsert - attempting safe retry', { filter, duplicateError: e.message });
          let resolved = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const existing = await WatchHistory.findOne({
                userId: update.userId,
                mediaId: update.mediaId,
                mediaType: update.mediaType,
                seasonNumber: update.seasonNumber,
                episodeNumber: update.episodeNumber,
                source: update.source,
              }).lean();

              if (existing) {
                await WatchHistory.updateOne({ _id: existing._id }, { $set: updateData });
                console.log('[Playtime Batching] Resolved duplicate by updating existing document', { existingId: String(existing._id), attempt });
                resolved = true;
                break;
              }
            } catch (finderErr) {
              // ignore and retry
            }
            await new Promise((r) => setTimeout(r, 50));
          }

          if (!resolved) {
            try {
              await WatchHistory.updateOne(filter, { $set: updateData }, { upsert: false });
              console.log('[Playtime Batching] Resolved duplicate by retrying non-upsert update (final fallback)');
            } catch (finalErr) {
              console.error('[Playtime Batching] Unable to resolve duplicate key error after retries; continuing', finalErr);
            }
          }
        } else {
          throw e;
        }
      }
      written++;

      // Trim user's watch history to keep only the most recent 20 entries
      await trimWatchHistory(update.userId, 20);

      // Note: do not update the user's last-used source from batched playtime updates (heartbeats).
      // Prefer explicit source persistence via /api/user/source to avoid overwriting explicit user choices.
      if (update.source) {
        // We intentionally skip calling updateUserLastUsedSource here to avoid races with explicit user changes.
        console.log('[Playtime Batching] Skipping user source update from batched heartbeat', { userId: update.userId, mediaId: update.mediaId, source: update.source });
      }
    }

    console.log(`[Playtime Batching] Flushed ${written} unique playtime updates`);
    updateBatch = [];

    // Clear timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
  } catch (error) {
    console.error('[Playtime Batching] Error flushing updates:', error);
    // Keep updates in batch for retry
  }
}

/**
 * Queue a playtime update for batch writing
 */
export async function queuePlaytimeUpdate(update: PlaytimeUpdate): Promise<void> {
  // Log incoming update for diagnostics (helps trace which source is being queued)
  try {
    const masked = sourceNameToId(update.source as string | undefined);
    console.log('[Playtime Batching] Queuing update', { userId: update.userId, mediaId: update.mediaId, currentTime: update.currentTime, source: masked ? `Source ${masked}` : (update.source || 'unknown') });
  } catch (e) {
    // ignore logging errors
  }

  updateBatch.push(update);

  // If batch is full, flush immediately
  if (updateBatch.length >= BATCH_SIZE) {
    await flushPlaytimeUpdates();
  } else if (!batchTimeout) {
    // Set timeout to flush after BATCH_TIMEOUT
    batchTimeout = setTimeout(async () => {
      await flushPlaytimeUpdates();
    }, BATCH_TIMEOUT);
  }
}

/**
 * Force flush all pending playtime updates
 */
export async function flushAllPlaytimeUpdates(): Promise<void> {
  await flushPlaytimeUpdates();
}

/**
 * Get pending batch size (for debugging)
 */
export function getPendingPlaytimeUpdates(): number {
  return updateBatch.length;
}
