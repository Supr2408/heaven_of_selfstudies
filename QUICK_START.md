# Quick Start

This is the fastest path to run the current NPTEL Hub app locally.

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB local or MongoDB Atlas

## 1. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

## 2. Create env files

```bash
cd server
cp .env.example .env

cd ../client
cp .env.local.example .env.local
```

If you are on Windows without `cp`, copy the files manually.

## 3. Fill the required values

### `server/.env`

Required:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Optional:

```env
DEMO_USER_EMAIL=demo@nptelhub.com
DEMO_USER_NAME=Demo Learner
```

### `client/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

## 4. Run the backend

```bash
cd server
npm run dev
```

Expected:

- server on `http://localhost:5000`
- MongoDB connected

## 5. Run the frontend

```bash
cd client
npm run dev
```

Expected:

- app on `http://localhost:3000`

## 6. Open the app

Use:

- `http://localhost:3000`

What happens now:

- a guest session is created automatically
- guest users can browse the platform immediately
- Google sign-in is needed for posting/replying/chat
- demo login is available locally as a fallback if enabled by environment and backend mode

## 7. Recommended smoke test

### Backend health

```bash
curl http://localhost:5000/api/health
```

### Frontend build

```bash
cd client
npm run build
```

## Common first-time checks

- `Google button not visible`
  - confirm `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
  - restart the frontend after changing env

- `Google login fails`
  - confirm `GOOGLE_CLIENT_ID` matches the frontend client ID
  - confirm `http://localhost:3000` is an allowed origin in Google Cloud

- `Guest login exists but posting is blocked`
  - this is expected
  - guest/demo can browse and read, but write actions need Google sign-in

- `PDF material fails to load`
  - some externally hosted files can still depend on upstream availability
  - restart backend first if you changed proxy logic

## Main local routes

- `/dashboard`
- `/dashboard/week?weekId=...`
- `/assignments`
- `/login`

## Before pushing

Run:

```bash
cd client
npm run build
```

If you also want a quick backend sanity check:

```bash
cd ../server
node -e "require('./src/controllers/authController'); console.log('ok')"
```
