# NPTEL Hub - Architecture & Technical Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js)                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        React Components (Sidebar, Chat, Vault)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Zustand State Management Store                 │  │
│  │  (Auth, Navigation, Messages, Resources)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Client (Fetch) + Socket.io (Real-time)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
                    HTTP/HTTPS + WebSocket
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express.js)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Routes (Auth, Courses, Weeks, Resources)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Controllers (Business Logic)                           │  │
│  │  • authController: Registration, Login, JWT            │  │
│  │  • courseController: Subject/Course CRUD               │  │
│  │  • yearInstanceController: Year/Week management        │  │
│  │  • resourceController: Resource CRUD & Voting          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Middleware & Utils                                     │  │
│  │  • auth.js (JWT validation)                             │  │
│  │  • rateLimiter.js (Attack prevention)                   │  │
│  │  • validation.js (XSS prevention)                       │  │
│  │  • errorHandler.js (Consistent errors)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Socket.io Chat Handler                       │  │
│  │  • Room management (courseId_year_weekNumber)          │  │
│  │  • Message CRUD with threading                         │  │
│  │  • Typing indicators & reactions                       │  │
│  │  • User reporting system                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓ ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Mongoose Models (Schema Validation)                    │  │
│  │  • User, Subject, Course, YearInstance                 │  │
│  │  • Week, Message, Resource                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
                        MongoDB (NoSQL)
```

## Data Flow: User Interaction to Database

### 1. Authentication Flow

```
User Registration/Login
        ↓
Frontend (POST /api/auth/register)
        ↓
auth.js Middleware (Rate Ltd: 5/15min)
        ↓
authController.register()
        ↓
Password Hash (Bcrypt 10 rounds)
        ↓
User Model Document Created
        ↓
JWT Token Generated
        ↓
Response + HttpOnly Cookie
        ↓
Frontend Stores in localStorage
```

### 2. Real-time Chat Flow

```
User Types Message
        ↓
Frontend emits 'send-message' Socket event
        ↓
Backend chat.js receives event
        ↓
Message sanitization (Remove XSS)
        ↓
Message stored in MongoDB (Message model)
        ↓
Socket broadcast to room (courseId_year_weekNumber)
        ↓
All subscribed clients receive 'new-message'
        ↓
Frontend updates Zustand store
        ↓
UI re-renders with new message
```

### 3. Resource Upload Flow

```
User Creates Resource
        ↓
Frontend (POST /api/resources/resources)
        ↓
protectRoute Middleware (JWT validation)
        ↓
uploadLimiter Middleware (10/hour)
        ↓
resourceController.createResource()
        ↓
Input sanitization
        ↓
Resource document saved (with userId, weekId, upvotes: [])
        ↓
Response with populated user data
        ↓
Frontend adds to store
        ↓
UI displays in Community Vault grid
```

## Database Schema Relationships

```
Subject (1)
    ↓
    └─ (Many) Course
        ↓
        └─ (Many) YearInstance
            ↓
            ├─ (Many) Week
            │   ├─ (Many) Message
            │   │   └─ repliedTo (Self-reference: Message._id)
            │   └─ (Many) Resource
            │       ├─ upvotes [User._id]
            │       ├─ downvotes [User._id]
            │       └─ reports [{ userId, reason, reportedAt }]

User
    ├─ (Many messages) Message
    ├─ (Many resources) Resource
    └─ (Saved) Resource (In savedResources array)
```

## Authentication & Authorization

### JWT Token Structure

```javascript
Payload: {
  userId: ObjectId,
  iat: 1234567890,
  exp: 1234567890 + 7 days
}

Signature: HS256(header + payload, JWT_SECRET)
```

### Authorization Levels

```
Public Access:
  • GET /api/courses/subjects
  • GET /api/weeks/weeks/:yearInstanceId
  • GET /api/resources/resources/:weekId

Authenticated (protectRoute):
  • POST /api/resources/resources
  • POST /api/auth/me
  • PUT /api/auth/profile
  • Socket.io events (join-room, send-message)

Admin Only (authorize('admin')):
  • POST /api/courses/subjects
  • POST /api/weeks/year-instances
  • PUT /api/courses/:id
``` 

## Socket.io Room Architecture

### Room Naming Convention
```
Format: {courseId}_{year}_{weekNumber}
Example: CS101_2024_01

Why this format?
• Unique per course offering
• Prevents message mix-up across years
• Supports multiple weeks per semester
• Easily identifiable
```

### Room Lifecycle

```
Room Created:     When first user joins
                  → Socket.emit('join-room')
                  → Load last 50 messages

Message Added:    Real time to all in room
                  → Socket.emit('send-message')
                  → Broadcast to room

Room Destroyed:   When last user leaves
                  → Socket.emit('leave-room')
                  → Room cleaned up by Socket.io
```

### Message Threading

```
Parent Message: "What is eigenvalue?"
        ↓
Reply: { content: "...", repliedTo: parentMessageId }
        ↓
Display:
┌─ Parent Message
│  └─ Quoted reply indicator
│     └─ Reply content
```

## Security Layers

### 1. Input Validation & Sanitization

```javascript
// Before storage:
1. Type checking (String, Number, etc.)
2. Length limits (maxlength in schema)
3. Regex validation (emails, URLs)
4. HTML entity encoding (& → &amp;, < → &lt;)
5. Remove script tags
6. Trim whitespace
```

### 2. Authentication & Authorization

```javascript
1. JWT in HttpOnly cookies (prevents XSS)
2. Bearer token fallback (Authorization header)
3. protectRoute middleware (on all POST/PUT/DELETE)
4. Role-based authorization (admin checks)
```

### 3. Rate Limiting

```javascript
authLimiter:    5 attempts per 15 minutes (login/register)
chatLimiter:    30 messages per 1 minute
uploadLimiter:  10 uploads per 1 hour
generalLimiter: 100 requests per 15 minutes (default)
```

### 4. Database Security

```javascript
// Mongoose Level:
1. Schema validation (required fields, types)
2. Unique indices (prevent duplicates)
3. Compound indices (prevent unwanted combinations)
4. Default projection (exclude password, tokens)

// Application Level:
1. User input is parameterized (no string concat)
2. Access control (only user can modify own resources)
3. Soft deletes (messages marked deleted, not removed)
```

## Performance Optimizations

### 1. Database Indexes

```javascript
// Subject
subject_schema.index({ slug: 1 })

// Course
course_schema.index({ subjectId: 1, code: 1 })

// Week
week_schema.index({ yearInstanceId: 1, weekNumber: 1 }, { unique: true })

// Message (Critical for Room Performance)
message_schema.index({ weekId: 1, timestamp: -1 })

// Resource
resource_schema.index({ weekId: 1, createdAt: -1 })
resource_schema.index({ type: 1 })
```

### 2. Query Pagination

```javascript
// Get resources with limit
GET /api/resources/resources/:weekId?page=1&limit=10
// Returns pages for infinite scroll

// Message history
Last 50 messages on room join (not all)
```

### 3. Caching Considerations (Future)

```javascript
// Could cache with Redis:
- Subject list (rarely changes)
- Course list (static per subject)
- Popular resources (sort by upvotes)
- User profile data (with expiry)
```

## Error Handling Strategy

```
User Makes Request
        ↓
Validation Fails → AppError(400)
        ↓
Auth Fails → AppError(401)
        ↓
Permission Denied → AppError(403)
        ↓
Resource Not Found → AppError(404)
        ↓
Duplicate Entry → AppError(409)
        ↓
Server Error → AppError(500)
        ↓
Response JSON:
{
  success: false,
  message: "User-friendly error message",
  stack: "[dev only]"
}
```

## Deployment Architecture

### Production Setup

```
User Request
        ↓
Firewall / WAF
        ↓
Load Balancer
        ├─ Instance 1 (Node.js + Express)
        ├─ Instance 2 (Node.js + Express)
        └─ Instance 3 (Node.js + Express)
        ↓
Cloud Database (MongoDB Atlas)
        ↓
CDN (Optional - for static assets)
```

### Environment Separation

```
Development:
- Local MongoDB
- console.log debugging
- CORS: localhost:3000
- No rate limiting

Staging:
- MongoDB Atlas
- Error logging
- CORS: staging domain
- Rate limiting enabled

Production:
- MongoDB Atlas (replicated)
- Sentry/logging service
- CORS: production domain only
- Rate limiting strict
- HTTPS enforced
- JWT_SECRET: strong random
```

## Monitoring & Logging

```javascript
// Server Health
GET /api/health
→ Returns: { success: true, message: "Server is running" }

// Logging Points:
1. Authentication: login, registration, token refresh
2. Real-time: socket connections/disconnections
3. Errors: caught exceptions with stack trace
4. Performance: slow queries (with indexes)
5. Security: failed auth, rate limit hits, reports
```

## Future Enhancements

1. **Media Support**: Upload PDFs, images (S3/Firebase)
2. **Advanced Search**: Full-text search for resources
3. **Notifications**: Real-time notifications for replies
4. **User Roles**: Moderators for each course
5. **Analytics**: Track student progress
6. **Badges**: Gamification elements
7. **Mobile App**: React Native version
8. **AI Features**: Smart recommendations

---

**Architecture designed for:**
- ✅ Scalability (horizontal scaling with load balancing)
- ✅ Security (multi-layer protection)
- ✅ Performance (optimized queries, caching)
- ✅ Maintainability (modular structure)
- ✅ Monitoring (logging & error tracking)
