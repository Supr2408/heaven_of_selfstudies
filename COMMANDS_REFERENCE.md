# NPTEL Hub - Commands Reference Card

Quick reference for all common commands needed to work with NPTEL Hub.

---

## 🚀 Starting the Application

### Using Batch Files (Recommended - Windows)

```powershell
# Terminal 1 - Backend
.\start-backend.bat

# Terminal 2 - Frontend  
.\start-frontend.bat

# Terminal 3 - Seed Database (optional)
cd server
npm run seed
```

### Manual Commands

```powershell
# Terminal 1 - Backend
cd server
npm install
npm run dev

# Terminal 2 - Frontend
cd client
npm install
npm run dev
```

---

## 🔍 Verification Commands

### Health Check

```powershell
# Check backend is running
(Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing).Content

# Expected output:
# {"success":true,"message":"Server is running"}
```

### API Endpoints Test

```powershell
# Get all subjects
(Invoke-WebRequest -Uri "http://localhost:5000/api/courses/subjects" -UseBasicParsing).Content

# Get year instances
(Invoke-WebRequest -Uri "http://localhost:5000/api/year-instances" -UseBasicParsing).Content

# Get weeks for a year instance
# Replace {yearInstanceId} with actual ID
(Invoke-WebRequest -Uri "http://localhost:5000/api/year-instances/{yearInstanceId}/weeks" -UseBasicParsing).Content
```

### Port Status Check

```powershell
# Check if port 5000 is in use
netstat -ano | findstr ":5000"

# Check if port 3000 is in use
netstat -ano | findstr ":3000"

# If ports are in use, kill the process (replace {PID} with actual process ID)
taskkill /PID {PID} /F
```

---

## 🛠️ Installation & Setup

### Install Dependencies

```powershell
# Backend dependencies
cd server
npm install

# Frontend dependencies
cd client
npm install
```

### Install Missing Packages

```powershell
# Backend
cd server
npm install axios cheerio

# Frontend
cd client
npm install zustand socket.io-client lucide-react
```

### Update Package Lock

```powershell
# If package-lock.json is outdated
cd server
npm ci

cd client
npm ci
```

---

## 📊 Database Commands

### Seed Database

```powershell
cd server
npm run seed

# This creates:
# - Cloud Computing subject
# - 3 Year instances (2024, 2025, 2026)
# - 10 weeks for each year with materials
```

### Connect to MongoDB

```powershell
# If using local MongoDB
mongosh

# Commands:
use nptel-hub
db.subjects.find()
db.courses.find()
db.weeks.find()
```

---

## 🧹 Cleaning Up

### Clear Frontend Cache

```powershell
cd client
rm -r .next
npm run dev
```

### Clear Node Modules (Clean Install)

```powershell
# Backend
cd server
rm -r node_modules package-lock.json
npm install

# Frontend
cd client
rm -r node_modules package-lock.json
npm install
```

### Kill Processes Using Ports

```powershell
# Kill all processes on port 5000
taskkill /F /IM node.exe

# Or specific PID
taskkill /PID {PID} /F
```

---

## 📝 Logging & Debugging

### View Backend Logs

```powershell
# Backend logs are shown in terminal where npm run dev is running
# Watch for:
# - "Server running on port 5000"
# - "MongoDB connected"
# - API request logs
# - Error messages in red
```

### View Frontend Logs

```
1. Open browser
2. Press F12 (DevTools)
3. Click "Console" tab
4. Check for red error messages
5. Check "Network" tab for failed API calls
```

### Enable Debug Mode (Backend)

```powershell
cd server
set DEBUG=*
npm run dev
```

---

## 🌐 Environment Configuration

### Check Environment Variables

```powershell
# Backend
cd server
type .env

# Frontend  
cd client
cat .env.local
```

### Set Environment Variables (Windows)

```powershell
# Temporary (current session only)
$env:NODE_ENV = "development"
$env:PORT = "5000"

# Check if set
echo $env:NODE_ENV
echo $env:PORT

# For permanent, edit .env files
```

---

## 📦 Version Checks

### Check Node.js Version

```powershell
node --version
# Expected: v20.x.x or higher
```

### Check npm Version

```powershell
npm --version
# Expected: 10.x.x or higher
```

### Check Package Versions

```powershell
# Backend
cd server
npm list --depth=0

# Frontend
cd client
npm list --depth=0
```

---

## 🔄 Updating Dependencies

### Update All Packages

```powershell
cd server
npm update

cd client
npm update
```

### Update Specific Package

```powershell
cd server
npm install axios@latest

cd client
npm install next@latest
```

### Check for Vulnerabilities

```powershell
cd server
npm audit

cd client
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## 🐳 Docker Commands (Optional)

### Build Docker Images

```powershell
# Build backend image
docker build -t nptel-hub-backend ./server

# Build frontend image
docker build -t nptel-hub-frontend ./client
```

### Run with Docker Compose

```powershell
docker-compose up

# Detached mode (background)
docker-compose up -d

# Stop services
docker-compose down
```

---

## 📱 Testing Commands

### Frontend Testing

```powershell
cd client

# Run tests (if configured)
npm test

# Build for production
npm run build

# Check build size
npm run analyze
```

### Backend Testing

```powershell
cd server

# Run tests (if configured)
npm test

# Lint code
npm run lint
```

---

## 📤 Deployment Commands

### Build Frontend for Production

```powershell
cd client
npm run build

# Test production build locally
npm run start
```

### Prepare Backend for Deployment

```powershell
cd server

# Install production dependencies only
npm ci --production

# Build if needed
npm run build
```

---

## 🔐 Git Commands (If Using Version Control)

### Clone Repository

```powershell
git clone <repository-url>
cd nptel-hub
```

### Pull Latest Changes

```powershell
git pull origin main
npm install
npm run dev
```

### Check Git Status

```powershell
git status
```

### Commit Changes

```powershell
git add .
git commit -m "Your message"
git push origin main
```

---

## 🎯 Quick Troubleshooting Commands

### Restart Fresh

```powershell
# Terminal 1
taskkill /F /IM node.exe

# Then start fresh
cd server
npm run dev
```

### Force Clear Everything

```powershell
# Backend
cd server
rm -r node_modules .env package-lock.json
npm install
npm run dev

# Frontend
cd client
rm -r node_modules .next .env.local package-lock.json
npm install
npm run dev
```

### Test Specific API

```powershell
# Test authentication
(Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method POST -Body @{email="test@example.com";password="test"} -ContentType "application/json" -UseBasicParsing).Content
```

---

## 📚 Useful Information

### Default URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000/api`
- Health Check: `http://localhost:5000/api/health`
- Database UI (MongoDB Atlas): `https://cloud.mongodb.com`

### Common Ports

- Backend: `5000`
- Frontend: `3000`
- Local MongoDB: `27017`

### Directory Structure

```
nptel-hub/
├── client/              # Frontend (Next.js)
├── server/              # Backend (Express)
├── docker-compose.yml   # Docker configuration
├── TROUBLESHOOTING_GUIDE.md
└── COMMANDS_REFERENCE.md (this file)
```

---

## 💡 Tips & Tricks

### Fast Development Workflow

```powershell
# Terminal 1
cd server
npm run dev

# Terminal 2  
cd client
npm run dev

# Terminal 3 (for running commands)
# Keep this for npm commands, git, etc.
```

### Monitor Port Activity

```powershell
# Watch port 5000 continuously
while ($true) { 
    netstat -ano | findstr ":5000"
    Start-Sleep 5
}
```

### View System Resources

```powershell
# Open Task Manager
taskmgr

# Or check CPU/Memory
Get-Process node | Select-Object ProcessName, CPU, Memory
```

---

## 🆘 When Nothing Works

```powershell
# Nuclear option - kill all Node processes
taskkill /F /IM node.exe

# Clear everything
cd server
rm -r node_modules .env package-lock.json
npm install

cd client
rm -r node_modules .next .env.local package-lock.json
npm install

# Start fresh
cd server
npm run dev

# In new terminal
cd client
npm run dev
```

---

## 📞 Quick Help Commands

```powershell
# npm help
npm help

# npm help install
npm help install

# npm help scripts
npm help scripts

# Node version info
node -p process.versions
```

---

**Pro Tip**: Save this file and reference it whenever you need to run commands. Keep two terminal windows open: one for npm commands and one for git/system commands.

**Last Updated**: March 30, 2026
