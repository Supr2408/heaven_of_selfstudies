import io from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Initialize Socket.io connection
 */
export const initializeSocket = (userName) => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  const auth = { userName, token };

  if (socket) {
    socket.auth = auth;
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
};

/**
 * Get socket instance
 */
export const getSocket = () => {
  if (!socket?.connected) {
    console.warn('Socket not connected');
  }
  return socket;
};

/**
 * Join chat room
 */
export const joinRoom = (roomId, weekId, userId) => {
  if (!socket?.connected) return;

  socket.emit('join-room', {
    roomId,
    weekId,
    userId,
  });
};

/**
 * Send message
 */
export const sendMessage = (content, repliedTo = null) => {
  if (!socket?.connected) return;

  socket.emit('send-message', {
    content,
    repliedTo,
  });
};

/**
 * Edit message
 */
export const editMessage = (messageId, content) => {
  if (!socket?.connected) return;

  socket.emit('edit-message', {
    messageId,
    content,
  });
};

/**
 * Delete message
 */
export const deleteMessage = (messageId) => {
  if (!socket?.connected) return;

  socket.emit('delete-message', {
    messageId,
  });
};

/**
 * Add reaction
 */
export const addReaction = (messageId, emoji) => {
  if (!socket?.connected) return;

  socket.emit('add-reaction', {
    messageId,
    emoji,
  });
};

/**
 * Report message
 */
export const reportMessage = (messageId, reason) => {
  if (!socket?.connected) return;

  socket.emit('report-message', {
    messageId,
    reason,
  });
};

/**
 * Typing indicator
 */
export const sendTypingIndicator = (userName) => {
  if (!socket?.connected) return;

  socket.emit('typing', { userName });
};

/**
 * Stop typing
 */
export const stopTypingIndicator = () => {
  if (!socket?.connected) return;

  socket.emit('stop-typing');
};

/**
 * Leave room
 */
export const leaveRoom = () => {
  if (!socket?.connected) return;

  socket.emit('leave-room');
};

/**
 * Close socket connection
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { initializeSocket, getSocket, joinRoom, sendMessage };
