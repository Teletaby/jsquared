import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { InvisibleBox } from '@/lib/models';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { message: 'Invalid box ID' },
        { status: 400 }
      );
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
      isActive,
    } = await req.json();

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (pageType !== undefined) updateData.pageType = pageType;
    if (playerSource !== undefined) updateData.playerSource = playerSource;
    if (mediaIds !== undefined) updateData.mediaIds = pageType === 'all' ? [] : mediaIds;
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;
    if (action !== undefined) updateData.action = action;
    if (customAction !== undefined) updateData.customAction = action === 'custom' ? customAction : undefined;
    if (cursorStyle !== undefined) updateData.cursorStyle = cursorStyle;
    if (clickCount !== undefined) updateData.clickCount = Math.max(1, Number(clickCount) || 1);
    if (triggerOnLoad !== undefined) updateData.triggerOnLoad = Boolean(triggerOnLoad);
    if (isActive !== undefined) updateData.isActive = isActive;

    const box = await InvisibleBox.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true }
    );

    if (!box) {
      return NextResponse.json(
        { message: 'Box not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { box, message: 'Invisible box updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating invisible box:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { message: 'Invalid box ID' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const box = await InvisibleBox.findByIdAndDelete(params.id);

    if (!box) {
      return NextResponse.json(
        { message: 'Box not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Invisible box deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting invisible box:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
