"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

interface MediaContext {
  title: string;
  mediaType: 'movie' | 'tv';
  overview?: string;
  genres?: string[];
  releaseDate?: string;
  rating?: number;
  runtime?: number;
  cast?: string[];
  tagline?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  episodeOverview?: string;
}

interface VideoAIChatProps {
  mediaContext: MediaContext;
  defaultOpen?: boolean;
}

function getMediaLabel(type: 'movie' | 'tv') {
  return type === 'tv' ? 'series' : 'movie';
}

const QUICK_PROMPTS = [
  { label: (type: 'movie' | 'tv') => `Summarize the ${getMediaLabel(type)}`, prompt: (type: 'movie' | 'tv') => `Give me a brief summary of what this ${getMediaLabel(type)} is about.` },
  { label: () => 'Recommend related content', prompt: () => 'Recommend similar movies or shows I might enjoy based on this title.' },
  { label: () => 'Tell me about the cast', prompt: () => 'Tell me about the main cast members and their roles.' },
];

/** Render text with **bold** markdown support */
function FormattedText({ text }: { text: string }) {
  // Split on **...** and alternate between plain and bold segments
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-3 py-2">
    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

export default function VideoAIChat({ mediaContext, defaultOpen = false }: VideoAIChatProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll only within the chat container, not the whole page
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Reset chat when media or episode changes
  useEffect(() => {
    setMessages([]);
    setShowQuickPrompts(true);
  }, [mediaContext.title, mediaContext.seasonNumber, mediaContext.episodeNumber]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), text: text.trim(), sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setShowQuickPrompts(false);

    try {
      const res = await fetch('/api/video-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ text: m.text, sender: m.sender })),
          currentMessage: text.trim(),
          mediaContext,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get response');
      }

      const data = await res.json();
      const botMsg: Message = { id: (Date.now() + 1).toString(), text: data.response, sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errText = err.message || '';
      let displayText = 'Sorry, something went wrong. Please try again.';
      if (errText.includes('quota')) {
        displayText = 'AI quota exceeded. Please wait a minute and try again.';
      } else if (errText.includes('Too many') || errText.includes('too quickly')) {
        displayText = 'You\'re sending messages too quickly. Please wait a moment.';
      } else if (errText.includes('unavailable')) {
        displayText = 'The AI model is temporarily unavailable. Please try again later.';
      }
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: displayText,
        sender: 'bot',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, mediaContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Floating trigger button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-red-800/20 hover:from-red-600/40 hover:to-red-800/40 border border-red-500/30 hover:border-red-400/60 text-gray-200 hover:text-white px-4 py-2.5 rounded-xl transition-all duration-300 backdrop-blur-sm"
      >
        <Sparkles size={18} className="text-red-400 group-hover:text-red-300" />
        <span className="text-sm font-medium">Ask AI about this {getMediaLabel(mediaContext.mediaType)}</span>
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-gray-700/80 bg-[#0d0d0d]/95 backdrop-blur-md overflow-hidden shadow-2xl shadow-red-900/10 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-900/30 to-red-950/20 border-b border-gray-700/60">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-red-400" />
          <span className="font-semibold text-white text-sm">Ask about this {getMediaLabel(mediaContext.mediaType)}</span>
        </div>
        {!defaultOpen && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setIsOpen(false); setIsMinimized(false); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {!isMinimized && (
        <>
          {/* Chat Body */}
          <div ref={chatContainerRef} className="h-[320px] overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2.5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <div className="bg-[#1a1a1a] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-gray-200 text-sm leading-relaxed">
                      Hello! Curious about what you&apos;re watching? I&apos;m here to help.
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                      Not sure what to ask? Choose something:
                    </p>
                  </div>
                </div>

                {/* Quick Prompts */}
                {showQuickPrompts && (
                  <div className="flex flex-col items-end gap-2 pl-9">
                    {QUICK_PROMPTS.map((qp, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(qp.prompt(mediaContext.mediaType))}
                        className="text-sm px-4 py-2 rounded-full border border-gray-600/60 text-gray-300 hover:text-white hover:border-red-400/60 hover:bg-red-500/10 transition-all duration-200"
                      >
                        {qp.label(mediaContext.mediaType)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#E50914]/80 text-white rounded-tr-sm'
                      : 'bg-[#1a1a1a] text-gray-200 rounded-tl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap"><FormattedText text={msg.text} /></p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-[#1a1a1a] rounded-2xl rounded-tl-sm px-2 py-1">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-700/60 bg-[#0a0a0a]/50">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 bg-[#1a1a1a] text-white text-sm placeholder-gray-500 rounded-full px-4 py-2.5 border border-gray-700/60 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/30 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="flex-shrink-0 p-2.5 rounded-full bg-[#E50914] hover:bg-[#CC0712] text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 text-center">
              AI can make mistakes, so double-check it.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
