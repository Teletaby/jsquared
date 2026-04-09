"use client";

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface ArtistAIChatProps {
  artistName: string;
}

interface Message {
  text: string;
  sender: 'user' | 'bot';
}

const ArtistAIChat = ({ artistName }: ArtistAIChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: `Hi! I'm here to discuss ${artistName} and their career. What would you like to know?`, sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    const userMessage: Message = { text: inputValue, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Create a system-focused prompt to keep AI focused on the artist
      const systemPrompt = `You are an AI assistant specialized in discussing actors and artists. You ONLY answer questions about ${artistName} and their career, filmography, achievements, and public information. 

RULES:
1. ONLY answer questions about ${artistName} or their work
2. If someone asks who created you or technical questions, respond with: "I'm here to discuss ${artistName}'s career and work! Do you have any questions about their filmography or achievements?"
3. Stay focused on ${artistName}'s career, roles, movies/TV shows, awards, and professional accomplishments
4. Do not answer general questions unrelated to ${artistName}
5. Be concise and keep responses focused on the artist

Current question: ${inputValue}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          currentMessage: systemPrompt
        })
      });

      if (response.ok) {
        const data = await response.json();
        const botMessage: Message = { text: data.response, sender: 'bot' };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const errorMessage: Message = { text: 'Sorry, I encountered an error. Please try again.', sender: 'bot' };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = { text: 'Sorry, I encountered an error. Please try again.', sender: 'bot' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendMessage();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/50"
      >
        <MessageCircle size={18} />
        Ask AI about {artistName}
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-h-[85vh] sm:max-h-[75vh] md:max-h-[600px] max-w-sm sm:max-w-md md:max-w-2xl transform overflow-hidden rounded-2xl backdrop-blur-lg bg-white/10 border border-white/20 shadow-xl transition-all flex flex-col">
                  <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10">
                    <Dialog.Title className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white truncate">
                      Chat about {artistName}
                    </Dialog.Title>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded-full hover:bg-gray-800 transition-colors flex-shrink-0 ml-2"
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-xs lg:max-w-md xl:max-w-lg px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                            message.sender === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-100'
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-700 text-gray-100 px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 text-sm sm:text-base">
                          <Loader size={16} className="animate-spin flex-shrink-0" />
                          <span>Typing...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="border-t border-white/10 p-3 sm:p-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ask a question..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                        className="flex-1 bg-gray-800 text-white placeholder-gray-400 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isLoading || inputValue.trim() === ''}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        <Send size={18} className="sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default ArtistAIChat;
