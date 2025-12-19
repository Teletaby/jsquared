import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Watchlist, User } from '@/lib/models';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(`watchlist_${ip}`, RATE_LIMITS.API)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const watchlist = await Watchlist.find({ userId: user._id }).sort({ addedAt: -1 });
    return NextResponse.json(watchlist);
  } catch (err: unknown) {
    console.error('Error fetching watchlist:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { mediaId, mediaType, title, posterPath, rating } = await request.json();

    const watchlist = await Watchlist.findOneAndUpdate(
      { userId: user._id, mediaId, mediaType },
      {
        $set: {
          userId: user._id,
          mediaId,
          mediaType,
          title,
          posterPath,
          rating,
          addedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error('Error updating watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { mediaId, mediaType } = await request.json();

    await Watchlist.deleteOne({
      userId: user._id,
      mediaId,
      mediaType,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting from watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
