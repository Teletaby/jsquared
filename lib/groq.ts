import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function chatCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 1024
): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: maxTokens,
    stream: false,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Start a stateless "chat" helper that accumulates messages and calls Groq.
 * Drop-in replacement for the old Gemini startNewChat / sendChatMessage pattern.
 */
export function startNewChat(history: { role: string; content: string }[] = []) {
  // Normalise roles coming from the old Gemini format ("model" → "assistant")
  const normalised: { role: 'system' | 'user' | 'assistant'; content: string }[] =
    history.map((m) => ({
      role: m.role === 'model' ? 'assistant' : (m.role as 'user' | 'system' | 'assistant'),
      content: m.content,
    }));

  return {
    async sendMessage(text: string) {
      normalised.push({ role: 'user', content: text });
      const reply = await chatCompletion(normalised);
      normalised.push({ role: 'assistant', content: reply });
      return reply;
    },
  };
}

export async function sendChatMessage(chat: ReturnType<typeof startNewChat>, message: string) {
  return chat.sendMessage(message);
}
