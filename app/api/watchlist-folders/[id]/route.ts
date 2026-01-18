import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchlistFolder, Watchlist } from '@/lib/models';
import { Types } from 'mongoose';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const folderId = params.id;

    if (!Types.ObjectId.isValid(folderId)) {
      return new Response(JSON.stringify({ error: 'Invalid folder ID' }), { status: 400 });
    }

    await connectToDatabase();

    // Check if folder belongs to the user
    const folder = await WatchlistFolder.findById(folderId);
    if (!folder || folder.userId.toString() !== (session.user as any).id) {
      return new Response(JSON.stringify({ error: 'Folder not found' }), { status: 404 });
    }

    // Remove folder association from watchlist items
    await Watchlist.updateMany(
      { folderId: new Types.ObjectId(folderId) },
      { $unset: { folderId: 1 } }
    );

    // Delete the folder
    await WatchlistFolder.findByIdAndDelete(folderId);

    return new Response(JSON.stringify({ message: 'Folder deleted successfully' }), { status: 200 });
  } catch (error) {
    console.error('Error deleting watchlist folder:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const folderId = params.id;
    const { name, description, color } = await request.json();

    if (!Types.ObjectId.isValid(folderId)) {
      return new Response(JSON.stringify({ error: 'Invalid folder ID' }), { status: 400 });
    }

    await connectToDatabase();

    // Check if folder belongs to the user
    const folder = await WatchlistFolder.findById(folderId);
    if (!folder || folder.userId.toString() !== (session.user as any).id) {
      return new Response(JSON.stringify({ error: 'Folder not found' }), { status: 404 });
    }

    // Update folder
    if (name) folder.name = name.trim();
    if (description) folder.description = description;
    if (color) folder.color = color;

    await folder.save();
    return new Response(JSON.stringify(folder), { status: 200 });
  } catch (error: any) {
    console.error('Error updating watchlist folder:', error);
    if (error.code === 11000) {
      return new Response(JSON.stringify({ error: 'Folder with this name already exists' }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
