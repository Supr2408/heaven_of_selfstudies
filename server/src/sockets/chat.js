const Message = require('../models/Message');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const { sanitizeMarkdown } = require('../utils/validation');

const CHAT_RETENTION_MS = 30 * 60 * 1000;
const MESSAGE_COOLDOWN_MS = 30 * 1000;
const AUTO_HIDE_REPORT_THRESHOLD = 3;
const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s-]{7,}\d)/;
const CONTACT_PROMOTION_PATTERN =
  /\b(?:whatsapp|telegram|tg|tele(?:gram)?|discord|group link|join (?:my|our|the) group|contact me|call me|dm me|inbox me|message me privately|personal number|phone number)\b/i;
const USER_SOCKET_SELECT = '_id authProvider';

const socketSessions = new Map();
const roomPresence = new Map();
const userCooldowns = new Map();
const globalPresence = new Map();

function sanitizePresenceText(value = '', maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function buildPresenceMetadata(payload = {}) {
  const metadata = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'routePath')) {
    metadata.routePath = sanitizePresenceText(payload.routePath, 240);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'courseId')) {
    metadata.courseId = sanitizePresenceText(payload.courseId, 80);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'courseTitle')) {
    metadata.courseTitle = sanitizePresenceText(payload.courseTitle, 180);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'yearInstanceId')) {
    metadata.yearInstanceId = sanitizePresenceText(payload.yearInstanceId, 80);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'batchLabel')) {
    metadata.batchLabel = sanitizePresenceText(payload.batchLabel, 80);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'weekId')) {
    metadata.weekId = sanitizePresenceText(payload.weekId, 80);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'weekTitle')) {
    metadata.weekTitle = sanitizePresenceText(payload.weekTitle, 180);
  }

  return metadata;
}

function getWeekPresenceChannel(roomId) {
  return `presence:${roomId}`;
}

function normalizeIpAddress(value = '') {
  return String(value || '')
    .trim()
    .replace(/^::ffff:/, '')
    .replace(/^\[|\]$/g, '');
}

function getSocketIpAddress(socket) {
  const forwardedFor = String(socket.handshake?.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map((item) => item.trim())
    .find(Boolean);
  const rawIp =
    String(socket.handshake?.headers?.['cf-connecting-ip'] || '').trim() ||
    forwardedFor ||
    String(socket.handshake?.headers?.['x-real-ip'] || '').trim() ||
    String(socket.handshake?.address || '').trim() ||
    String(socket.request?.socket?.remoteAddress || '').trim();

  return normalizeIpAddress(rawIp);
}

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

function cleanupWeekPresence(io, socket) {
  const presence = socket.weekPresenceData;
  if (!presence?.roomId || !presence?.userId) return;

  socket.leave(getWeekPresenceChannel(presence.roomId));
  decrementPresence(presence.roomId, presence.userId);
  socket.weekPresenceData = null;
  emitRoomStats(io, presence.roomId);
}

function emitRoomStats(io, roomId) {
  const onlineUsers = roomPresence.get(roomId)?.size || 0;
  io
    .to(roomId)
    .to(getWeekPresenceChannel(roomId))
    .emit('room-stats', { onlineUsers });
}

function incrementGlobalPresence(userId, ipAddress = '', payload = {}) {
  const existing = globalPresence.get(userId) || {
    connectionCount: 0,
    ipCounts: new Map(),
    metadata: {},
    lastSyncedAt: null,
  };
  const normalizedIp = normalizeIpAddress(ipAddress);
  const nextIpCounts = new Map(existing.ipCounts || []);
  const nextMetadata = {
    ...(existing.metadata || {}),
    ...buildPresenceMetadata(payload),
  };

  existing.connectionCount += 1;
  if (normalizedIp) {
    nextIpCounts.set(normalizedIp, (nextIpCounts.get(normalizedIp) || 0) + 1);
  }

  globalPresence.set(userId, {
    connectionCount: existing.connectionCount,
    ipCounts: nextIpCounts,
    metadata: nextMetadata,
    lastSyncedAt: new Date().toISOString(),
  });
}

function decrementGlobalPresence(userId, ipAddress = '') {
  if (!globalPresence.has(userId)) return;

  const existing = globalPresence.get(userId);
  const nextCount = (existing?.connectionCount || 0) - 1;
  if (nextCount <= 0) {
    globalPresence.delete(userId);
  } else {
    const normalizedIp = normalizeIpAddress(ipAddress);
    const nextIpCounts = new Map(existing?.ipCounts || []);

    if (normalizedIp && nextIpCounts.has(normalizedIp)) {
      const nextIpCount = (nextIpCounts.get(normalizedIp) || 0) - 1;
      if (nextIpCount <= 0) {
        nextIpCounts.delete(normalizedIp);
      } else {
        nextIpCounts.set(normalizedIp, nextIpCount);
      }
    }

    globalPresence.set(userId, {
      connectionCount: nextCount,
      ipCounts: nextIpCounts,
      metadata: existing?.metadata || {},
      lastSyncedAt: existing?.lastSyncedAt || null,
    });
  }
}

function updateGlobalPresence(userId, payload = {}) {
  if (!globalPresence.has(userId)) return;

  const existing = globalPresence.get(userId);
  globalPresence.set(userId, {
    ...existing,
    metadata: {
      ...(existing?.metadata || {}),
      ...buildPresenceMetadata(payload),
    },
    lastSyncedAt: new Date().toISOString(),
  });
}

function emitGlobalPresence(io) {
  io.emit('presence-stats', {
    activeUsers: globalPresence.size,
  });
}

function getGlobalPresenceCount() {
  return globalPresence.size;
}

function getGlobalPresenceSnapshot() {
  return [...globalPresence.entries()].map(([userId, presence = {}]) => {
    const ipAddress = [...(presence.ipCounts?.entries() || [])]
      .sort((left, right) => right[1] - left[1])[0]?.[0] || '';

    return {
      userId,
      connectionCount: presence.connectionCount || 0,
      ipAddress,
      routePath: sanitizePresenceText(presence.metadata?.routePath, 240),
      courseId: sanitizePresenceText(presence.metadata?.courseId, 80),
      courseTitle: sanitizePresenceText(presence.metadata?.courseTitle, 180),
      yearInstanceId: sanitizePresenceText(presence.metadata?.yearInstanceId, 80),
      batchLabel: sanitizePresenceText(presence.metadata?.batchLabel, 80),
      weekId: sanitizePresenceText(presence.metadata?.weekId, 80),
      weekTitle: sanitizePresenceText(presence.metadata?.weekTitle, 180),
      lastSyncedAt: presence.lastSyncedAt || null,
    };
  });
}

function cleanupSession(io, socket) {
  const session = socketSessions.get(socket.id);
  if (!session) return;

  socket.leave(session.roomId);
  socketSessions.delete(socket.id);
}

function getCooldownRemaining(userId, roomId) {
  const key = `${userId}:${roomId}`;
  const lastSentAt = userCooldowns.get(key);
  if (!lastSentAt) return 0;

  const remainingMs = MESSAGE_COOLDOWN_MS - (Date.now() - lastSentAt);
  if (remainingMs <= 0) {
    userCooldowns.delete(key);
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function startCooldown(userId, roomId) {
  userCooldowns.set(`${userId}:${roomId}`, Date.now());
}

function pruneExpiredCooldowns() {
  const cutoff = Date.now() - MESSAGE_COOLDOWN_MS;

  for (const [key, lastSentAt] of userCooldowns.entries()) {
    if (lastSentAt <= cutoff) {
      userCooldowns.delete(key);
    }
  }
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

async function authenticateSocketUser(socket) {
  if (socket.currentUser) {
    return socket.currentUser;
  }

  const token = socket.handshake?.auth?.token;
  if (!token) {
    throw new Error('Missing authentication token');
  }

  const decoded = verifyToken(token);
  const user = await User.findById(decoded.userId).select(USER_SOCKET_SELECT).lean();
  if (!user) {
    throw new Error('User not found');
  }

  socket.currentUser = user;
  return user;
}

async function ensureGlobalPresence(io, socket, payload = {}) {
  const user = await authenticateSocketUser(socket);
  const userId = String(user._id);
  const ipAddress = getSocketIpAddress(socket);

  if (!socket.globalPresenceUserId) {
    socket.globalPresenceUserId = userId;
    socket.globalPresenceIpAddress = ipAddress;
    incrementGlobalPresence(userId, ipAddress, payload);
  } else {
    updateGlobalPresence(userId, payload);
  }

  emitGlobalPresence(io);
}

const initializeSocketIO = (io, socket) => {
  socket.on('presence-init', async (data) => {
    try {
      await ensureGlobalPresence(io, socket, data);
    } catch (error) {
      console.error('Error initializing global presence:', error);
      socket.emit('chat-error', { message: 'Unable to initialize live presence.' });
    }
  });

  socket.on('presence-sync-request', async (data) => {
    try {
      await ensureGlobalPresence(io, socket, data);
    } catch (error) {
      console.error('Error syncing global presence:', error);
    }
  });

  socket.on('join-week-presence', async (data) => {
    try {
      const { roomId, weekId } = data || {};
      const user = await authenticateSocketUser(socket);
      const userId = String(user._id);

      if (!roomId || !weekId || !validateRoomFormat(roomId)) {
        socket.emit('chat-error', { message: 'Invalid room details.' });
        return;
      }

      if (
        socket.weekPresenceData?.roomId === roomId &&
        socket.weekPresenceData?.userId === userId
      ) {
        emitRoomStats(io, roomId);
        return;
      }

      cleanupWeekPresence(io, socket);

      socket.join(getWeekPresenceChannel(roomId));
      socket.weekPresenceData = { roomId, weekId, userId };
      incrementPresence(roomId, userId);
      emitRoomStats(io, roomId);
    } catch (error) {
      console.error('Error joining week presence:', error);
      socket.emit('chat-error', { message: 'Unable to initialize week presence.' });
    }
  });

  socket.on('leave-week-presence', () => {
    cleanupWeekPresence(io, socket);
  });

  socket.on('join-room', async (data) => {
    try {
      const { roomId, weekId } = data || {};
      const user = await authenticateSocketUser(socket);

      if (!roomId || !weekId || !validateRoomFormat(roomId)) {
        socket.emit('chat-error', { message: 'Invalid room details.' });
        return;
      }

      cleanupSession(io, socket);

      await pruneExpiredMessages(weekId);

      socket.join(roomId);
      socket.userData = { roomId, weekId, userId: String(user._id) };
      socketSessions.set(socket.id, { roomId, weekId, userId: String(user._id) });

      const cutoff = new Date(Date.now() - CHAT_RETENTION_MS);
      const messages = await Message.find({
        weekId,
        isDeleted: false,
        timestamp: { $gte: cutoff },
      })
        .sort({ timestamp: 1 })
        .limit(50)
        .populate('userId', 'name displayName avatar')
        .populate({
          path: 'repliedTo',
          populate: { path: 'userId', select: 'name displayName avatar' },
        })
        .lean();

      socket.emit('message-history', messages);
      socket.emit('cooldown-update', {
        remainingSeconds: getCooldownRemaining(String(user._id), roomId),
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
      const user = await authenticateSocketUser(socket);

      if (!roomId || !weekId || !userId) {
        socket.emit('chat-error', { message: 'Please re-open the chat and try again.' });
        return;
      }

      if (user.authProvider !== 'google') {
        socket.emit('chat-error', {
          message: 'Please sign in with Google to send quick chat messages.',
        });
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

      await message.populate('userId', 'name displayName avatar');
      if (message.repliedTo) {
        await message.populate({
          path: 'repliedTo',
          populate: { path: 'userId', select: 'name displayName avatar' },
        });
      }

      startCooldown(String(userId), roomId);
      io
        .to(roomId)
        .to(getWeekPresenceChannel(roomId))
        .emit('new-message', {
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
          io
            .to(session.roomId)
            .to(getWeekPresenceChannel(session.roomId))
            .emit('message-removed', { messageId: String(message._id) });
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
    if (socket.globalPresenceUserId) {
      decrementGlobalPresence(socket.globalPresenceUserId, socket.globalPresenceIpAddress);
      socket.globalPresenceUserId = null;
      socket.globalPresenceIpAddress = null;
      emitGlobalPresence(io);
    }
    cleanupWeekPresence(io, socket);
    cleanupSession(io, socket);
  });
};

setInterval(pruneExpiredCooldowns, MESSAGE_COOLDOWN_MS).unref();

module.exports = { initializeSocketIO, getGlobalPresenceCount, getGlobalPresenceSnapshot };
