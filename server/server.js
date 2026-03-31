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
const { generalLimiter } = require('./src/middleware/rateLimiter');
const { initializeSocketIO } = require('./src/sockets/chat');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const weekRoutes = require('./src/routes/weekRoutes');
const resourceRoutes = require('./src/routes/resourceRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware setup
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(generalLimiter);

// Serve local Cloud Computing materials as static files
app.use('/materials', express.static(path.join(__dirname, '../Cloud Computing')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/weeks', weekRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/assignments', assignmentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// Disclaimer endpoint
app.get('/api/disclaimer', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Not affiliated with NPTEL. Content belongs to original creators.',
  });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Initialize chat socket handlers
  initializeSocketIO(io, socket);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = { app, server, io };
