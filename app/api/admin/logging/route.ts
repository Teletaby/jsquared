import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isLoggingEnabled, setLoggingEnabled } from '@/lib/loggingState';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!session || (session.user as { role?: string })?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      isLoggingEnabled: isLoggingEnabled(),
    });
  } catch (error) {
    console.error('Error fetching logging status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logging status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!session || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isLoggingEnabled: newLoggingState } = body;

    if (typeof newLoggingState !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid logging state' },
        { status: 400 }
      );
    }

    // Update logging state
    setLoggingEnabled(newLoggingState);

    return NextResponse.json({
      isLoggingEnabled: isLoggingEnabled(),
      message: `Logging has been ${newLoggingState ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('Error updating logging status:', error);
    return NextResponse.json(
      { error: 'Failed to update logging status' },
      { status: 500 }
    );
  }
}
