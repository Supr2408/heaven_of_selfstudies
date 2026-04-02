# Setup Guide

This guide describes the current setup for the repo as it exists now.

## Stack

- Frontend: Next.js App Router, Tailwind CSS, Zustand, Socket.io client, react-pdf
- Backend: Express, MongoDB, Mongoose, Socket.io
- Auth: guest bootstrap, Google sign-in, development demo login

## Prerequisites

- Node.js 18 or newer recommended
- npm 9 or newer recommended
- MongoDB local instance or MongoDB Atlas
- A Google OAuth client ID if you want real Google sign-in locally

## Repository layout

```text
nptel-hub/
├── client/
├── server/
├── README.md
├── QUICK_START.md
└── SETUP.md
```

## Backend setup

### 1. Install packages

```bash
cd server
npm install
```

### 2. Create `server/.env`

Copy `server/.env.example` to `server/.env`.

Minimum recommended values:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nptel-hub
JWT_SECRET=replace_this_with_a_long_random_secret
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Optional local demo values:

```env
DEMO_USER_EMAIL=demo@nptelhub.com
DEMO_USER_NAME=Demo Learner
```

### 3. Start the backend

```bash
npm run dev
```

## Frontend setup

### 1. Install packages

```bash
cd client
npm install
```

### 2. Create `client/.env.local`

Copy `client/.env.local.example` to `client/.env.local`.

Set:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### 3. Start the frontend

```bash
npm run dev
```

## Google sign-in setup

Create a Google OAuth web client and use the same client ID in:

- `client/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `server/.env` as `GOOGLE_CLIENT_ID`

For local development, make sure your Google OAuth client allows:

- `http://localhost:3000`

## How the app behaves on startup

When the frontend loads:

1. it checks for an existing local token
2. if none exists, it creates or restores a browser-specific guest session
3. the user can browse the platform immediately
4. Google sign-in is required for posting and quick chat write access

## Current discussion model

### Week discussion board

- everyone can read
- Google users can post and reply

### Common discussion page

- route: `/assignments`
- shared community-wide feed
- everyone can read
- Google users can post and reply

### Quick chat

- guests can open and read it
- Google users can send messages
- chat content is temporary

## Material uploads

- the week materials section can show official/extracted PDFs
- if a week is missing a PDF, Google users can upload a community PDF for admin review
- guest/demo users see the locked contribution state in the UI

## Anonymous public username

Google users may lock in a public username used in discussions/chat.

Rules:

- once saved, it becomes fixed for that account
- the user may roll back to the original Google name
- after rollback, they cannot choose a new anonymous alias again

## Useful commands

### Backend

```bash
cd server
npm run dev
npm start
```

### Frontend

```bash
cd client
npm run dev
npm run build
npm run lint
```

## Recommended validation before pushing

```bash
cd client
npm run build
```

Optional backend sanity checks:

```bash
cd ../server
node -e "require('./src/controllers/authController'); console.log('auth ok')"
node -e "require('./src/controllers/yearInstanceController'); console.log('weeks ok')"
node -e "require('./src/sockets/chat'); console.log('socket ok')"
```

## Troubleshooting notes

### Login button missing

Usually means the Google client ID is missing on the frontend.

### Google button appears only after reload

Make sure you restarted the frontend after env changes.

### PDF endpoint returns errors

Check:

- backend is running
- the target file still exists upstream
- the backend proxy changes are active after restart

### Posting is blocked for guest/demo

That is expected in the current product rules.

## Suggested reading order

1. [README.md](README.md)
2. [QUICK_START.md](QUICK_START.md)
3. [CONTRIBUTING.md](CONTRIBUTING.md)
