# Project Summary

This document summarizes the current implemented state of the NPTEL Hub repo.

## Product snapshot

NPTEL Hub is a structured learning platform for NPTEL content with:

- subject and course browsing
- batch/year and week navigation
- week-wise materials
- week discussion boards
- a common discussion page
- temporary quick chat
- guest browsing plus Google-gated write actions

## Frontend

- Next.js 16 App Router
- Tailwind CSS
- Zustand for shared client state
- Socket.io client
- react-pdf based study viewer

Important frontend areas:

- `client/src/app/dashboard`
- `client/src/app/dashboard/week/page.jsx`
- `client/src/app/login/page.jsx`
- `client/src/components/MainLayout.jsx`
- `client/src/components/WeekDetail.jsx`
- `client/src/components/WeekDiscussions.jsx`
- `client/src/components/ChatRoom.jsx`
- `client/src/app/assignments/page.jsx`

## Backend

- Express
- MongoDB + Mongoose
- Socket.io
- Axios-based scraping/proxy helpers

Important backend areas:

- `server/src/controllers/authController.js`
- `server/src/controllers/yearInstanceController.js`
- `server/src/controllers/resourceController.js`
- `server/src/controllers/commonDiscussionController.js`
- `server/src/sockets/chat.js`
- `server/src/routes/*.js`

## Current authentication model

- automatic guest bootstrap on the client
- browser-specific guest identity
- Google sign-in for actual write-enabled participation
- development-only demo login fallback

Legacy email/password endpoints remain present but are intentionally blocked by the current auth controller behavior.

## Current participation rules

### Guest/demo

- can browse the full platform
- can read discussions
- can read quick chat
- cannot post/reply in discussion boards
- cannot send quick chat messages
- cannot contribute missing files

### Google-authenticated users

- can post and reply in week discussions
- can post and reply in the common discussion page
- can participate in quick chat
- can set a public username
- can upload community PDFs for review

## Public username rules

- Google users may choose a public anonymous username
- once chosen, it becomes fixed
- the user may roll back to the original Google name
- after rollback, they cannot choose a new anonymous handle again

## Current discussion architecture

### Week discussion board

Stored via the `Resource` model with discussion-style entries.

### Common discussion page

Stored via the `CommonDiscussionPost` model and mounted at:

- `GET /api/common-discussion/posts`
- `POST /api/common-discussion/posts`
- `POST /api/common-discussion/posts/:id/replies`

### Quick chat

- Socket.io powered
- room-based by course/year/week
- temporary message retention
- write access requires Google auth
- presence signals also drive the navbar active-user count

## Materials and PDF viewer

- week materials are served from the `Week` model
- local uploaded PDFs are served through the backend
- externally hosted PDFs are proxied when possible
- the study viewer is based on `react-pdf`

## Navbar and layout

Main layout currently includes:

- sidebar navigation
- user avatar dropdown
- one-time anonymous username controls
- logout
- centered active-user count
- updated multi-column footer

## Environment variables in active use

### Frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### Backend

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `DEMO_USER_EMAIL`
- `DEMO_USER_NAME`

## Recommended pre-push checks

```bash
cd client
npm run build

cd ../server
node -e "require('./src/controllers/authController'); console.log('auth ok')"
node -e "require('./src/controllers/yearInstanceController'); console.log('weeks ok')"
node -e "require('./src/sockets/chat'); console.log('socket ok')"
```
