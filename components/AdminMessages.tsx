'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { Trash2 } from 'lucide-react';

interface MessageData {
  _id: string;
  message: string;
  userEmail?: string;
  userName?: string;
  createdAt: string;
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;

    setDeleting(messageId);
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete message');
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <LoadingSpinner />
        <p className="text-gray-400">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">User Messages ({messages.length})</h3>
        <button
          onClick={fetchMessages}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          Refresh
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No messages yet</p>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg._id}
              className="p-4 bg-gray-900 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">
                      {msg.userName || msg.userEmail || 'Anonymous'}
                    </p>
                    {msg.userEmail && (
                      <p className="text-xs text-gray-500">({msg.userEmail})</p>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm break-words">{msg.message}</p>
                  <p className="text-gray-500 text-xs mt-2">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteMessage(msg._id)}
                  disabled={deleting === msg._id}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Delete message"
                >
                  {deleting === msg._id ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
