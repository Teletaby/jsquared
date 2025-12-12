import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Watchlist, User } from '@/lib/models';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const mediaIdsParam = searchParams.get('mediaIds');
    const mediaTypesParam = searchParams.get('mediaTypes');

    let query: any = { userId: user._id };

    if (mediaIdsParam && mediaTypesParam) {
      const mediaIds = mediaIdsParam.split(',').map(Number);
      const mediaTypes = mediaTypesParam.split(',');

      if (mediaIds.length !== mediaTypes.length) {
        return NextResponse.json({ error: 'Mismatched mediaIds and mediaTypes counts' }, { status: 400 });
      }

      const orConditions = mediaIds.map((id, index) => ({
        mediaId: id,
        mediaType: mediaTypes[index] as 'movie' | 'tv',
      }));

      query.$or = orConditions;

      const items = await Watchlist.find(query);

      const statusMap: { [key: string]: boolean } = {};
      mediaIds.forEach((id, index) => {
        const type = mediaTypes[index];
        statusMap[`${id}-${type}`] = items.some(
          (item) => item.mediaId === id && item.mediaType === type
        );
      });
      return NextResponse.json(statusMap);

    } else {
      const mediaId = searchParams.get('mediaId');
      const mediaType = searchParams.get('mediaType');

      if (!mediaId || !mediaType) {
        return NextResponse.json({ error: 'Missing mediaId or mediaType' }, { status: 400 });
      }

      query.mediaId = parseInt(mediaId as string);
      query.mediaType = mediaType as 'movie' | 'tv';

      const item = await Watchlist.findOne(query);
      return NextResponse.json({ isInWatchlist: !!item });
    }
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
