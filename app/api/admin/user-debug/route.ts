import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User, WatchHistory } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only allow admin users
    await connectToDatabase();
    const admin = await User.findOne({ email: session.user.email }).lean();
    if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const q = request.nextUrl.searchParams.get('email') || session.user.email;

    // Fetch raw user doc and their most recent watch history (20)
    const user = await User.findOne({ email: q }).lean();
    const history = await WatchHistory.find({ userId: user?._id }).sort({ lastWatchedAt: -1 }).limit(20).lean();

    // Serialize ObjectIds to strings where needed
    const safeUser = user ? { ...user, _id: String(user._id), lastUsedSourceAt: user.lastUsedSourceAt ? new Date(user.lastUsedSourceAt).toISOString() : null } : null;
    const safeHistory = history.map(h => ({ ...h, _id: String(h._id), userId: String(h.userId), lastWatchedAt: h.lastWatchedAt ? new Date(h.lastWatchedAt).toISOString() : null }));

    console.log('[ADMIN DEBUG] Returning user-debug for', q, { user: safeUser, recentHistoryCount: safeHistory.length });

    return NextResponse.json({ user: safeUser, recentHistory: safeHistory });
  } catch (error) {
    console.error('[ADMIN DEBUG] Error fetching user-debug:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}