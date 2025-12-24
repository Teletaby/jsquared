import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const sessionRole = (session as any)?.user?.role;
    if (sessionRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    const filter: any = {};
    if (email) {
      const u = await User.findOne({ email }).lean();
      if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      filter.userId = u._id;
    }

    const items = await db
      .collection('watchhistories')
      .find(filter)
      .sort({ lastWatchedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ items });
  } catch (e) {
    console.error('Debug watch-history error:', e);
    return NextResponse.json({ error: 'Failed to fetch watch-history', details: String(e) }, { status: 500 });
  }
}
