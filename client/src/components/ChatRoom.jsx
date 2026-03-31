'use client';

import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Flag } from 'lucide-react';
import {
  initializeSocket,
  joinRoom,
  sendMessage as emitMessage,
} from '@/lib/socket';
import useStore from '@/store/useStore';

export default function ChatRoom({ weekId, courseId, year }) {
  const store = useStore();
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Validate required props
  if (!weekId || !courseId || !year) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-slate-200">
        <p className="text-red-500">Error: Missing required chat data (weekId, courseId, or year)</p>
      </div>
    );
  }

  const roomId = `${courseId}_${year}_${weekId}`;

  // Initialize socket and join room
  useEffect(() => {
    if (!store.user) return;

    try {
      setLoading(true);
      setError('');
      
      const socket = initializeSocket(store.user.name);
      socketRef.current = socket;

      const handleConnect = () => {
        console.log('📡 Socket connected, joining room:', roomId);
        joinRoom(roomId, weekId, store.user._id);
      };

      const handleMessageHistory = (messages) => {
        console.log('📥 Received message history:', messages.length, 'messages');
        store.setMessages(messages);
        setLoading(false);
      };

      const handleNewMessage = (message) => {
        console.log('💬 New message received:', message);
        store.addMessage(message);
      };

      const handleError = (error) => {
        console.error('❌ Socket error:', error);
        setError(error.message || 'Connection error');
      };

      const handleMessageEdited = ({ messageId, content }) => {
        store.updateMessage(messageId, { content, isEdited: true });
      };

      const handleMessageDeleted = ({ messageId }) => {
        store.deleteMessage(messageId);
      };

      // Register event listeners
      if (socket.connected) {
        handleConnect();
      } else {
        socket.on('connect', handleConnect);
      }

      socket.on('message-history', handleMessageHistory);
      socket.on('new-message', handleNewMessage);
      socket.on('message-edited', handleMessageEdited);
      socket.on('message-deleted', handleMessageDeleted);
      socket.on('error', handleError);
      socket.on('user-typing', ({ userName }) => {
        console.log(`${userName} is typing...`);
      });

      return () => {
        socket.off('connect', handleConnect);
        socket.off('message-history', handleMessageHistory);
        socket.off('new-message', handleNewMessage);
        socket.off('message-edited', handleMessageEdited);
        socket.off('message-deleted', handleMessageDeleted);
        socket.off('error', handleError);
      };
    } catch (err) {
      console.error('Chat initialization error:', err);
      setError('Failed to initialize chat');
      setLoading(false);
    }
  }, [weekId, courseId, year, store.user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !store.isAuthenticated) return;

    emitMessage(inputValue, replyTo?._id);
    setInputValue('');
    setReplyTo(null);
  };

  if (!store.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-500">Please login to access the chat</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-500">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 bg-white rounded-lg border border-slate-200">
      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-100 border-b border-red-400 text-red-700 text-sm">
          <p>Chat Error: {error}</p>
          <p className="text-xs mt-1 font-mono">Room: {roomId} | User: {store.user?._id}</p>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {store.messages.map((msg) => (
          <div key={msg._id} className="flex gap-3 group">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
              {msg.userId?.name?.charAt(0) || 'U'}
            </div>

            {/* Message */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{msg.userId?.name}</span>
                <span className="text-xs text-slate-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-1">{msg.content}</p>

              {/* Reply To */}
              {msg.repliedTo && (
                <div className="mt-1 pl-3 border-l-2 border-slate-300 text-xs text-slate-600">
                  <div className="font-semibold">{msg.repliedTo?.userId?.name}</div>
                  <div className="line-clamp-1">{msg.repliedTo?.content}</div>
                </div>
              )}

              {/* Actions - Visible on hover */}
              <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1 hover:bg-slate-100 rounded transition-colors">
                  <Heart size={14} className="text-slate-400 hover:text-red-500" />
                </button>
                <button
                  onClick={() => setReplyTo(msg)}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <MessageCircle size={14} className="text-slate-400" />
                </button>
                <button className="p-1 hover:bg-slate-100 rounded transition-colors">
                  <Flag size={14} className="text-slate-400 hover:text-orange-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply To Indicator */}
      {replyTo && (
        <div className="px-4 py-2 bg-blue-50 border-l-2 border-blue-500 flex justify-between items-center">
          <div className="text-sm">
            <span className="font-semibold">Replying to {replyTo.userId?.name}</span>
            <p className="text-slate-600 line-clamp-1">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-3 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
