import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';
import { updateUserLastUsedSource } from '@/lib/watchHistoryUtils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API] POST /api/debug/user/set-source - Session:', session?.user?.email);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const json = await request.json();
    const { source } = json;
    const valid = ['videasy', 'vidlink', 'vidnest'];
    if (!source || !valid.includes(source)) return NextResponse.json({ error: 'Invalid source' }, { status: 400 });

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    console.log('[API] Debug set-source called for', session.user.email, 'attempting to set', source);

    try {
      const now = new Date();
      await updateUserLastUsedSource(user._id, source, now, true);
      const fresh = await User.findOne({ email: session.user.email }).lean();
      console.log('[API] Debug set-source result (fresh):', { email: session.user.email, lastUsedSource: fresh?.lastUsedSource, lastUsedSourceAt: fresh?.lastUsedSourceAt });
      return NextResponse.json({ message: 'Source set', user: fresh });
    } catch (e) {
      console.error('[API] Debug set-source failed:', e);
      return NextResponse.json({ error: 'Failed to set source', details: String(e) }, { status: 500 });
    }
  } catch (error) {
    console.error('[API] Debug set-source error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}