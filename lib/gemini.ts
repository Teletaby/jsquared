import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export function startNewChat(history: any[] = []) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const chat = model.startChat({
    history: history,
    generationConfig: {
      maxOutputTokens: 1024,
    },
  });
  return chat;
}

export async function sendChatMessage(chat: any, message: string) {
  try {
    const result = await chat.sendMessage(message);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}
