import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { WatchHistory, User } from '@/lib/models';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    console.log('DELETE /api/watch-history/[id] - Session:', session?.user?.email);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const historyId = params.id;
    console.log('Deleting watch history item:', historyId);

    const result = await WatchHistory.deleteOne({
      _id: historyId,
      userId: user._id
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'History item not found' }, { status: 404 });
    }

    console.log('Watch history item deleted successfully');
    return NextResponse.json({ message: 'History item deleted' });
  } catch (error) {
    console.error('Error deleting watch history:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
