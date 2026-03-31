# Production Hardening Implementation Guide

## Overview
This guide provides step-by-step instructions to implement production-grade features for NPTEL Hub.

---

## 1. Install Additional Dependencies

```bash
cd server

# Core production dependencies
npm install redis @socket.io/redis-adapter

# Security & Auth
npm install helmet express-validator

# Monitoring & Logging  
npm install pino pino-transport sentry/node

# Utilities
npm install uuid dotenv-safe

# Development dependencies (optional)
npm install --save-dev jest supertest
```

```bash
cd ../client

# No additional dependencies needed for frontend production features
# Next.js 14 handles most optimizations out of the box
```

---

## 2. Update Backend Server.js

### Import New Modules

```javascript
// Add these imports at the top of server.js
const helmet = require('helmet');
const { createProductionIndexes } = require('./src/utils/mongoDbIndexes');
const { initializeRedisAdapter, closeRedisAdapter } = require('./src/config/redisAdapter');
const { errorHandler } = require('./src/utils/errorHandler');
const { 
  generalLimiter, 
  authLimiter,
  chatLimiter 
} = require('./src/middleware/advancedRateLimiter');
```

### Update Middleware Stack

```javascript
// Security headers
app.use(helmet());

// Enhanced CORS with production checks
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Apply rate limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/messages/', chatLimiter);

// Other middleware...
```

### Initialize Redis Adapter

```javascript
// After Socket.io server creation
const initializeApp = async () => {
  try {
    // Initialize Redis adapter for distributed Socket.io
    if (process.env.ENABLE_REDIS_ADAPTER === 'true') {
      await initializeRedisAdapter(io);
    }

    // Create MongoDB indexes
    if (process.env.NODE_ENV === 'production') {
      await createProductionIndexes();
    }

    // Initialize Socket.io handlers
    io.on('connection', (socket) => {
      require('./src/sockets/chat').initializeSocketIO(io, socket);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      await closeRedisAdapter();
      server.close(() => {
        mongoose.connection.close();
        process.exit(0);
      });
    });

    // Start server
    server.listen(process.env.PORT, () => {
      console.log(`✓ Server running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    process.exit(1);
  }
};

initializeApp();
```

### Add Global Error Handler (Last Middleware)

```javascript
// MUST be after all other middleware and routes
app.use((err, req, res, next) => {
  errorHandler(err, req, res, next);
});
```

---

## 3. Implement Secure JWT with HttpOnly Cookies

### Update Authentication Controller

Create/update `server/src/controllers/authController.js`:

```javascript
const { generateHttpOnlyCookie } = require('../utils/jwtSecure');
const { asyncHandler } = require('../utils/errorHandler');

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validate credentials (your existing logic)
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }

  // Generate token with secure cookie options
  const { token, cookieOptions } = generateHttpOnlyCookie(user._id);

  // Set HttpOnly cookie
  res.cookie('token', token, cookieOptions);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

exports.logout = asyncHandler(async (req, res) => {
  // Clear cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
});
```

### Update Authentication Middleware

Update `server/src/middleware/auth.js` to check HttpOnly cookies:

```javascript
const { verifyToken } = require('../utils/jwtSecure');

const protectRoute = async (req, res, next) => {
  try {
    let token;

    // Check HttpOnly cookie first (most secure)
    if (req.cookies?.token) {
      token = req.cookies.token;
    }
    // Fallback: Check Authorization header (for API clients)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Please login to access this resource',
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    req.userId = decoded.userId;

    // Fetch user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

module.exports = { protectRoute };
```

---

## 4. Implement Socket.io Chat Room Management

### Update Chat Socket Handler

Replace the content of `server/src/sockets/chat.js` with the production version provided in the PRODUCTION_CHAT.js file (already created above).

### Update Backend Socket Initialization

In `server.js`, ensure proper Socket.io connection handling:

```javascript
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Initialize Socket.io handlers
  const chatHandlers = require('./src/sockets/chat');
  chatHandlers.initializeSocketIO(io, socket);

  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});
```

---

## 5. Implement Message Persistence

### Ensure Message Model Is Correct

Update `server/src/models/Message.js` to include all fields:

```javascript
const messageSchema = new mongoose.Schema(
  {
    weekId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Week',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
      trim: true,
    },
    repliedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      sparse: true,
    },
    reactions: {
      type: Map,
      of: [mongoose.Schema.Types.ObjectId],
      default: {},
    },
    isEdited: {
      type: Boolean,
      default: false,
      index: true,
    },
    editedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: Date,
  },
  { timestamps: true }
);

// Indexes for performance
messageSchema.index({ weekId: 1, timestamp: -1 });
messageSchema.index({ userId: 1, timestamp: -1 });
messageSchema.index({ repliedTo: 1 }, { sparse: true });

module.exports = mongoose.model('Message', messageSchema);
```

---

## 6. Configure MongoDB Indexes

### Run Index Creation on Startup

Add to `server.js` after MongoDB connection:

```javascript
const { createProductionIndexes } = require('./src/utils/mongoDbIndexes');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✓ MongoDB connected');
    
    // Create indexes if in production
    if (process.env.NODE_ENV === 'production') {
      await createProductionIndexes();
    }
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
```

---

## 7. Frontend Socket.io Configuration

### Update Frontend Socket Connection

In `client/src/lib/socket.js`:

```javascript
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'],
});

// Join room for specific week
export const joinWeekRoom = (courseId, year, weekNumber, weekId, userId, userName) => {
  socket.emit('join-room', {
    courseId,
    year,
    weekNumber,
    weekId,
    userId,
    userName,
  });
};

// Leave previous room
export const leaveRoom = () => {
  socket.emit('leave-room');
};

export default socket;
```

### Update Zustand Store

In `client/src/store/useStore.js`:

```javascript
import { create } = require('zustand');

const useStore = create((set) => ({
  currentRoom: null,
  messages: [],
  users: [],

  setCurrentRoom: (room) => set({ currentRoom: room }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  updateMessage: (messageId, updates) => set((state) => ({
    messages: state.messages.map(msg =>
      msg._id === messageId ? { ...msg, ...updates } : msg
    ),
  })),

  // Clear messages when switching rooms
  clearMessages: () => set({ messages: [] }),
}));

export default useStore;
```

---

## 8. Docker & Deployment Setup

### Update .env Files for Docker

Create `server/.env.docker`:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://admin:password@mongodb:27017/nptel-hub?authSource=admin
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:3000
```

### Build Docker Images

```bash
# Build backend
docker build -f server/Dockerfile -t nptel-hub-backend:latest ./

# Build frontend  
docker build -f client/Dockerfile -t nptel-hub-frontend:latest ./

# Run with compose
docker-compose -f docker-compose.production.yml up -d
```

---

## 9. Testing Checklist

```bash
# Backend tests
cd server
npm test
npm run lint

# Frontend build test
cd ../client
npm run build
npm test

# Docker image scan
docker scan nptel-hub-backend:latest
docker scan nptel-hub-frontend:latest
```

---

## 10. Monitoring Setup

### Install Monitoring Agent

```bash
cd server
npm install newrelic      # or Datadog, SignalFx, etc.
```

### Add Health Check Endpoint

```javascript
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});
```

---

## Deployment Steps

1. **Prepare Environment**
   ```bash
   cp server/.env.production server/.env
   # Edit .env with production values
   ```

2. **Push to Repository**
   ```bash
   git add .
   git commit -m "Production hardening: secure JWT, Redis, indexes, etc."
   git push origin main
   ```

3. **Run CI/CD Pipeline**
   - GitHub Actions will automatically run tests and build Docker images
   - Verify all checks pass

4. **Deploy to Production**
   ```bash
   # Via Docker Compose
   docker-compose -f docker-compose.production.yml up -d

   # Or via your deployment platform (Heroku, AWS ECS, Kubernetes, etc.)
   ```

5. **Verify Deployment**
   ```bash
   curl https://your-domain.com/api/health
   # Should return: {"status":"healthy",...}
   ```

---

## Rollback Procedure

If issues occur:

```bash
# Stop current deployment
docker-compose -f docker-compose.production.yml down

# Revert to previous version
git revert HEAD
docker-compose -f docker-compose.production.yml up -d
```

---

## Common Issues

### Redis Connection Issues
- Check REDIS_URL in environment
- Verify Redis password
- Test: `redis-cli ping`

### MongoDB Slow Queries
- Run indexes: `db.messages.getIndexes()`
- Check slow query log
- Optimize queries based on indexes

### Socket.io Cross-Server Issues
- Verify Redis adapter initialized
- Check Redis connectivity
- Monitor Redis pub/sub messages

### High Memory Usage
- Check for message memory leaks in Socket.io
- Verify MongoDB connection pooling
- Monitor Node.js heap

---

**Last Updated:** April 1, 2026
