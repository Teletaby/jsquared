import { WatchHistory } from '@/lib/models';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * Batch configuration for watch history updates
 * Instead of writing every playtime update, batch them
 */
const BATCH_SIZE = 10; // Write after 10 playtime updates
const BATCH_TIMEOUT = 10 * 1000; // Write after 10 seconds

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
      } as any;

      // Only update progress if it's provided and valid
      if (update.progress !== undefined && update.progress !== null) {
        updateData.progress = update.progress;
      }

      // Update or create watch history
      await WatchHistory.updateOne(filter, { $set: updateData }, { upsert: true });
      written++;
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
