import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    const visitorCount = await db.collection('visitor_logs').countDocuments();
    // Mongoose model 'WatchHistory' maps to collection named 'watchhistories'
    const watchCount = await db.collection('watchhistories').countDocuments();

    return NextResponse.json({ visitorCount, watchCount });
  } catch (e) {
    console.error('Debug collections error:', e);
    return NextResponse.json({ error: 'Failed to read collection counts', details: String(e) }, { status: 500 });
  }
}
