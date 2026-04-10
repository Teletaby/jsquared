'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface MessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MessagingModal({ isOpen, onClose }: MessagingModalProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Disable scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Apply overflow hidden to both html and body for maximum compatibility
      const htmlElement = document.documentElement;
      htmlElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      
      return () => {
        htmlElement.style.overflow = '';
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
        }),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setMessage('');
        setTimeout(() => {
          setSubmitSuccess(false);
          onClose();
        }, 2000);
      } else {
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-gray-900/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Send a Message</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {submitSuccess && (
            <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
              ✓ Message sent successfully!
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="message" className="block text-sm font-medium text-gray-300">
              Your Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell me what you like, suggestions, feedback, or anything else..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
              rows={6}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              {message.length} / 5000 characters
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
