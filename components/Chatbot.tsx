"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send } from 'lucide-react';


interface Message {
  text: string;
  sender: 'user' | 'bot';
}

const TypingIndicator = () => (
  <div className="flex items-center space-x-1 p-1">
    <span className="dot animate-bounce" style={{ animationDelay: '0s' }}>.</span>
    <span className="dot animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
    <span className="dot animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
    <style jsx>{`
      @keyframes bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-3px); }
      }
      .dot {
        animation-duration: 1s;
        animation-iteration-count: infinite;
        font-size: 1.2em;
        line-height: 1;
      }
    `}</style>
  </div>
);

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false); // New state for managing rendering
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hello! How can I help you with movies or J-Squared Cinema today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator
  const chatEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setShowChatbot(true);
    } else {
      const timer = setTimeout(() => setShowChatbot(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    const userMessage: Message = { text: inputValue, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare messages for the API (exclude the initial bot message if it's static)
      const messagesForApi = messages.slice(1).map(msg => ({
        text: msg.text,
        sender: msg.sender,
      }));
      // Add the current user message to the API messages
      messagesForApi.push({ text: inputValue, sender: 'user' });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesForApi, // Send full conversation history
          currentMessage: inputValue, // Send the current message
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botResponse: Message = { text: data.response, sender: 'bot' };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error("Error fetching from Gemini API:", error);
      const errorMessage: Message = { text: "I'm sorry, I encountered an error and cannot respond right now. Please try again later.", sender: 'bot' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 bg-accent p-4 rounded-full shadow-lg hover:bg-accent-darker transition-colors z-50 animate-pulse-once"
        >
          <Bot className="text-white" />
        </button>
      )}

      {showChatbot && (
        <div className={`
          fixed bottom-4 right-4 w-80 h-96 bg-ui-elements rounded-lg shadow-xl flex flex-col z-50
          transition-all duration-300 ease-in-out
          ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}>
          <div className="flex justify-between items-center p-3 bg-gray-800 rounded-t-lg">
            <h3 className="text-white font-bold">J-Squared Bot</h3>
            <button onClick={() => setIsOpen(false)}>
              <X className="text-white" />
            </button>
          </div>
          <div className="flex-grow p-4 overflow-y-auto bg-background relative">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className={`p-2 rounded-lg max-w-xs ${msg.sender === 'user' ? 'bg-accent' : 'bg-gray-700'}`}>
                  <p className="text-sm text-white">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start mb-2">
                <div className="p-2 rounded-lg bg-gray-700">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-gray-700 flex">
            <input
              type="text"
              placeholder={isLoading ? "Gemini is thinking..." : "Type your message..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="w-full bg-gray-800 text-white p-2 rounded-l-md focus:outline-none"
              disabled={isLoading}
            />
            <button onClick={handleSendMessage} className="bg-accent p-2 rounded-r-md" disabled={isLoading}>
              <Send className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
