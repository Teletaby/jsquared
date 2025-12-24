import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API] GET /api/debug/user - Session:', session?.user?.email);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email }).lean();
    console.log('[API] /api/debug/user returning user doc (lean):', user);

    // Return the full user doc for debugging only
    return NextResponse.json({ user });
  } catch (error) {
    console.error('[API] /api/debug/user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}