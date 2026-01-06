import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User, WatchHistory } from '@/lib/models';
import { updateUserLastUsedSource } from '@/lib/watchHistoryUtils';
import { sourceIdToName } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API] GET /api/user/source - Session:', session?.user?.email);
    if (!session?.user?.email) return NextResponse.json({ source: null, lastUsedSourceAt: null });

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email }).lean();
    if (!user) return NextResponse.json({ source: null, lastUsedSourceAt: null });

    // If user profile doesn't have lastUsedSource, try to infer it from the latest watch-history entry
    if (!user.lastUsedSource) {
      try {
        const latest = await WatchHistory.findOne({ userId: user._id }).sort({ lastWatchedAt: -1 }).lean();
        if (latest && latest.source) {
          // Normalize numeric ids to canonical names when returning
          const normalizedLatest = sourceIdToName(latest.source) || latest.source;
          console.log('[API] Falling back to latest watch-history source for user (normalized):', normalizedLatest);
          return NextResponse.json({ source: normalizedLatest, lastUsedSourceAt: latest.lastWatchedAt || null });
        }
      } catch (e) {
        console.error('[API] Error reading watch-history fallback:', e);
      }
    }

    // Normalize stored value if it's a numeric id (defensive)
    const normalizedUserSource = sourceIdToName(user.lastUsedSource) || user.lastUsedSource || null;

    // Log full user doc for debugging when source appears missing
    console.log('[API] Returning user source (full user object):', user);
    console.log('[API] Returning user source (normalized):', { source: normalizedUserSource, at: user.lastUsedSourceAt });
    return NextResponse.json({ source: normalizedUserSource, lastUsedSourceAt: user.lastUsedSourceAt || null });
  } catch (error) {
    console.error('Error fetching user source:', error);
    return NextResponse.json({ source: null, lastUsedSourceAt: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const json = await request.json();
    let source = json.source;
    const explicit = json.explicit;

    // Coerce numeric source values to strings (defensive) and normalize
    if (typeof source === 'number') {
      source = String(source);
    }

    // Correlated request id for tracing
    const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    // Log incoming payload for diagnostics (include coerced type)
    console.log('[API] POST /api/user/source payload:', { source, explicit, reqId });

    // Only persist when the client explicitly indicates a user action (explicit=true)
    // This prevents frequent automated heartbeats from overwriting the user's explicit choice.
    if (!explicit) {
      console.log('[API] Skipping persistence of user source because explicit flag not set');
      return NextResponse.json({ message: 'Source received but not persisted (not explicit)' }, { status: 200 });
    }

    // Parse client-provided timestamp to help avoid races; fall back to server time if not provided
    const clientAt = json.at ? new Date(json.at) : null;

    // Accept either canonical names or numeric ids (1/2/3/4/5). Normalize to canonical names.
    const valid = ['videasy', 'vidlink', 'vidnest', 'vidsrc', 'vidrock'];
    const normalized = sourceIdToName(source) || (valid.includes(source) ? source : undefined);
    if (!normalized) {
      console.warn('[API] Invalid source provided (after normalization):', source);
      return NextResponse.json({ error: 'Invalid or missing source' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Use central helper to update with validation and robust fallbacks
    try {
      // If this is an explicit user action, use server time to ensure it wins over any automated heartbeats
      const atToUse = explicit ? new Date() : (clientAt || new Date());
      if (explicit) console.log('[API] Explicit source persist requested; using server timestamp to avoid races', { email: session.user.email, at: atToUse.toISOString(), reqId });
      console.log(`[API][${reqId}] Calling updateUserLastUsedSource`, { userId: String(user._id), normalized, atToUse, explicit });
      await updateUserLastUsedSource(user._id, normalized, atToUse, true);
      const fresh = await User.findOne({ email: session.user.email }).lean();
      const normalizedFresh = sourceIdToName(fresh?.lastUsedSource) || fresh?.lastUsedSource || null;
      console.log('[API] Saved user source via helper (normalized):', { email: session.user.email, lastUsedSource: normalizedFresh, lastUsedSourceAt: fresh?.lastUsedSourceAt, reqId });
      if (normalized === 'vidnest') console.warn('[API] Persisted VIDNEST for user (explicit)', { email: session.user.email, reqId });
      return NextResponse.json({ message: 'Source saved', source: normalizedFresh, lastUsedSourceAt: fresh?.lastUsedSourceAt || null });
    } catch (e) {
      console.error('[API] Helper update failed:', e);
      // Final fallback: assign and save directly (canonical name)
      try {
        user.lastUsedSource = normalized;
        user.lastUsedSourceAt = explicit ? new Date() : (clientAt || new Date());
        await user.save();
        const fresh = await User.findOne({ email: session.user.email }).lean();
        const normalizedFresh = sourceIdToName(fresh?.lastUsedSource) || fresh?.lastUsedSource || null;
        console.log('[API] Saved user source via direct save fallback (normalized):', { email: session.user.email, lastUsedSource: normalizedFresh, lastUsedSourceAt: fresh?.lastUsedSourceAt });
        return NextResponse.json({ message: 'Source saved', source: normalizedFresh, lastUsedSourceAt: fresh?.lastUsedSourceAt || null });
      } catch (err) {
        console.error('[API] Final fallback failed:', err);
        return NextResponse.json({ error: 'Failed to persist source', details: String(err) }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error saving user source:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}