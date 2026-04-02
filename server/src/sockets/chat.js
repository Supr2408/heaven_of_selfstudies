const Message = require('../models/Message');
const { sanitizeMarkdown } = require('../utils/validation');

const CHAT_RETENTION_MS = 30 * 60 * 1000;
const MESSAGE_COOLDOWN_MS = 30 * 1000;
const AUTO_HIDE_REPORT_THRESHOLD = 3;
const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s-]{7,}\d)/;
const CONTACT_PROMOTION_PATTERN =
  /\b(?:whatsapp|telegram|tg|tele(?:gram)?|discord|group link|join (?:my|our|the) group|contact me|call me|dm me|inbox me|message me privately|personal number|phone number)\b/i;

const socketSessions = new Map();
const roomPresence = new Map();
const userCooldowns = new Map();

function validateRoomFormat(roomId) {
  return /^[a-zA-Z0-9\-_]+_\d{4}_[a-zA-Z0-9\-_]+$/.test(roomId);
}

async function pruneExpiredMessages(weekId) {
  const cutoff = new Date(Date.now() - CHAT_RETENTION_MS);
  await Message.deleteMany({
    weekId,
    timestamp: { $lt: cutoff },
  });
}

function incrementPresence(roomId, userId) {
  if (!roomPresence.has(roomId)) {
    roomPresence.set(roomId, new Map());
  }

  const roomUsers = roomPresence.get(roomId);
  roomUsers.set(userId, (roomUsers.get(userId) || 0) + 1);
}

function decrementPresence(roomId, userId) {
  if (!roomPresence.has(roomId)) return;

  const roomUsers = roomPresence.get(roomId);
  const nextCount = (roomUsers.get(userId) || 0) - 1;

  if (nextCount <= 0) {
    roomUsers.delete(userId);
  } else {
    roomUsers.set(userId, nextCount);
  }

  if (roomUsers.size === 0) {
    roomPresence.delete(roomId);
  }
}

function emitRoomStats(io, roomId) {
  const onlineUsers = roomPresence.get(roomId)?.size || 0;
  io.to(roomId).emit('room-stats', { onlineUsers });
}

function cleanupSession(io, socket) {
  const session = socketSessions.get(socket.id);
  if (!session) return;

  socket.leave(session.roomId);
  decrementPresence(session.roomId, session.userId);
  socketSessions.delete(socket.id);
  emitRoomStats(io, session.roomId);
}

function getCooldownRemaining(userId, roomId) {
  const key = `${userId}:${roomId}`;
  const lastSentAt = userCooldowns.get(key);
  if (!lastSentAt) return 0;

  const remainingMs = MESSAGE_COOLDOWN_MS - (Date.now() - lastSentAt);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

function startCooldown(userId, roomId) {
  userCooldowns.set(`${userId}:${roomId}`, Date.now());
}

function containsBlockedChatContent(content = '') {
  const normalized = String(content || '').trim();
  if (!normalized) return false;

  return (
    LINK_PATTERN.test(normalized) ||
    EMAIL_PATTERN.test(normalized) ||
    PHONE_PATTERN.test(normalized) ||
    CONTACT_PROMOTION_PATTERN.test(normalized)
  );
}

const initializeSocketIO = (io, socket) => {
  socket.on('join-room', async (data) => {
    try {
      const { roomId, weekId, userId } = data || {};

      if (!roomId || !weekId || !userId || !validateRoomFormat(roomId)) {
        socket.emit('chat-error', { message: 'Invalid room details.' });
        return;
      }

      cleanupSession(io, socket);

      await pruneExpiredMessages(weekId);

      socket.join(roomId);
      socket.userData = { roomId, weekId, userId };
      socketSessions.set(socket.id, { roomId, weekId, userId });
      incrementPresence(roomId, String(userId));
      emitRoomStats(io, roomId);

      const cutoff = new Date(Date.now() - CHAT_RETENTION_MS);
      const messages = await Message.find({
        weekId,
        isDeleted: false,
        timestamp: { $gte: cutoff },
      })
        .sort({ timestamp: 1 })
        .limit(50)
        .populate('userId', 'name avatar')
        .populate({
          path: 'repliedTo',
          populate: { path: 'userId', select: 'name avatar' },
        })
        .lean();

      socket.emit('message-history', messages);
      socket.emit('cooldown-update', {
        remainingSeconds: getCooldownRemaining(String(userId), roomId),
      });
    } catch (error) {
      console.error('Error joining chat room:', error);
      socket.emit('chat-error', { message: 'Failed to join quick chat.' });
    }
  });

  socket.on('send-message', async (data) => {
    try {
      const { content, repliedTo = null } = data || {};
      const { roomId, weekId, userId } = socket.userData || {};

      if (!roomId || !weekId || !userId) {
        socket.emit('chat-error', { message: 'Please re-open the chat and try again.' });
        return;
      }

      const sanitizedContent = sanitizeMarkdown(String(content || '')).trim();
      if (!sanitizedContent) {
        socket.emit('chat-error', { message: 'Message cannot be empty.' });
        return;
      }

      if (sanitizedContent.length > 600) {
        socket.emit('chat-error', { message: 'Message is too long.' });
        return;
      }

      if (containsBlockedChatContent(sanitizedContent)) {
        socket.emit('chat-error', {
          message:
            'Links, phone numbers, emails, and personal contact/group invites are not allowed in quick chat. Use the discussion board instead.',
        });
        return;
      }

      const remainingSeconds = getCooldownRemaining(String(userId), roomId);
      if (remainingSeconds > 0) {
        socket.emit('cooldown-update', { remainingSeconds });
        socket.emit('chat-error', {
          message: `Please wait ${remainingSeconds}s before sending again.`,
        });
        return;
      }

      await pruneExpiredMessages(weekId);

      const duplicateMessage = await Message.findOne({
        weekId,
        userId,
        isDeleted: false,
        content: sanitizedContent,
        timestamp: { $gte: new Date(Date.now() - CHAT_RETENTION_MS) },
      }).select('_id');

      if (duplicateMessage) {
        socket.emit('chat-error', {
          message: 'Repeated messages are blocked in quick chat. Please avoid spam.',
        });
        return;
      }

      const message = await Message.create({
        weekId,
        userId,
        content: sanitizedContent,
        repliedTo: repliedTo || null,
      });

      await message.populate('userId', 'name avatar');
      if (message.repliedTo) {
        await message.populate({
          path: 'repliedTo',
          populate: { path: 'userId', select: 'name avatar' },
        });
      }

      startCooldown(String(userId), roomId);
      io.to(roomId).emit('new-message', {
        _id: message._id,
        userId: message.userId,
        content: message.content,
        repliedTo: message.repliedTo,
        timestamp: message.timestamp,
      });

      socket.emit('cooldown-update', { remainingSeconds: 30 });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('chat-error', { message: 'Unable to send your message.' });
    }
  });

  socket.on('report-message', async (data) => {
    try {
      const { messageId, reason } = data || {};
      const { userId } = socket.userData || {};

      if (!messageId || !userId) {
        socket.emit('chat-error', { message: 'Invalid report request.' });
        return;
      }

      const message = await Message.findById(messageId);
      if (!message || message.isDeleted) {
        socket.emit('chat-error', { message: 'This message is no longer available.' });
        return;
      }

      const alreadyReported = (message.reports || []).some(
        (report) => String(report.userId) === String(userId)
      );

      if (alreadyReported) {
        socket.emit('chat-error', { message: 'You already reported this message.' });
        return;
      }

      message.reports.push({
        userId,
        reason: sanitizeMarkdown(String(reason || 'Spam')),
        reportedAt: new Date(),
      });

      if (message.reports.length >= AUTO_HIDE_REPORT_THRESHOLD) {
        message.isDeleted = true;
        message.deletedAt = new Date();
      }

      await message.save();

      if (message.isDeleted) {
        const session = socket.userData || {};
        if (session.roomId) {
          io.to(session.roomId).emit('message-removed', { messageId: String(message._id) });
        }
      }

      socket.emit('report-success', { messageId });
    } catch (error) {
      console.error('Error reporting message:', error);
      socket.emit('chat-error', { message: 'Unable to report this message.' });
    }
  });

  socket.on('leave-room', () => {
    cleanupSession(io, socket);
  });

  socket.on('disconnect', () => {
    cleanupSession(io, socket);
  });
};

module.exports = { initializeSocketIO };
