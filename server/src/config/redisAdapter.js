const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

/**
 * Redis Socket.io Adapter Configuration
 * Enables horizontal scaling and cross-server message synchronization
 * Necessary for production deployments with multiple backend instances
 */

let pubClient;
let subClient;

/**
 * Initialize Redis clients and Socket.io adapter
 * @param {SocketIO.Server} io - Socket.io server instance
 * @returns {Promise} Resolves when Redis is connected
 */
const initializeRedisAdapter = async (io) => {
  try {
    // For local development, use simple adapter (no Redis needed)
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      console.log('⚠️  Using in-memory adapter (dev mode). Use Redis in production.');
      return null;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Create pub/sub clients
    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();

    // Connect clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    console.log('✓ Redis connected for Socket.io adapter');

    // Attach adapter to Socket.io
    io.adapter(createAdapter(pubClient, subClient));

    // Monitor connection
    pubClient.on('error', (err) => {
      console.error('❌ Redis pub client error:', err);
      // App should handle reconnection or fallback
    });

    subClient.on('error', (err) => {
      console.error('❌ Redis sub client error:', err);
    });

    return { pubClient, subClient };
  } catch (error) {
    console.error('❌ Failed to initialize Redis adapter:', error);
    
    if (process.env.NODE_ENV === 'production') {
      throw error; // Fail fast in production
    } else {
      console.warn('⚠️  Falling back to in-memory adapter');
      return null;
    }
  }
};

/**
 * Graceful shutdown of Redis clients
 */
const closeRedisAdapter = async () => {
  try {
    if (pubClient) {
      await pubClient.quit();
      console.log('✓ Redis pub client closed');
    }
    if (subClient) {
      await subClient.quit();
      console.log('✓ Redis sub client closed');
    }
  } catch (error) {
    console.error('Error closing Redis clients:', error);
  }
};

/**
 * Get Redis status
 */
const getRedisStatus = async () => {
  if (!pubClient) {
    return { connected: false, reason: 'Redis not initialized' };
  }

  try {
    const pong = await pubClient.ping();
    return {
      connected: pong === 'PONG',
      server: pubClient.options.url,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
};

module.exports = {
  initializeRedisAdapter,
  closeRedisAdapter,
  getRedisStatus,
};
