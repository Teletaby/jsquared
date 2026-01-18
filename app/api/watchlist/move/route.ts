import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Watchlist, User } from '@/lib/models';
import { Types } from 'mongoose';

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { mediaId, mediaType, folderId } = await request.json();

    if (!mediaId || !mediaType) {
      return new Response(JSON.stringify({ error: 'Missing mediaId or mediaType' }), { status: 400 });
    }

    await connectToDatabase();

    // Find the user to get their ID
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    console.log('Moving item:', { mediaId, mediaType, folderId, userId: user._id });

    // Check if item exists first
    const existingItem = await Watchlist.findOne({
      userId: user._id,
      mediaId,
      mediaType,
    });
    console.log('Existing item before update:', existingItem);
    console.log('Existing item folderId:', existingItem?.folderId, 'type:', typeof existingItem?.folderId);

    const folderIdToSet = folderId ? new Types.ObjectId(folderId) : null;
    console.log('FolderId to set:', folderIdToSet, 'type:', typeof folderIdToSet, 'isObjectId:', folderIdToSet instanceof Types.ObjectId);

    // Find and update the watchlist item
    const watchlistItem = await Watchlist.findOneAndUpdate(
      {
        userId: user._id,
        mediaId,
        mediaType,
      },
      {
        $set: {
          folderId: folderIdToSet,
        }
      },
      { new: true }
    );

    console.log('Updated watchlist item:', watchlistItem);
    console.log('Updated folderId value:', watchlistItem?.folderId, 'type:', typeof watchlistItem?.folderId);

    if (!watchlistItem) {
      return new Response(JSON.stringify({ error: 'Watchlist item not found' }), { status: 404 });
    }

    const plainItem = watchlistItem.toObject ? watchlistItem.toObject() : watchlistItem;
    console.log('Plain item response:', plainItem);
    return new Response(JSON.stringify(plainItem), { status: 200 });
  } catch (error) {
    console.error('Error moving watchlist item:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), { status: 500 });
  }
}
