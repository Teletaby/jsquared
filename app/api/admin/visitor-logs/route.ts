import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getVisitorLogs, getVisitorLogsCount } from '@/lib/visitorLogging';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Check if user is admin
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const skip = (page - 1) * limit;

    try {
      const logs = await getVisitorLogs(limit, skip);
      const totalCount = await getVisitorLogsCount();
      const totalPages = Math.ceil(totalCount / limit);

      return NextResponse.json({
        logs,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
        },
        success: true,
      });
    } catch (dbError) {
      console.error('Database error when fetching logs:', dbError);
      return NextResponse.json({
        logs: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          limit,
        },
        error: 'Database connection failed',
        success: false,
        dbError: (dbError as any)?.message,
      });
    }
  } catch (error) {
    console.error('Error fetching visitor logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visitor logs', details: (error as any)?.message },
      { status: 500 }
    );
  }
}
