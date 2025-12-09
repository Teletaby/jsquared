import { NextResponse } from 'next/server';
import { startNewChat, sendChatMessage } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { messages, currentMessage } = await request.json();

    if (!currentMessage) {
      return NextResponse.json({ error: 'Current message is required' }, { status: 400 });
    }

    // Convert messages to the format expected by startChat history
    const history = messages.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = startNewChat(history);

    // Prepend conciseness instruction to the current message
    const concisePrompt = currentMessage;
    const geminiResponse = await sendChatMessage(chat, concisePrompt);

    return NextResponse.json({ response: geminiResponse });
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
