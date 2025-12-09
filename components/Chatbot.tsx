"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send } from 'lucide-react';

interface Message {
  text: string;
  sender: 'user' | 'bot';
}

const predefinedQA: { [key: string]: string } = {
  "what is this website": "J-Squared Cinema is a movie discovery platform where you can find your next favorite movie or TV show.",
  "how does the search work": "You can search for movies by title in the search bar at the top, or use the filter menu to discover movies by genre, rating, and more.",
  "can i watch movies here": "This site is for discovery. While we provide trailers, we don't host the full movies for streaming.",
  "who made this": "This website was created by a developer using the Gemini Code Assist.",
  "recommend a movie": "I recommend checking out the 'Popular Movies' section on the homepage. You might find something you like!",
  "hello": "Hello! How can I assist you with J-Squared Cinema today?"
};

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false); // New state for managing rendering
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hello! How can I help you with movies or J-Squared Cinema today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setShowChatbot(true);
    } else {
      const timer = setTimeout(() => setShowChatbot(false), 300); // Allow exit animation to complete
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;

    const userMessage: Message = { text: inputValue, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    
    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = { text: getBotResponse(inputValue), sender: 'bot' };
      setMessages(prev => [...prev, botResponse]);
    }, 500);

    setInputValue('');
  };

  const getBotResponse = (input: string): string => {
    const lowerInput = input.toLowerCase().trim();
    const match = Object.keys(predefinedQA).find(key => lowerInput.includes(key));
    return match ? predefinedQA[match] : "I'm sorry, I can only answer questions about J-Squared Cinema and basic movie recommendations. Please try asking something else!";
  };

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 bg-accent p-4 rounded-full shadow-lg hover:bg-red-700 transition-colors z-50 animate-pulse-once"
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
            <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-b-lg text-white text-center text-lg font-bold p-4">
              Chatbot Under Maintenance. <br /> Please check back later!
            </div>
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                <div className={`p-2 rounded-lg max-w-xs ${msg.sender === 'user' ? 'bg-accent' : 'bg-gray-700'}`}>
                  <p className="text-sm text-white">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-gray-700 flex">
            <input
              type="text"
              placeholder="Chatbot Under Maintenance..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="w-full bg-gray-800 text-white p-2 rounded-l-md focus:outline-none cursor-not-allowed"
              disabled
            />
            <button onClick={handleSendMessage} className="bg-accent p-2 rounded-r-md cursor-not-allowed" disabled>
              <Send className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
