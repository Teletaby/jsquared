import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchlistFolder, Watchlist } from '@/lib/models';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    await connectToDatabase();

    const folders = await WatchlistFolder.find({ userId: (session.user as any).id }).sort({ createdAt: -1 });
    return new Response(JSON.stringify(folders), { status: 200 });
  } catch (error) {
    console.error('Error fetching watchlist folders:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { name, description, color } = await request.json();

    if (!name || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Folder name is required' }), { status: 400 });
    }

    await connectToDatabase();

    const folder = new WatchlistFolder({
      userId: (session.user as any).id,
      name: name.trim(),
      description: description || '',
      color: color || '#E50914',
    });

    await folder.save();
    return new Response(JSON.stringify(folder), { status: 201 });
  } catch (error: any) {
    console.error('Error creating watchlist folder:', error);
    if (error.code === 11000) {
      return new Response(JSON.stringify({ error: 'Folder with this name already exists' }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
