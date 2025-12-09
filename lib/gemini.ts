import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not defined. Please check your .env.local file and restart the server.");
  throw new Error("GEMINI_API_KEY is not defined.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ... (rest of the file remains the same until generateGeminiResponse)

export function startNewChat(history: any[] = []): ChatSession {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  return model.startChat({
    history: history,
    generationConfig: {
      maxOutputTokens: 200,
    },
    systemInstruction: {
      role: "system",
      parts: [{ text: "You are JSquared. You help people for things related to Movies and Series. Do not answer questions not related to those." }]
    }
  });
}

export async function sendChatMessage(chat: ChatSession, prompt: string): Promise<string> {
  try {
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "I'm sorry, I encountered an error and cannot respond right now.";
  }
}

