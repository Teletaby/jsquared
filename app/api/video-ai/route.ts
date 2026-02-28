import { NextResponse, NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/groq';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(`video_ai_${ip}`, RATE_LIMITS.CHAT)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { messages, currentMessage, mediaContext } = await request.json();

    if (!currentMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Block identity questions before sending to the model
    const lowerMsg = currentMessage.toLowerCase();
    const identityPatterns = [
      'who created you', 'who made you', 'who built you', 'who trained you',
      'what ai are you', 'what model are you', 'are you gemini', 'are you gpt', 'are you deepseek', 'are you groq', 'are you llama',
      'are you chatgpt', 'are you openai', 'are you google', 'trained by',
      'what llm', 'what language model',
      'are you a bot', 'are you an ai', 'are you artificial',
    ];
    if (identityPatterns.some(p => lowerMsg.includes(p))) {
      const title = mediaContext?.title || 'this title';
      return NextResponse.json({
        response: `I'm **J**, the J-Squared Cinema assistant! I'm here to help you with everything about **"${title}"**. Want to know about the cast, plot, or get recommendations?`
      });
    }

    // Build a rich system prompt with media context
    const systemPrompt = buildSystemPrompt(mediaContext);

    // Build Groq messages array with system prompt + conversation history
    const groqMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.text,
      })),
      { role: 'user', content: currentMessage },
    ];

    const groqResponse = await chatCompletion(groqMessages, 1024);
    return NextResponse.json({ response: groqResponse });
  } catch (error: any) {
    console.error('Error in video AI route:', error?.message || error);
    const msg = error?.message || '';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return NextResponse.json({ error: 'AI quota exceeded. Please try again in a minute.' }, { status: 429 });
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return NextResponse.json({ error: 'AI model unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Something went wrong with the AI. Please try again.' }, { status: 500 });
  }
}

function buildSystemPrompt(ctx: any): string {
  if (!ctx) return 'You are a helpful assistant for a movie streaming platform.';

  const parts: string[] = [
    `# YOUR IDENTITY`,
    `You are "J", the friendly and knowledgeable movie & TV assistant for J-Squared Cinema. You were created by J-Squared Cinema. You are NOT an AI model. If anyone asks who you are, who made you, or what AI you are, you MUST ONLY say something like: "I'm J, the J-Squared Cinema assistant!" NEVER mention Groq, Meta, Llama, DeepSeek, Google, Gemini, LLM, or any AI company. This rule overrides everything else.`,
    ``,
    `# YOUR PERSONALITY`,
    `- You're enthusiastic about movies and TV but keep it natural, not over the top`,
    `- You speak casually and conversationally, like a movie-buff friend`,
    `- You use bold (**text**) to highlight key names, titles, and important info`,
    `- Keep answers concise (2-4 sentences) unless the user asks for more detail`,
    ``,
    `# WHAT THE USER IS WATCHING`,
    `The user is currently watching: "${ctx.title}"${ctx.mediaType === 'tv' ? ` (TV Show)` : ` (Movie)`}.`,
  ];

  if (ctx.overview) parts.push(`Series/Movie synopsis: ${ctx.overview}`);
  if (ctx.genres?.length) parts.push(`Genres: ${ctx.genres.join(', ')}`);
  if (ctx.releaseDate) parts.push(`Release date: ${ctx.releaseDate}`);
  if (ctx.rating) parts.push(`Rating: ${ctx.rating}/10`);
  if (ctx.runtime) parts.push(`Runtime: ${ctx.runtime} minutes`);
  if (ctx.cast?.length) parts.push(`Cast: ${ctx.cast.join(', ')}`);
  if (ctx.tagline) parts.push(`Tagline: "${ctx.tagline}"`);
  if (ctx.seasonNumber) {
    let epInfo = `The user is currently watching Season ${ctx.seasonNumber}, Episode ${ctx.episodeNumber}.`;
    if (ctx.episodeName) epInfo += ` Episode title: "${ctx.episodeName}".`;
    if (ctx.episodeOverview) epInfo += ` Episode synopsis: ${ctx.episodeOverview}`;
    epInfo += ' Always keep this in mind — tailor your answers to where they are in the series. Avoid spoiling anything beyond this episode unless they explicitly ask.';
    parts.push(epInfo);
  }

  parts.push(
    ``,
    `# RULES (STRICTLY FOLLOW)`,
    `1. You can discuss ANYTHING related to what the user is watching: plot, characters, theories, themes, cast, crew, production, trivia, similar recommendations, etc.`,
    `2. Assume all questions are about the content the user is watching unless they are CLEARLY and OBVIOUSLY about a completely unrelated topic (like tech products, weather, math homework, coding, etc.)`,
    `3. If a question IS clearly unrelated, politely say: "I'm all about movies and shows! I can help with anything about [title]. What would you like to know?"`,
    `4. NEVER reveal you are Groq, Llama, DeepSeek, Google AI, or any AI model. You are "J" from J-Squared Cinema.`,
    `5. Do NOT provide download links or piracy-related content.`,
    `6. Do NOT spoil major plot twists unless the user explicitly asks for spoilers.`,
  );

  return parts.join('\n');
}
