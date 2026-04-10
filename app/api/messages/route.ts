import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Message } from '@/lib/models';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const { message } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message is too long (max 5000 characters)' }, { status: 400 });
    }

    // Get session to capture user info if available
    const session = await getServerSession(authOptions);

    const newMessage = new Message({
      message: message.trim(),
      userEmail: session?.user?.email || null,
      userName: session?.user?.name || null,
    });

    await newMessage.save();

    return NextResponse.json(
      { success: true, message: 'Message sent successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get session to check if user is admin
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = await Message.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
