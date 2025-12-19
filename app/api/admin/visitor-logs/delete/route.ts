import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/visitorLogging';

export async function DELETE() {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('DELETE request for all visitor logs received');

    // Connect to database
    const { db } = await connectToDatabase();
    const collection = db.collection('visitor_logs');

    // Delete all logs
    const result = await collection.deleteMany({});
    
    console.log(`Deleted ${result.deletedCount} visitor logs`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} logs`,
      deletedCount: result.deletedCount,
    });
  } catch (err: unknown) {
    console.error('Error deleting visitor logs:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete logs',
      },
      { status: 500 }
    );
  }
}
