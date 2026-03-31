# NPTEL Hub - Production-ready Community Learning Platform

A structured, community-driven ecosystem for NPTEL learners with real-time collaboration, resource sharing, and hierarchical course navigation.

**Disclaimer:** Not affiliated with NPTEL. Content belongs to original creators.

## 🎯 Features

### Core Functionality
- ✅ **Hierarchical Navigation**: Subject → Course → Year → Week drill-down
- ✅ **Real-time Chat**: Socket.io-powered per-week dedicated rooms
- ✅ **Community Vault**: Grid-based notes/links with upvote system
- ✅ **Past Year Questions**: Direct links to PYQs (no PDF hosting)
- ✅ **JWT Authentication**: Secure login with HttpOnly cookies
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **XSS Prevention**: Input sanitization on all user content
- ✅ **Report System**: Users can flag inappropriate content

### Tech Stack
| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14+ (App Router), Tailwind CSS, Zustand, Lucide React |
| **Backend** | Node.js, Express.js, Modular architecture |
| **Real-time** | Socket.io with dedicated room logic |
| **Database** | MongoDB with Mongoose (strict schemas) |
| **Auth** | JWT + Bcrypt |
| **Storage** | AWS S3 / Firebase (optional) |

## 📊 Data Models

```
Subject → Courses → YearInstance → Weeks → {
  Messages (Real-time Chat),
  Resources (Vault),
  PyqLinks
}
```

### Strict Schema Validation
- **Subject**: name, slug
- **Course**: subjectId, title, code, description
- **YearInstance**: courseId, year, semester (Jan-Apr/July-Oct)
- **Week**: yearInstanceId, weekNumber (1-12)
- **Message**: weekId, userId, content, timestamp, repliedTo
- **Resource**: weekId, userId, title, type (Link/Note/Solution/Discussion), url, upvotes

## 🚀 Quick Start

### Prerequisites
- Node.js (≥18)
- MongoDB (local or MongoDB Atlas)
- npm/yarn

### 1. Clone & Setup

```bash
git clone https://github.com/yourusername/nptel-hub.git
cd nptel-hub
```

### 2. Backend Setup

```bash
cd server
cp .env.example .env
# Edit .env with your credentials

npm install
npm run dev
# Runs on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd ../client
cp .env.local.example .env.local
npm install
npm run dev
# Runs on http://localhost:3000
```

### 4. MongoDB Setup

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# macOS: brew install mongodb-community
# Windows: Download from mongodb.com
mongod
```

**Option B: MongoDB Atlas (Recommended)**
```
# Get connection string from mongodb.com
# Add to server/.env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/nptel-hub
```

## 📖 API Documentation

### Authentication Endpoints
```
POST   /api/auth/register           - Register new user
POST   /api/auth/login              - Login
POST   /api/auth/verify-email       - Verify email
POST   /api/auth/forgot-password    - Request reset
POST   /api/auth/reset-password     - Reset password
GET    /api/auth/me                 - Get current user (protected)
PUT    /api/auth/profile            - Update profile (protected)
POST   /api/auth/change-password    - Change password (protected)
POST   /api/auth/logout             - Logout
```

### Course Navigation
```
GET    /api/courses/subjects                    - All subjects
GET    /api/courses/subjects/:slug              - Subject by slug
GET    /api/courses/courses/subject/:subjectId  - Courses in subject
GET    /api/courses/courses/code/:code          - Course by code
```

### Week & Content
```
GET    /api/weeks/year-instances/:courseId      - Year instances
GET    /api/weeks/year-instances/:id            - Specific instance
GET    /api/weeks/weeks/:yearInstanceId         - Weeks in instance
GET    /api/weeks/week/:id                      - Specific week
GET    /api/weeks/week/:weekId/stats            - Week statistics
```

### Resources
```
GET    /api/resources/resources/:weekId         - List resources
GET    /api/resources/resource/:id              - Get resource
POST   /api/resources/resources                 - Create (protected)
PUT    /api/resources/resources/:id             - Update (protected)
DELETE /api/resources/resources/:id             - Delete (protected)
POST   /api/resources/resources/:id/upvote      - Upvote (protected)
POST   /api/resources/resources/:id/downvote    - Downvote (protected)
POST   /api/resources/resources/:id/comments    - Add comment (protected)
POST   /api/resources/resources/:id/report      - Report (protected)
```

## 🔌 Socket.io Chat Events

### Client → Server
```javascript
// Join a week's chat room
socket.emit('join-room', { roomId: 'CS101_2024_01', weekId, userId })

// Send message
socket.emit('send-message', { content: 'Hello!' })

// Thread reply
socket.emit('send-message', { content: 'Great point!', repliedTo: messageId })

// Edit message (owner only)
socket.emit('edit-message', { messageId, content: 'Updated...' })

// Delete message (owner/moderator only)
socket.emit('delete-message', { messageId })

// Add reaction
socket.emit('add-reaction', { messageId, emoji: '👍' })

// Report message
socket.emit('report-message', { messageId, reason: 'Spam' })

// Typing indicator
socket.emit('typing', { userName: 'John' })
socket.emit('stop-typing')

// Leave room
socket.emit('leave-room')
```

### Server → Client
```javascript
socket.on('message-history', messages)       // Initial 50 messages
socket.on('new-message', message)            // New message broadcast
socket.on('message-edited', {messageId, content})
socket.on('message-deleted', {messageId})
socket.on('reaction-added', {messageId, reactions})
socket.on('user-joined', {message})
socket.on('user-typing', {userName})
socket.on('user-disconnected', {message})
socket.on('error', {message})
```

## 🔐 Security Features

| Feature | Implementation |
|---------|-----------------|
| **Password Hashing** | Bcrypt (10 salt rounds) |
| **JWT Auth** | HttpOnly cookies + Bearer token fallback |
| **Rate Limiting** | Express-rate-limit (auth: 5/15min, chat: 30/min) |
| **Input Sanitization** | HTML entity encoding, XSS prevention |
| **CORS** | Restricted to frontend URL |
| **SQL Injection** | Mongoose (prevents NoSQL injection) |
| **CSRF** | Token validation in protected routes |

## 📁 Project Structure

```
nptel-hub/
├── server/
│   ├── src/
│   │   ├── models/           # Mongoose schemas (User, Course, Week, Message, Resource)
│   │   ├── routes/           # Express routes (auth, courses, weeks, resources)
│   │   ├── controllers/       # Business logic
│   │   ├── middleware/        # Auth, rate limiting, error handling
│   │   ├── sockets/          # Socket.io chat logic
│   │   └── utils/            # JWT, email, validation, errors
│   ├── server.js            # Express + Socket.io setup
│   ├── package.json
│   └── .env.example
│
├── client/
│   ├── src/
│   │   ├── app/              # Next.js pages (login, register, dashboard)
│   │   ├── components/       # React components
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ChatRoom.jsx
│   │   │   ├── ResourceVault.jsx
│   │   │   └── MainLayout.jsx
│   │   ├── lib/
│   │   │   ├── api.js       # API client wrapper
│   │   │   └── socket.js    # Socket.io utilities
│   │   ├── store/
│   │   │   └── useStore.js  # Zustand global state
│   │   └── app/globals.css  # Tailwind CSS
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   └── .env.local.example
│
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── docker-compose.yml
```

## 🐳 Docker Deployment

```bash
docker-compose up -d

# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# MongoDB: localhost:27017
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  backend:
    build: ./server
    ports:
      - "5000:5000"
    env_file: ./server/.env
    depends_on:
      - mongodb

  frontend:
    build: ./client
    ports:
      - "3000:3000"

volumes:
  mongo_data:
```

## 📝 Environment Variables

### Backend (.env)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nptel-hub
JWT_SECRET=your_super_secret_key
FRONTEND_URL=http://localhost:3000
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=gmail_app_password
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## 🎓 Example Usage Flow

1. **User Registration**
   ```
   POST /api/auth/register
   → Email verification sent
   → JWT token generated
   → Redirected to dashboard
   ```

2. **Navigate to Week**
   ```
   Subject: "Mathematics"
   → Course: "Linear Algebra (MA103)"
   → Year: "2024 Jan-Apr"
   → Week: "Week 3: Eigenvalues"
   ```

3. **Access Week Content**
   ```
   [Video Lecture] [Lecture Notes]
   
   TAB 1: PYQs (Past Year Questions)
     Q1: 2021 - "Prove the characteristic polynomial..."
     Q2: 2020 - "Find eigenvalues of..."
   
   TAB 2: Real-time Chat (Socket.io)
     [Message flow with threading]
   
   TAB 3: Community Vault
     📝 Notes by user (50 upvotes)
     🔗 External resources
     💡 Solution sketches
   ```

4. **Collaborative Features**
   - Post/edit/delete messages in real-time
   - Reply to specific messages (threading)
   - React with emojis
   - Upload and vote on resources
   - Report inappropriate content

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

MIT License - See [LICENSE](LICENSE) file

## ⚠️ Disclaimer

**NPTEL Hub** is an independent community project and is not affiliated with or endorsed by NPTEL (National Programme on Technology Enhanced Learning), IIT (Indian Institute of Technology), MHRD (Ministry of Human Resource Development), or the Government of India.

All course content belongs to the original creators and respective institutions. This platform is built to facilitate learning and collaboration only. Users are responsible for ensuring they comply with copyright and fair use policies.

## 🔗 Resources

- [NPTEL Official](https://nptel.ac.in/)
- [Next.js Docs](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Socket.io Guide](https://socket.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/)

## 💬 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing discussions
- Read documentation carefully

---

**Built with ❤️ for NPTEL learners worldwide**
