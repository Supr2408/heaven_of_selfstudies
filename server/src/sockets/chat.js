const Message = require('../models/Message');
const User = require('../models/User');
const Week = require('../models/Week');
const { sanitizeMarkdown } = require('../utils/validation');

// Track user sessions per socket for cleanup
const socketUserSessions = new Map();

/**
 * Helper: Validate room naming format {courseId}_{year}_{weekId}
 * Accepts: courseId_year_weekId (where courseId and weekId can be ObjectIds, slugs, or alphanumeric)
 * Allows: alphanumeric, hyphens, underscores for courseId and weekId
 */
function validateRoomFormat(roomId) {
  const roomRegex = /^[a-zA-Z0-9\-_]+_\d{4}_[a-zA-Z0-9\-_]+$/;
  return roomRegex.test(roomId);
}

/**
 * Helper: Cleanup user from all rooms on disconnect
 */
function cleanupUserSession(socket) {
  if (socketUserSessions.has(socket.id)) {
    const userSession = socketUserSessions.get(socket.id);
    socket.leave(userSession.roomId);
    socketUserSessions.delete(socket.id);
    console.log(`✅ Cleaned up session for socket ${socket.id}`);
  }
}

/**
 * Rate limiter for messages per user per room
 * Limits: 10 messages per minute per room
 */
const messageRateLimiter = new Map();

function checkMessageRateLimit(userId, roomId) {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxMessages = 10;

  if (!messageRateLimiter.has(key)) {
    messageRateLimiter.set(key, []);
  }

  const timestamps = messageRateLimiter.get(key);
  
  // Remove old timestamps outside the window
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
  messageRateLimiter.set(key, validTimestamps);

  if (validTimestamps.length >= maxMessages) {
    return false; // Rate limit exceeded
  }

  validTimestamps.push(now);
  return true; // Allow message
}

/**
 * Socket.io handlers for real-time chat
 * Room format: courseId_year_weekNumber
 */
const initializeSocketIO = (io, socket) => {
  /**
   * Join chat room
   */
  socket.on('join-room', async (data) => {
    try {
      const { roomId, weekId, userId } = data;

      if (!roomId || !userId) {
        socket.emit('error', { message: 'Invalid room or user data' });
        return;
      }

      // Validate room naming format
      if (!validateRoomFormat(roomId)) {
        console.error(`❌ Invalid room format: ${roomId}`);
        socket.emit('error', { message: `Invalid room format: ${roomId}` });
        return;
      }

      // Cleanup previous room session if exists
      cleanupUserSession(socket);

      // Join Socket.io room
      socket.join(roomId);
      
      // Store session info
      socket.userData = { roomId, userId, weekId };
      socketUserSessions.set(socket.id, { roomId, userId, weekId, joinedAt: new Date() });

      console.log(`✅ User ${userId} joined room ${roomId} (socket: ${socket.id})`);

      // Notify others that user joined
      io.to(roomId).emit('user-joined', {
        message: `${socket.handshake.auth.userName || 'User'} joined the chat`,
        timestamp: new Date(),
        userId,
      });

      // Load message history (last 50 messages for this week only)
      console.log(`📝 Loading message history for weekId: ${weekId}`);
      const messages = await Message.find({ weekId, isDeleted: false })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('userId', 'name avatar')
        .populate('repliedTo', 'content userId')
        .lean();

      console.log(`✅ Found ${messages.length} messages for week`);
      socket.emit('message-history', messages.reverse());
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  /**
   * Send message
   */
  socket.on('send-message', async (data) => {
    try {
      const { content, repliedTo } = data;
      const { userId, weekId, roomId } = socket.userData;

      if (!content || !userId || !weekId) {
        console.error('❌ Invalid message data', { content: !!content, userId: !!userId, weekId: !!weekId });
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Apply rate limiting (10 messages per minute per room)
      if (!checkMessageRateLimit(userId, roomId)) {
        socket.emit('error', { 
          message: 'Message rate limit exceeded. Max 10 messages per minute per room.',
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }

      // Sanitize content
      const sanitizedContent = sanitizeMarkdown(content);

      // Validate content length
      if (sanitizedContent.length > 5000) {
        socket.emit('error', { message: 'Message too long (max 5000 characters)' });
        return;
      }

      // Create message
      const newMessage = new Message({
        weekId,
        userId,
        content: sanitizedContent,
        repliedTo: repliedTo || null,
      });

      await newMessage.save();
      console.log(`✅ Message saved to DB - ID: ${newMessage._id}`);

      // Populate user info
      await newMessage.populate('userId', 'name avatar');
      if (newMessage.repliedTo) {
        await newMessage.populate('repliedTo', 'content userId');
      }

      // Broadcast to room (week-isolated)
      io.to(roomId).emit('new-message', {
        _id: newMessage._id,
        userId: newMessage.userId,
        content: newMessage.content,
        repliedTo: newMessage.repliedTo,
        timestamp: newMessage.timestamp,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  /**
   * Edit message
   */
  socket.on('edit-message', async (data) => {
    try {
      const { messageId, content } = data;
      const { userId } = socket.userData;

      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Only allow user to edit their own messages
      if (message.userId.toString() !== userId) {
        socket.emit('error', { message: 'Unauthorized to edit this message' });
        return;
      }

      message.content = sanitizeMarkdown(content);
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      io.to(socket.userData.roomId).emit('message-edited', {
        messageId,
        content: message.content,
        editedAt: message.editedAt,
      });
    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  /**
   * Delete message (soft delete)
   */
  socket.on('delete-message', async (data) => {
    try {
      const { messageId } = data;
      const { userId } = socket.userData;

      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check permissions (owner or moderator/admin)
      const user = await User.findById(userId);
      if (
        message.userId.toString() !== userId &&
        !['moderator', 'admin'].includes(user.role)
      ) {
        socket.emit('error', { message: 'Unauthorized to delete this message' });
        return;
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      io.to(socket.userData.roomId).emit('message-deleted', {
        messageId,
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  /**
   * Add reaction to message
   */
  socket.on('add-reaction', async (data) => {
    try {
      const { messageId, emoji } = data;
      const { userId, roomId } = socket.userData;

      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (!message.reactions) {
        message.reactions = new Map();
      }

      if (!message.reactions[emoji]) {
        message.reactions[emoji] = [];
      }

      if (!message.reactions[emoji].includes(userId)) {
        message.reactions[emoji].push(userId);
      }

      await message.save();

      io.to(roomId).emit('reaction-added', {
        messageId,
        emoji,
        reactions: Object.fromEntries(message.reactions),
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  });

  /**
   * Report message
   */
  socket.on('report-message', async (data) => {
    try {
      const { messageId, reason } = data;
      const { userId } = socket.userData;

      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      message.reports.push({
        userId,
        reason,
        reportedAt: new Date(),
      });

      await message.save();

      socket.emit('message', {
        type: 'success',
        text: 'Message reported successfully',
      });
    } catch (error) {
      console.error('Error reporting message:', error);
      socket.emit('error', { message: 'Failed to report message' });
    }
  });

  /**
   * Typing indicator
   */
  socket.on('typing', (data) => {
    const { userName } = data;
    socket.to(socket.userData.roomId).emit('user-typing', {
      userName: userName || 'Someone',
    });
  });

  /**
   * Stop typing
   */
  socket.on('stop-typing', () => {
    socket.to(socket.userData.roomId).emit('user-stop-typing', {});
  });

  /**
   * Leave room
   */
  socket.on('leave-room', () => {
    if (socket.userData) {
      console.log(`👋 User ${socket.userData.userId} leaving room ${socket.userData.roomId}`);
      io.to(socket.userData.roomId).emit('user-left', {
        message: 'User left the chat',
        timestamp: new Date(),
        userId: socket.userData.userId,
      });
      cleanupUserSession(socket);
    }
  });

  /**
   * Disconnect handler - automatic cleanup
   */
  socket.on('disconnect', () => {
    if (socket.userData) {
      console.log(`🔌 User ${socket.userData.userId} disconnected from room ${socket.userData.roomId}`);
      io.to(socket.userData.roomId).emit('user-disconnected', {
        message: 'User disconnected',
        timestamp: new Date(),
        userId: socket.userData.userId,
      });
    }
    cleanupUserSession(socket);
  });
};

module.exports = { initializeSocketIO };

module.exports = { initializeSocketIO };
