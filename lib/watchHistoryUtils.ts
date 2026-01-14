import { WatchHistory, User } from '@/lib/models';
import { sourceNameToId, sourceIdToName } from '@/lib/utils';
import mongoose from 'mongoose';

/**
 * Trim watch history for a user to the specified max number of items (default 20)
 */
export async function trimWatchHistory(userId: mongoose.Types.ObjectId | string, maxItems: number = 20) {
  try {
    // Find IDs of items beyond the newest maxItems
    const extra = await WatchHistory.find({ userId })
      .sort({ lastWatchedAt: -1 })
      .skip(maxItems)
      .select('_id')
      .lean();

    if (extra && extra.length > 0) {
      const ids = extra.map(e => e._id);
      await WatchHistory.deleteMany({ _id: { $in: ids } });
      console.log(`[WatchHistory] Trimmed ${ids.length} items for user ${String(userId)} (kept ${maxItems})`);
    }
  } catch (error) {
    console.error('[WatchHistory] Error trimming history:', error);
  }
}

/**
 * Update the user's last used source preference
 */
export async function updateUserLastUsedSource(userId: mongoose.Types.ObjectId | string, source?: string, at?: Date, force: boolean = false) {
  if (!source) return;
  try {
    // Normalize numeric ids to canonical names (defensive). If helper is missing, fall back to provided source.
    let normalized = source;
    try {
      if (typeof sourceIdToName === 'function') {
        normalized = sourceIdToName(source) || source;
      } else {
        console.warn('[WatchHistory] sourceIdToName helper missing or not a function; falling back to raw source');
      }
    } catch (inner) {
      console.warn('[WatchHistory] Error calling sourceIdToName, falling back to raw source', inner);
      normalized = source;
    }

    // Extra diagnostic logging (mask source names with numeric ids when helper available)
    const masked = typeof sourceNameToId === 'function' ? sourceNameToId(normalized) : undefined;
    console.log('[WatchHistory] updateUserLastUsedSource called', { userId: String(userId), source: masked ? `Source ${masked}` : normalized ?? 'unknown', time: at ? at.toISOString() : new Date().toISOString(), typeofUserId: typeof userId });

    // Read current user to check timestamp so heartbeats don't stomp explicit user changes
    const oid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const existing = await User.findById(oid).lean();
    const existingAt = existing?.lastUsedSourceAt ? new Date(existing.lastUsedSourceAt) : null;
    // Log the existing value for debugging, especially for VIDNEST
    console.log('[WatchHistory] Existing lastUsedSource before update', { userId: String(userId), existingSource: existing?.lastUsedSource, existingAt, incomingAt: at ? at.toISOString() : null, force });

    // Enforce policy: non-force updates MUST NOT overwrite an existing explicit user preference
    // unless the source is the same (no-op). This prevents heartbeats from changing the user's choice.
    // Force updates (from explicit user actions) are always allowed.
    if (!force && existing?.lastUsedSource && existing.lastUsedSource !== normalized) {
      const attempted = sourceNameToId(normalized);
      const existingId = existing.lastUsedSource ? sourceNameToId(existing.lastUsedSource) : null;
      console.warn('[WatchHistory][AUDIT] Skipping non-force update that would overwrite an existing explicit preference', { userId: String(userId), existingSource: existing?.lastUsedSource, existingSourceId: existingId ? `Source ${existingId}` : null, attemptedSource: normalized, attemptedSourceId: attempted ? `Source ${attempted}` : null, existingAt, incomingAt: at ? at.toISOString() : null });
      return;
    }

    // Preserve the previous timestamp-protection logic: if existing timestamp is newer than incoming, skip
    if (!force && existingAt && at && existingAt >= at) {
      console.log('[WatchHistory] Skipping update to lastUsedSource because existing value is newer or equal', { existingAt, incomingAt: at.toISOString(), force });
      return;
    }

    // First attempt: findByIdAndUpdate with validation and return the updated document
    const updatedDoc = await User.findByIdAndUpdate(
      oid,
      { $set: { lastUsedSource: normalized, lastUsedSourceAt: at || new Date() } },
      { new: true, upsert: false, runValidators: true }
    ).lean();

    const val = sourceNameToId(source);
    console.log('[WatchHistory] findByIdAndUpdate attempted for lastUsedSource=' + (val ? `Source ${val}` : 'unknown') + ' on user ' + String(userId) + ' at ' + new Date().toISOString(), { updatedExists: !!updatedDoc, updatedDocSample: updatedDoc ? { lastUsedSource: updatedDoc.lastUsedSource ? (sourceNameToId(updatedDoc.lastUsedSource) ? `Source ${sourceNameToId(updatedDoc.lastUsedSource)}` : 'unknown') : null, lastUsedSourceAt: updatedDoc.lastUsedSourceAt } : null });

    // If the returned document is missing the field or the update didn't apply as expected, try a stronger fallback
    if (updatedDoc && updatedDoc.lastUsedSource === normalized) {
      console.log('[WatchHistory] Updated document:', { lastUsedSource: updatedDoc.lastUsedSource, lastUsedSourceAt: updatedDoc.lastUsedSourceAt });
      if (normalized === 'vidnest') console.warn('[WatchHistory] Persisted VIDNEST via findByIdAndUpdate', { userId: String(userId) });
      return;
    }

    // Fallback 1: updateOne and then read back
      const result = await User.updateOne({ _id: oid }, { $set: { lastUsedSource: normalized, lastUsedSourceAt: at || new Date() } });
    console.log('[WatchHistory] updateOne fallback result:', { matchedCount: (result as any).matchedCount ?? (result as any).n, modifiedCount: (result as any).modifiedCount ?? (result as any).nModified, raw: result });

    // Read back to verify
    try {
      const updated = await User.findById(oid).lean();
      console.log('[WatchHistory] Read-back user after updateOne:', { id: String(userId), lastUsedSource: updated?.lastUsedSource ? (sourceNameToId(updated.lastUsedSource) ? `Source ${sourceNameToId(updated.lastUsedSource)}` : 'unknown') : null, lastUsedSourceAt: updated?.lastUsedSourceAt, full: updated });

      if (updated?.lastUsedSource === normalized) return;

      // Fallback 2: load document, set fields, and save (handles weird schema middleware or validation issues)
      try {
        const doc = await User.findById(oid);
        if (doc) {
          doc.lastUsedSource = normalized;
          doc.lastUsedSourceAt = at || new Date();
          await doc.save();
          console.log('[WatchHistory] Saved user via document.save fallback');

          const final = await User.findById(oid).lean();
          console.log('[WatchHistory] Read-back after document.save:', { id: String(userId), lastUsedSource: final?.lastUsedSource ? (sourceNameToId(final.lastUsedSource) ? `Source ${sourceNameToId(final.lastUsedSource)}` : 'unknown') : null, lastUsedSourceAt: final?.lastUsedSourceAt, full: final });

          if (final?.lastUsedSource === normalized) {
            if (normalized === 'vidnest') console.warn('[WatchHistory] Persisted VIDNEST via document.save', { userId: String(userId) });
            return;
          }
        }
      } catch (e) {
        console.error('[WatchHistory] Error during document.save fallback:', e);
      }

      // Fallback 3: direct collection update (bypass Mongoose middleware/validation)
      try {
        console.warn('[WatchHistory] Attempting direct collection update as final fallback');
        const rawResult = await User.collection.updateOne({ _id: oid }, { $set: { lastUsedSource: normalized, lastUsedSourceAt: at || new Date() } });
        console.log('[WatchHistory] Raw collection update result:', rawResult);
        const final2 = await User.findById(oid).lean();
        console.log('[WatchHistory] Read-back after raw collection.updateOne:', { id: String(userId), lastUsedSource: final2?.lastUsedSource ? (sourceNameToId(final2.lastUsedSource) ? `Source ${sourceNameToId(final2.lastUsedSource)}` : 'unknown') : null, lastUsedSourceAt: final2?.lastUsedSourceAt, full: final2 });
        if (final2?.lastUsedSource === normalized) {
          if (normalized === 'vidnest') console.warn('[WatchHistory] Persisted VIDNEST via raw collection update', { userId: String(userId) });
          return;
        }
      } catch (e) {
        console.error('[WatchHistory] Error during raw collection update fallback:', e);
      }

      // If we reach here, the update still didn't apply
      const att = sourceNameToId(source);
      console.warn('[WatchHistory] Warning: lastUsedSource could not be persisted after multiple attempts', { userId: String(userId), attemptedSource: att ? `Source ${att}` : 'unknown' });
    } catch (e) {
      console.error('[WatchHistory] Error reading back user after update fallback:', e);
    }
  } catch (error) {
    console.error('[WatchHistory] Error updating user lastUsedSource:', error);
  }
}
