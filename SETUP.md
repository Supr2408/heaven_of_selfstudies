# NPTEL Hub - Complete Setup Guide

A comprehensive guide to get NPTEL Hub running locally on your machine.

## Prerequisites

### Required Software
- **Node.js** (≥18.0.0) - [Download](https://nodejs.org/)
- **MongoDB** (≥5.0) - [Download](https://www.mongodb.com/try/download/community)
- **npm** (≥9.0.0) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Code Editor** - VS Code recommended

### Optional but Recommended
- **Postman** - For API testing
- **MongoDB Compass** - GUI for MongoDB
- **Docker** - For containerized deployment

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/nptel-hub.git
cd nptel-hub
```

### 2. Backend Setup

#### 2.1 Navigate to Server Directory
```bash
cd server
```

#### 2.2 Install Dependencies
```bash
npm install
```

#### 2.3 Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
# Server
PORT=5000
NODE_ENV=development

# Database - Choose one option:

# Option A: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/nptel-hub

# Option B: MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nptel-hub

# JWT & Security
JWT_SECRET=your_super_secret_jwt_key_12345

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email Configuration (Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_16_digit_app_password

# AWS S3 (Optional)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET_NAME=your_bucket

# Firebase (Optional Alternative)
FIREBASE_PROJECT_ID=your_project
FIREBASE_PRIVATE_KEY=your_key
FIREBASE_CLIENT_EMAIL=your_email@project.iam.gserviceaccount.com
```

#### 2.4 Start Backend Server
```bash
npm run dev
```

Expected output:
```
Server running on port 5000
MongoDB connected
Socket.io initialized
```

**✅ Backend is ready at `http://localhost:5000`**

### 3. Frontend Setup

#### 3.1 Navigate to Client Directory
```bash
cd ../client
```

#### 3.2 Install Dependencies
```bash
npm install
```

#### 3.3 Configure Environment Variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

#### 3.4 Start Frontend Server
```bash
npm run dev
```

Expected output:
```
> ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

**✅ Frontend is ready at `http://localhost:3000`**

### 4. MongoDB Setup

#### Option A: Local MongoDB

**Windows:**
1. Download MongoDB Community Server
2. Run installer and follow setup wizard
3. MongoDB runs as service automatically
4. Default: `mongodb://localhost:27017`

**macOS:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

Verify:
```bash
mongosh localhost:27017
```

#### Option B: MongoDB Atlas (Cloud)

1. Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create free account
3. Create a new cluster
4. Get connection string
5. Add to `.env`:
   ```
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/nptel-hub
   ```

## Verification Checklist

- [ ] Backend running on `http://localhost:5000`
- [ ] Frontend running on `http://localhost:3000`
- [ ] MongoDB connected (check backend logs)
- [ ] Socket.io initialized (check backend logs)
- [ ] Can access frontend homepage
- [ ] API health check: `curl http://localhost:5000/api/health`

## Testing The Application

### 1. Create User Account

1. Navigate to `http://localhost:3000/register`
2. Fill in registration form
3. Submit
4. Check backend logs for email simulation (development mode)

### 2. Login

1. Go to `http://localhost:3000/login`
2. Use credentials from registration
3. Should redirect to dashboard

### 3. Test API with Postman

#### Import Collection
1. Download provided `nptel-hub-postman.json`
2. Open Postman → Import → Select JSON file

#### Test Endpoints
```bash
# Health Check
GET http://localhost:5000/api/health

# Get All Subjects
GET http://localhost:5000/api/courses/subjects

# Register User
POST http://localhost:5000/api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}

# Login
POST http://localhost:5000/api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

## Database Seeding (Optional)

Create initial data:

```bash
cd server
node scripts/seed.js
```

This creates sample subjects, courses, and years.

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- For local: `mongodb://localhost:27017/nptel-hub`
- For Atlas: Verify IP whitelist

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```

**Solution:**
```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=5001
```

### Socket.io Connection Failed
```
WebSocket connection failed
```

**Solution:**
- Check `NEXT_PUBLIC_SOCKET_URL` in `.env.local`
- Ensure backend is running
- Clear browser cache

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
- Verify `FRONTEND_URL` in backend `.env`
- Check CORS configuration in `server.js`
- Ensure credentials: include

### Email Not Sending
```
Error: Auth failed
```

**Solution:**
- Use Gmail app-specific password (not regular password)
- Enable 2-factor authentication on Gmail
- Check ESP restrictions

## Development Workflow

### Running Both Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

### Useful Commands

```bash
# Backend
cd server

npm run dev              # Development mode with auto-reload
npm start               # Production mode
npm run seed            # Populate database

# Frontend
cd client

npm run dev             # Development mode
npm run build           # Production build
npm run lint            # Check code style
```

## Building for Production

### Backend
```bash
cd server
npm run build  # If applicable
NODE_ENV=production npm start
```

### Frontend
```bash
cd client
npm run build
npm start
```

### Docker (Recommended)
```bash
docker-compose up -d
```

Ensure `.env` files are properly set for production URLs.

## Environment Configuration by Stage

### Development
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/nptel-hub
```

### Production
```env
NODE_ENV=production
FRONTEND_URL=https://nptel-hub.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/nptel-hub
JWT_SECRET=very_long_random_secret_key
```

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Use environment variables (never hardcode secrets)
- [ ] Enable HTTPS in production
- [ ] Setup rate limiting
- [ ] Enable CORS only for your domain
- [ ] Use MongoDB Atlas for production (not local)
- [ ] Rotate passwords regularly
- [ ] Setup monitoring and logging

## Next Steps

1. **Customize Data** - Add your subjects/courses
2. **Style Adjustments** - Modify Tailwind configuration
3. **Feature Enhancement** - Add new components
4. **Deploy** - Use Docker or cloud platforms
5. **Monitoring** - Setup error tracking with Sentry

## Support & Resources

- **Documentation**: See README.md
- **API Docs**: See server/.env.example
- **Issues**: Open GitHub issue
- **Contributing**: See CONTRIBUTING.md

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [Socket.io Server API](https://socket.io/docs/v4/server-api/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

**You're all set! 🎉**

For issues or questions, refer to the main README or open an issue on GitHub.
