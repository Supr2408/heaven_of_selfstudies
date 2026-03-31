# NPTEL Hub - Getting Started Guide

Welcome! This guide will help you get the NPTEL Hub project running on your machine.

---

## ⚡ Quick Start (2 minutes)

### 1. Start Backend
```powershell
cd server
npm run dev
```
Wait for: `✅ Server running on port 5000` and `✅ MongoDB connected`

### 2. Start Frontend (New Terminal)
```powershell
cd client
npm run dev
```
Wait for: `✅ Ready in XXXms`

### 3. Open Browser
```
http://localhost:3000
```

**Done!** You should see the NPTEL Hub dashboard.

---

## 📋 Requirements

- **Node.js**: v20.18.1 or higher
- **npm**: 10.x or higher  
- **MongoDB Atlas Account**: (cloud database)
- **Two Terminal Windows**: One for backend, one for frontend
- **Browser**: Chrome, Firefox, Safari, or Edge

---

## 🔧 Installation for First Time

### Step 1: Install Backend Dependencies
```powershell
cd server
npm install
```

### Step 2: Install Frontend Dependencies
```powershell
cd client
npm install
```

### Step 3: Configure Environment
Both `.env` files should already be configured. Verify:

**server/.env should have**:
```
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=your_jwt_secret_key
PORT=5000
NODE_ENV=development
```

**client/.env.local should have**:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### Step 4: Seed Database (Optional)
Populate with sample data:
```powershell
cd server
npm run seed
```

---

## 🎯 What You Should See

### Dashboard View
- ✅ Sidebar with "Cloud Computing" subject
- ✅ Course list when you expand subject
- ✅ Year instances (2024, 2025, 2026)
- ✅ Weeks organized by semester
- ✅ Materials organized by type

### Expected Data Structure
```
Cloud Computing
  └── 2024
      ├── Jan-Apr Semester
      │   ├── Week 1 (30 materials)
      │   ├── Week 2 (25 materials)
      │   └── ... (continuing)
      └── July-Oct Semester
          ├── Week 1 (28 materials)
          └── ... (continuing)
```

---

## 🐛 Troubleshooting

### "Failed to fetch" Error?
**Solution**: Backend might not be running
```powershell
# Verify backend is running
(Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing).Content

# If connection refused, start backend
cd server
npm run dev
```

### Port Already in Use?
**Solution**: Kill the process using the port
```powershell
# For port 5000
netstat -ano | findstr ":5000"
taskkill /PID <PID> /F

# For port 3000
netstat -ano | findstr ":3000"
taskkill /PID <PID> /F
```

### "Cannot find module" Error?
**Solution**: Reinstall dependencies
```powershell
cd server
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Still Having Issues?
**See**: [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md) for detailed solutions.

---

## 📚 Documentation Guide

| Document | Purpose | Read if... |
|----------|---------|-----------|
| [QUICK_START.md](QUICK_START.md) | 5-minute setup | You want fastest start |
| [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md) | Common problems & solutions | You encounter errors |
| [COMMANDS_REFERENCE.md](COMMANDS_REFERENCE.md) | All available commands | You need command reference |
| [MATERIAL_STRUCTURE_GUIDE.md](MATERIAL_STRUCTURE_GUIDE.md) | Material integration | You want architectural details |
| [PROJECT_VERIFICATION_REPORT.md](PROJECT_VERIFICATION_REPORT.md) | Testing & verification | You want test results |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture | You need system overview |
| [SETUP.md](SETUP.md) | Detailed setup | You need step-by-step instructions |

---

## 🎮 Using the Application

### Navigating the Dashboard

1. **Select a Subject**
   - Click on "Cloud Computing" in the sidebar
   - Expands to show available courses

2. **Choose a Year**
   - Click on year (e.g., "2024")
   - Shows semesters for that year

3. **Pick a Semester**
   - Click on semester (e.g., "Jan-Apr")
   - Shows weeks for that semester

4. **View Materials**
   - Click on a week (e.g., "Week 1")
   - See materials organized by type:
     - 📘 Lecture Notes (blue)
     - 📝 Assignments (purple)
     - ✅ Solutions (green)
     - 💻 Code Examples (orange)
     - 📄 Other Materials (gray)

### Downloading Materials
- Click on any material to download
- All materials are Google Drive links
- No authentication required

### Browsing Materials
- Use the Materials tab to view organized list
- Filter by material type if needed
- PYQs tab for past year questions (if available)

---

## 🔐 Authentication (Optional for Development)

### Default Test Account
```
Email: test@example.com
Password: test123
```

### Database Connection
The application connects to MongoDB Atlas automatically. No manual MongoDB setup required for local development.

---

## 🚀 Development Workflow

### Typical Dev Session

```powershell
# Terminal 1 - Backend
cd D:\heavens for self studies\nptel-hub\server
npm run dev

# Terminal 2 - Frontend
cd D:\heavens for self studies\nptel-hub\client
npm run dev

# Terminal 3 - For commands
cd D:\heavens for self studies\nptel-hub

# Keep this for npm commands, git, etc.
```

### Making Changes

**Backend Changes**:
- Edit files in `server/src/`
- Changes auto-reload (nodemon watching)
- Check terminal for any errors

**Frontend Changes**:
- Edit files in `client/src/`
- Next.js hot-reload automatically
- Check browser console for errors

---

## ✅ Verification Checklist

Run through these checks on first start:

- [ ] Backend starts without errors (`Server running on port 5000`)
- [ ] MongoDB connected successfully
- [ ] Frontend loads page without errors
- [ ] No "Failed to fetch" errors in browser console
- [ ] Sidebar shows "Cloud Computing" subject
- [ ] Can click to expand courses
- [ ] Can view weeks for courses
- [ ] Materials display with type icons

---

## 📞 Quick Help

### What if something breaks?

1. **Check the error message** - Read it carefully
2. **Search TROUBLESHOOTING_GUIDE.md** - Most common issues covered
3. **Kill and restart** - Terminal: `Ctrl+C`, then `npm run dev`
4. **Clear cache** - `rm -r .next` in client folder
5. **Restart system** - Last resort: restart computer, start fresh

### Common Terminal Commands

```powershell
# Check if backend is running
netstat -ano | findstr ":5000"

# Check if frontend is running
netstat -ano | findstr ":3000"

# Test backend health
(Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing).Content

# Kill a process (replace PID)
taskkill /PID 1234 /F

# View npm package versions
npm list --depth=0
```

---

## 🌐 Accessing Different Ports

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost:3000` | Main application |
| Backend API | `http://localhost:5000/api` | API endpoints |
| Health Check | `http://localhost:5000/api/health` | Backend status |

---

## 📦 Project Structure

```
nptel-hub/
├── client/                    # Next.js Frontend
│   ├── src/app/              # Pages and layouts
│   ├── src/components/       # React components
│   ├── src/lib/              # Utilities and API calls
│   └── package.json
├── server/                    # Express Backend
│   ├── src/models/           # MongoDB schemas
│   ├── src/controllers/      # Business logic
│   ├── src/routes/           # API endpoints
│   ├── src/utils/            # Utilities
│   └── package.json
├── docker-compose.yml        # Docker configuration
├── start-backend.bat         # Batch file for backend
├── start-frontend.bat        # Batch file for frontend
└── DOCUMENTATION/            # This folder's docs
```

---

## 🎓 Learning the Codebase

### Architecture Overview
- Hierarchical data: Subject → Year → Semester → Week → Materials
- Materials typed: lecture_note, assignment, solution, code, other
- API-driven frontend with real-time socket updates
- MongoDB for persistence, JWT for auth

### Key Technologies

**Backend**:
- Express.js - Web framework
- MongoDB - Database
- Socket.io - Real-time communication
- Mongoose - ODM

**Frontend**:
- Next.js - React framework
- Tailwind CSS - Styling
- Zustand - State management
- Socket.io-client - Real-time client

### Start Reading Here
1. [ARCHITECTURE.md](ARCHITECTURE.md) - System design
2. [MATERIAL_STRUCTURE_GUIDE.md](MATERIAL_STRUCTURE_GUIDE.md) - Data model
3. `server/src/models/Week.js` - Database schema
4. `client/src/components/WeekDetail.jsx` - Main UI component

---

## 🎉 Next Steps

1. **Explore the UI** - Click around the application
2. **Read QUICK_START.md** - For focused quick start
3. **Check TROUBLESHOOTING_GUIDE.md** - Bookmark this
4. **Review COMMANDS_REFERENCE.md** - For command reference
5. **Dive into code** - Look at `server/src/` and `client/src/`

---

## 💬 Need Help?

1. **Check [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)** - 10 common issues
2. **Look at [COMMANDS_REFERENCE.md](COMMANDS_REFERENCE.md)** - All commands
3. **Review [PROJECT_VERIFICATION_REPORT.md](PROJECT_VERIFICATION_REPORT.md)** - What was tested
4. **Check browser console** - F12 to see error details

---

## 🚀 Ready to Get Started?

**Option 1: Using Batch Files (Easiest)**
```powershell
# Terminal 1
.\start-backend.bat

# Terminal 2
.\start-frontend.bat
```

**Option 2: Manual Commands**
```powershell
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Then open: `http://localhost:3000`

---

**Happy Learning! 🎓**

*Last Updated: March 30, 2026*
*Status: ✅ All Systems Operational*
