import { NextResponse, NextRequest } from 'next/server';
import { startNewChat, sendChatMessage } from '@/lib/groq';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Apply rate limiting
    if (!checkRateLimit(`chat_${ip}`, RATE_LIMITS.CHAT)) {
      return NextResponse.json(
        { error: 'Too many chat messages. Please try again later.' },
        { status: 429 }
      );
    }

    const { messages, currentMessage } = await request.json();

    if (!currentMessage) {
      return NextResponse.json({ error: 'Current message is required' }, { status: 400 });
    }

    // Convert messages to the format expected by DeepSeek chat history
    const history = messages.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));

    const chat = startNewChat(history);

    // Prepend conciseness instruction to the current message
    const concisePrompt = currentMessage;
    const deepseekResponse = await sendChatMessage(chat, concisePrompt);

    return NextResponse.json({ response: deepseekResponse });
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
