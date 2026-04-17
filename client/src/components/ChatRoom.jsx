'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Flag, MessageCircle, Send } from 'lucide-react';
import {
  initializeSocket,
  joinRoom,
  leaveRoom,
  reportMessage,
  sendMessage as emitMessage,
} from '@/lib/socket';
import { getPublicUserName, isGoogleUser } from '@/lib/user';
import useStore from '@/store/useStore';

const CHAT_RETENTION_MS = 30 * 60 * 1000;
const MESSAGE_COOLDOWN_SECONDS = 30;
const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s-]{7,}\d)/;
const CONTACT_PROMOTION_PATTERN =
  /\b(?:whatsapp|telegram|tg|tele(?:gram)?|discord|group link|join (?:my|our|the) group|contact me|call me|dm me|inbox me|message me privately|personal number|phone number)\b/i;

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'NH';

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

const containsBlockedChatContent = (content = '') => {
  const normalized = String(content || '').trim();
  if (!normalized) return false;

  return (
    LINK_PATTERN.test(normalized) ||
    EMAIL_PATTERN.test(normalized) ||
    PHONE_PATTERN.test(normalized) ||
    CONTACT_PROMOTION_PATTERN.test(normalized)
  );
};

export default function ChatRoom({ weekId, courseId, year, weekNumber, onOpenDiscussion }) {
  const {
    user,
    isAuthenticated,
    messages,
    onlineUsers,
    setMessages,
    addMessage,
    deleteMessage,
    setOnlineUsers,
  } = useStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    messages: state.messages,
    onlineUsers: state.onlineUsers,
    setMessages: state.setMessages,
    addMessage: state.addMessage,
    deleteMessage: state.deleteMessage,
    setOnlineUsers: state.setOnlineUsers,
  }));

  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [timeMarker, setTimeMarker] = useState(() => Date.now());
  const [showEntryPrompt, setShowEntryPrompt] = useState(true);
  const messagesEndRef = useRef(null);
  const canUseQuickChat = isGoogleUser(user);

  const roomId = `${courseId}_${year}_${weekId}`;

  const visibleMessages = useMemo(() => {
    const cutoff = timeMarker - CHAT_RETENTION_MS;
    return messages.filter((message) => {
      if (!message?.timestamp) return true;
      return new Date(message.timestamp).getTime() >= cutoff;
    });
  }, [messages, timeMarker]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeMarker(Date.now());
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?._id || !weekId) return;
    if (showEntryPrompt) return;

    const socket = initializeSocket(getPublicUserName(user));
    const pruneMessages = (nextMessages) => {
      const cutoff = Date.now() - CHAT_RETENTION_MS;
      return nextMessages.filter((message) => {
        if (!message?.timestamp) return true;
        return new Date(message.timestamp).getTime() >= cutoff;
      });
    };

    const handleConnect = () => {
      joinRoom(roomId, weekId, user._id);
    };

    const handleHistory = (history) => {
      setMessages(pruneMessages(history || []));
    };

    const handleMessage = (message) => {
      const isFresh = !message?.timestamp || Date.now() - new Date(message.timestamp).getTime() < CHAT_RETENTION_MS;
      if (isFresh) {
        addMessage(message);
      }
    };

    const handleRoomStats = ({ onlineUsers: count }) => {
      setOnlineUsers(Math.max(count || 0, 1));
    };

    const handleCooldown = ({ remainingSeconds }) => {
      setCooldownSeconds(Number(remainingSeconds) || 0);
    };

    const handleError = ({ message }) => {
      setStatusMessage(message || 'Something went wrong in quick chat.');
    };

    const handleReportSuccess = () => {
      setStatusMessage('Message reported for review.');
    };

    const handleMessageRemoved = ({ messageId }) => {
      if (!messageId) return;
      deleteMessage(messageId);
    };

    socket.on('connect', handleConnect);
    socket.on('message-history', handleHistory);
    socket.on('new-message', handleMessage);
    socket.on('message-removed', handleMessageRemoved);
    socket.on('room-stats', handleRoomStats);
    socket.on('cooldown-update', handleCooldown);
    socket.on('chat-error', handleError);
    socket.on('report-success', handleReportSuccess);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('message-history', handleHistory);
      socket.off('new-message', handleMessage);
      socket.off('message-removed', handleMessageRemoved);
      socket.off('room-stats', handleRoomStats);
      socket.off('cooldown-update', handleCooldown);
      socket.off('chat-error', handleError);
      socket.off('report-success', handleReportSuccess);
      leaveRoom();
      setMessages([]);
    };
  }, [
    addMessage,
    courseId,
    deleteMessage,
    isAuthenticated,
    roomId,
    setMessages,
    setOnlineUsers,
    showEntryPrompt,
    user,
    weekId,
  ]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!timeMarker) return;
    const cutoff = timeMarker - CHAT_RETENTION_MS;
    const prunedMessages = messages.filter((message) => {
      if (!message?.timestamp) return true;
      return new Date(message.timestamp).getTime() >= cutoff;
    });

    const isSameLength = prunedMessages.length === messages.length;
    const isSameOrder =
      isSameLength &&
      prunedMessages.every((message, index) => message?._id === messages[index]?._id);

    if (!isSameOrder) {
      setMessages(prunedMessages);
    }
  }, [messages, setMessages, timeMarker]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages]);

  useEffect(() => {
    if (!statusMessage) return undefined;

    const timer = window.setTimeout(() => {
      setStatusMessage('');
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const handleSend = (event) => {
    event.preventDefault();
    if (!inputValue.trim() || cooldownSeconds > 0 || !isAuthenticated || !canUseQuickChat) return;

    if (containsBlockedChatContent(inputValue)) {
      setStatusMessage(
        'Links, phone numbers, and personal contact/group invites are blocked in quick chat. Please use the discussion board instead.'
      );
      return;
    }

    emitMessage(inputValue, replyTo?._id || null);
    setInputValue('');
    setReplyTo(null);
    setStatusMessage('');
  };

  const activeUsersLabel = Math.max(onlineUsers || 0, user ? 1 : 0);
  const cooldownProgress = ((MESSAGE_COOLDOWN_SECONDS - cooldownSeconds) / MESSAGE_COOLDOWN_SECONDS) * 100;

  if (!isAuthenticated) {
    return (
      <div className="p-5 text-sm text-slate-600">
        Please log in to use the quick chat.
      </div>
    );
  }

  if (showEntryPrompt) {
    return (
      <div className="bg-white p-5">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">Check discussion board first</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Quick chat is only for short live discussion. For notes, links, solutions, or anything that should stay saved, please use the discussion board first and then come here if you still need instant help.
              </p>
              {!canUseQuickChat ? (
                <p className="mt-3 text-sm font-medium text-blue-700">
                  Guest access is read-only here. Sign in with Google if you want to send messages.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Quick chat rules: no links, no phone numbers, no personal contact details, and no WhatsApp/Telegram/group promotion.
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => onOpenDiscussion?.()}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Open discussion board
            </button>
            <button
              onClick={() => setShowEntryPrompt(false)}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {canUseQuickChat ? 'Continue to quick chat' : 'View quick chat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Instant Week Chat</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                Messages stay for 30 minutes only. Use the discussion board for notes, links, and
                anything that should stay saved. Links, contact details, and group invites are blocked here.
              </p>
            </div>
            <div className="text-right text-xs font-semibold text-slate-500">
              <p>30 min refresh</p>
              <p className="mt-1 text-sm text-emerald-600">Active users: {activeUsersLabel}</p>
            </div>
          </div>

          {statusMessage ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="h-[360px] overflow-y-auto px-5 py-4">
        {visibleMessages.length ? (
          <div className="space-y-4">
            {visibleMessages.map((message) => (
              <div key={message._id} className="group flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {getInitials(getPublicUserName(message.userId))}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {getPublicUserName(message.userId)}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
                  </div>

                  {message.repliedTo ? (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Replying to {getPublicUserName(message.repliedTo?.userId)}: {message.repliedTo?.content}
                    </div>
                  ) : null}

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {message.content}
                  </p>

                  {canUseQuickChat ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setReplyTo(message)}
                        className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                        aria-label="Reply to message"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={() => reportMessage(message._id, 'Spam or inappropriate')}
                        className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                        aria-label="Report message"
                        title="Report spam or inappropriate message"
                      >
                        <Flag size={14} />
                        Report
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
            No quick messages yet for Week {weekNumber}. Start the instant discussion.
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
        {replyTo && canUseQuickChat ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">
                Replying to {getPublicUserName(replyTo.userId)}
              </p>
              <p className="mt-1 line-clamp-2">{replyTo.content}</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              Clear
            </button>
          </div>
        ) : null}

        {canUseQuickChat ? (
          <>
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            <span>Send cooldown</span>
            <span>{cooldownSeconds > 0 ? `${cooldownSeconds}s left` : 'Ready to send'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, cooldownProgress))}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s before sending again` : 'Type a quick message (no links or contact details)...'}
            disabled={cooldownSeconds > 0}
            className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={cooldownSeconds > 0 || !inputValue.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={16} />
            Send
          </button>
        </form>
          </>
        ) : (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
            Guest mode lets you read quick chat only. Continue with Google to reply or send live messages.
          </div>
        )}
      </div>
    </div>
  );
}
