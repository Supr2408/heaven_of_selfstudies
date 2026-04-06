require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const path = require('path');
const { Server: SocketIO } = require('socket.io');
const mongoose = require('mongoose');

// Middleware imports
const { errorHandler } = require('./src/utils/errorHandler');
const { generalLimiter, authLimiter, chatLimiter } = require('./src/middleware/advancedRateLimiter');
const { initializeSocketIO } = require('./src/sockets/chat');
const { initializeRedisAdapter } = require('./src/config/redisAdapter');
const { createProductionIndexes } = require('./src/utils/mongoDbIndexes');
const { uploadsRoot } = require('./src/utils/uploadStorage');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const weekRoutes = require('./src/routes/weekRoutes');
const resourceRoutes = require('./src/routes/resourceRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');
const commonDiscussionRoutes = require('./src/routes/commonDiscussionRoutes');
const studyAnalyticsRoutes = require('./src/routes/studyAnalyticsRoutes');

const app = express();

// When running behind a proxy/load balancer (common in production),
// trust the first proxy so rate limiting and IP-based logic see the
// real client address instead of the proxy's IP.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 100 * 1024,
  perMessageDeflate: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// Middleware setup
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ limit: '512kb', extended: true, parameterLimit: 50 }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsRoot));

// Apply general rate limiter to all routes except health checks
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/disclaimer') {
    return next();
  }
  generalLimiter(req, res, next);
});

// Static materials endpoint disabled - Cloud Computing folder removed
// app.use('/materials', express.static(path.join(__dirname, '../Cloud Computing')));

// MongoDB connection with production features
let dbConnected = false;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nptel')
  .then(async () => {
    console.log('✅ MongoDB connected');
    dbConnected = true;
    
    // Create production indexes if in production mode
    if (process.env.NODE_ENV === 'production') {
      try {
        await createProductionIndexes();
        console.log('✅ Production indexes created');
      } catch (err) {
        console.error('⚠️  Error creating indexes:', err.message);
      }
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    dbConnected = false;
  });

// Routes (rate limiting applied at endpoint level within each route file)
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/weeks', weekRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/common-discussion', commonDiscussionRoutes);
app.use('/api/study-analytics', studyAnalyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Disclaimer endpoint
app.get('/api/disclaimer', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Not affiliated with NPTEL. Content belongs to original creators.',
  });
});

// Initialize Redis adapter for Socket.io (if available)
initializeRedisAdapter(io).catch(err => {
  console.warn('⚠️  Redis adapter initialization skipped:', err.message);
  // Continue without Redis adapter - falls back to in-memory mode
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Initialize chat socket handlers with rate limiting
  initializeSocketIO(io, socket);

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`⚠️  Socket error [${socket.id}]:`, error);
  });
});

// 404 handler (before error handler)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Production-safe error handling middleware (MUST be last)
app.use((err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  console.error('❌ Error:', {
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    stack: isDevelopment ? err.stack : undefined,
  });

  // Default error response
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Prevent exposing internal error details in production
  if (!isDevelopment && statusCode === 500) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(isDevelopment && { error: err.message, stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = { app, server, io };
