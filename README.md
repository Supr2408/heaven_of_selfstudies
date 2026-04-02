# NPTEL Hub

NPTEL Hub is a community-driven learning platform for navigating NPTEL subjects, courses, batches, and weeks, while giving learners a shared space for discussions, notes, and short-lived live chat.

This codebase currently uses:
- `Next.js` App Router on the frontend
- `Express + MongoDB + Socket.io` on the backend
- `Tailwind CSS`, `Zustand`, `Lucide React`, and `react-pdf`

## What the app does

- Browse `Subject -> Course -> Year/Batch -> Week`
- Open week materials in a study-focused PDF viewer
- Read and contribute to week-wise community discussions
- Use a simple common discussion page for broader community posts
- Join quick chat for temporary live conversation
- Upload missing PDFs for admin review

## Current access model

- The app auto-creates a browser-specific guest session on first load
- Guests can browse subjects, courses, weeks, materials, and discussions
- Guests can read quick chat, but cannot send messages
- Google sign-in unlocks posting, replying, and quick chat participation
- A development-only demo login is available locally as a fallback

## Current auth behavior

- `Google sign-in` is the real write-enabled login flow
- `Guest mode` is automatic and browser-specific
- `Demo login` is for local development only
- Legacy email/password routes still exist in the API surface, but they intentionally reject requests in the current product mode

## Community behavior

- Week discussion board:
  - visible to everyone
  - posting/replying requires Google sign-in
- Quick chat:
  - visible to everyone
  - sending requires Google sign-in
  - links, phone numbers, emails, and contact/group-promotion are blocked
  - messages are temporary
- Common discussion page:
  - shared feed for simple community-wide posts and replies
  - read for all, write for Google users

## Anonymous public username

Google users can choose a public username for discussions and chat.

- it is shown publicly instead of the Google profile name
- once saved, that anonymous public username becomes fixed
- the user can roll back to the original Google name
- after rollback, they cannot choose a different anonymous username again

## Live presence

The top navbar shows a live `Active users` count powered by the existing Socket.io connection.

## Project structure

```text
nptel-hub/
├── client/                     # Next.js frontend
│   ├── src/app/                # App Router pages
│   ├── src/components/         # UI components
│   ├── src/lib/                # API + socket helpers
│   └── src/store/              # Zustand store
├── server/                     # Express backend
│   ├── src/controllers/        # Route logic
│   ├── src/models/             # Mongoose models
│   ├── src/routes/             # API routes
│   ├── src/sockets/            # Socket.io handlers
│   └── src/utils/              # Shared server utilities
├── README.md
├── QUICK_START.md
├── SETUP.md
├── CONTRIBUTING.md
└── DOCUMENTATION_INDEX.md
```

## Environment variables

### Frontend: `client/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Backend: `server/.env`

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nptel-hub
JWT_SECRET=replace_this_with_a_long_random_secret
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
DEMO_USER_EMAIL=demo@nptelhub.com
DEMO_USER_NAME=Demo Learner
```

## Local development

### 1. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Configure env files

Copy:

- `server/.env.example` -> `server/.env`
- `client/.env.local.example` -> `client/.env.local`

Then fill in:

- MongoDB connection string
- JWT secret
- frontend URL
- Google OAuth client ID for both frontend and backend

### 3. Run the backend

```bash
cd server
npm run dev
```

Backend runs at `http://localhost:5000`.

### 4. Run the frontend

```bash
cd client
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Useful routes

- `/dashboard` - main landing page after auth/bootstrap
- `/dashboard/week?weekId=...` - live week experience
- `/assignments` - common discussion page
- `/login` - sign in / demo fallback page

## Main API routes

### Auth

- `POST /api/auth/guest`
- `POST /api/auth/google`
- `POST /api/auth/dev-login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

### Courses and weeks

- `GET /api/courses/subjects`
- `GET /api/courses/subjects/:slug`
- `GET /api/weeks/year-instances`
- `GET /api/weeks/year-instances/course/:courseId`
- `GET /api/weeks/year-instance/:id`
- `GET /api/weeks/weeks/:yearInstanceId`
- `GET /api/weeks/week/:id`
- `GET /api/weeks/week/:weekId/materials`
- `GET /api/weeks/week/:weekId/materials/:materialIndex/pdf`

### Week discussion/resources

- `GET /api/resources/resources/:weekId`
- `GET /api/resources/resource/:id`
- `GET /api/resources/trending/:weekId`
- `POST /api/resources/resources`
- `POST /api/resources/resources/upload`
- `POST /api/resources/resources/:id/comments`

### Common discussion

- `GET /api/common-discussion/posts`
- `POST /api/common-discussion/posts`
- `POST /api/common-discussion/posts/:id/replies`

## Verification

Useful checks before pushing:

```bash
cd client
npm run build

cd ../server
node -e "require('./src/controllers/authController'); console.log('ok')"
node -e "require('./src/controllers/yearInstanceController'); console.log('ok')"
node -e "require('./src/sockets/chat'); console.log('ok')"
```

## Documentation

- [QUICK_START.md](QUICK_START.md)
- [SETUP.md](SETUP.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

## Disclaimer

NPTEL Hub is an independent community project. It is not affiliated with NPTEL, IIT, or any government body. Original content belongs to the original creators.
