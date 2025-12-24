import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    const admin = await User.findOne({ email: session.user.email }).lean();
    if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const json = await request.json();
    const { email, source } = json;
    if (!email || !source) return NextResponse.json({ error: 'Missing email or source' }, { status: 400 });

    // Force update using findOneAndUpdate to return the updated document
    const updated = await User.findOneAndUpdate({ email }, { $set: { lastUsedSource: source, lastUsedSourceAt: new Date() } }, { new: true }).lean();

    console.log('[ADMIN SET] Updated user source via admin endpoint:', { email, source, updated });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('[ADMIN SET] Error setting user source:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}