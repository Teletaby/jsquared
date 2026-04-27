import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { InvisibleBox } from '@/lib/models';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const pageType = req.nextUrl.searchParams.get('pageType');
    const playerSource = req.nextUrl.searchParams.get('playerSource');
    const mediaIdParam = req.nextUrl.searchParams.get('mediaId');
    const isAdminView = req.nextUrl.searchParams.get('admin') === 'true';

    if (isAdminView) {
      const session = await getServerSession(authOptions);
      if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    }

    const mediaId = mediaIdParam ? parseInt(mediaIdParam, 10) : NaN;
    const query: any = isAdminView ? {} : { isActive: true };
    const andConditions: any[] = [];

    if (pageType && pageType !== 'all') {
      andConditions.push({
        $or: [{ pageType: 'all' }, { pageType }],
      });
    }

    if (playerSource && playerSource !== 'all') {
      andConditions.push({
        $or: [{ playerSource: 'all' }, { playerSource }],
      });
    }

    if (!Number.isNaN(mediaId)) {
      andConditions.push({
        $or: [
          { mediaIds: { $exists: false } },
          { mediaIds: { $size: 0 } },
          { mediaIds: mediaId },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const boxes = await InvisibleBox.find(query)
      .select('-__v')
      .lean();

    return NextResponse.json({ boxes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching invisible boxes:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const {
      name,
      pageType,
      playerSource,
      mediaIds,
      x,
      y,
      width,
      height,
      action,
      customAction,
      cursorStyle,
      clickCount,
      triggerOnLoad,
      fullscreenVisibility,
    } = await req.json();

    if (!name || !pageType || !action || x === undefined || y === undefined || !width || !height) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const box = await InvisibleBox.create({
      name,
      pageType,
      playerSource: playerSource || 'all',
      mediaIds: pageType === 'all' ? [] : mediaIds || [],
      x,
      y,
      width,
      height,
      action,
      customAction: action === 'custom' ? customAction : undefined,
      cursorStyle: cursorStyle || 'auto',
      clickCount: Math.max(1, Number(clickCount) || 1),
      triggerOnLoad: Boolean(triggerOnLoad),
      fullscreenVisibility: fullscreenVisibility || 'always',
      isActive: true,
      createdBy: session.user?.id,
    });

    return NextResponse.json(
      { box, message: 'Invisible box created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invisible box:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
