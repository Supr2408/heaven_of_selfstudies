# NPTEL Hub - Quick Start Guide

## ✅ Installation Complete!

Your NPTEL Hub project is now ready to run. Here's what was configured:

### 📋 Configuration Summary

**Backend (.env)**
```
✓ MongoDB URI: Connected to Atlas (sustainable_commerce database)
✓ JWT Secret: Configured
✓ Frontend URL: http://localhost:3000
✓ Port: 5000
```

**Frontend (.env.local)**
```
✓ API URL: http://localhost:5000/api
✓ Socket.io URL: http://localhost:5000
```

### 📦 Dependencies Installed

**Backend (server/)**
- ✓ Express.js 4.18+
- ✓ MongoDB & Mongoose
- ✓ Socket.io 4.5+
- ✓ JWT & Bcrypt
- ✓ Rate Limiting
- ✓ CORS & Cookie Parser
- ✓ All security middleware

**Frontend (client/)**
- ✓ Next.js 14+
- ✓ React 18+
- ✓ Tailwind CSS
- ✓ Socket.io Client
- ✓ Zustand (State Management)
- ✓ Lucide React Icons

### 🚀 How to Run

#### Option 1: Using Batch Scripts (Windows)
```bash
# Terminal 1 - Start Backend
start-backend.bat

# Terminal 2 - Start Frontend
start-frontend.bat
```

#### Option 2: Manual Commands
```bash
# Terminal 1 - Backend
cd server
npm run dev
# Runs on http://localhost:5000

# Terminal 2 - Frontend
cd client
npm run dev
# Runs on http://localhost:3000
```

#### Option 3: PowerShell
```powershell
# Terminal 1
cd "d:\heavens for self studies\nptel-hub\server"
npm run dev

# Terminal 2
cd "d:\heavens for self studies\nptel-hub\client"
npm run dev
```

### 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health
- **MongoDB**: Connected via Atlas

### 🔍 Test the Connection

#### Test Backend
```bash
curl http://localhost:5000/api/health
# Expected response: {"success":true,"message":"Server is running"}
```

#### Test Database Connection
Check backend logs for:
```
MongoDB connected
Socket.io initialized
Server running on port 5000
```

### 📝 First Steps

1. **Start Backend**: `npm run dev` in `server/` folder
2. **Start Frontend**: `npm run dev` in `client/` folder
3. **Wait for**: Both servers to show "ready" messages
4. **Open Browser**: http://localhost:3000
5. **Register**: Create a new account
6. **Explore**: Check out the dashboard

### 🛠️ Troubleshooting

**MongoDB Connection Error**
- Ensure your MongoDB Atlas IP whitelist includes your current IP
- Check MONGODB_URI in `server/.env`
- Verify SSL is enabled in connection string

**Port Already in Use**
```powershell
# Find process on port 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess

# Kill process (replace PID with number from above)
Stop-Process -Id <PID> -Force
```

**Module Not Found**
```bash
# Reinstall dependencies
cd server && rm -r node_modules package-lock.json && npm install
cd client && rm -r node_modules package-lock.json && npm install
```

**Socket.io Connection Failed**
- Check both servers are running
- Check `NEXT_PUBLIC_SOCKET_URL` in `client/.env.local`
- Clear browser cache

### 📚 Documentation

- **Setup Guide**: [SETUP.md](../SETUP.md)
- **Architecture**: [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **README**: [README.md](../README.md)

### 💡 Useful Commands

```bash
# Development
npm run dev              # Start with auto-reload

# Production Build
npm run build
npm start

# Database Seeding (Optional - if script exists)
node scripts/seed.js

# Check for vulnerabilities
npm audit
npm audit fix

# Format code
npm run lint
```

### ✅ Verification Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] MongoDB Atlas connection successful
- [ ] Socket.io connected
- [ ] Can register/login on frontend
- [ ] API health check works

### 🎉 You're All Set!

Your NPTEL Hub platform is ready for development and testing. Start the servers and begin building!

**Questions?** Check the documentation files or review the code comments.

---

**🚀 Happy Coding!**
