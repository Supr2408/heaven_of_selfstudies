# NPTEL Hub - Complete Troubleshooting Guide

## Quick Reference

- **Backend Port**: 5000
- **Frontend Port**: 3000
- **Database**: MongoDB Atlas (cloud)
- **Health Check**: `http://localhost:5000/api/health`

---

## 🔴 Common Issues & Solutions

### Problem 1: "Failed to fetch" Error in Browser Console

**Error Message**:
```
API Error [/courses/subjects]: "Failed to fetch"
```

**Causes**:
1. Backend server not running
2. Backend crashed due to missing dependencies
3. CORS configuration issue
4. MongoDB not connected

**Solutions**:

**Step 1: Check if backend is running**
```powershell
netstat -ano | findstr ":5000"
```
If no output, backend is not running. Start it:
```powershell
cd server
npm run dev
```

**Step 2: Verify backend is responsive**
```powershell
(Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing).Content
# Expected: {"success":true,"message":"Server is running"}
```

**Step 3: Check for dependency errors**
Look at the terminal where you ran `npm run dev`. Check for errors like:
```
Error: Cannot find module 'axios'
```

If you see this, install dependencies:
```powershell
cd server
npm install
npm run dev
```

**Step 4: Check MongoDB connection**
In the terminal output, you should see:
```
MongoDB connected
Server running on port 5000
```

If MongoDB connection fails, check your `.env` file:
```powershell
cat .env | findstr MONGODB_URI
```

---

### Problem 2: "ReferenceError: YY is not defined"

**Error Message**:
```
Uncaught ReferenceError: YY is not defined
    at AssignmentExtractor
```

**Cause**: JSX code in AssignmentExtractor.jsx incorrectly uses template variables

**Solution**: Already fixed in [AssignmentExtractor.jsx](client/src/components/AssignmentExtractor.jsx:61)

If you still see this error, ensure you're running the latest code:
```powershell
cd client
git pull origin main  # if using git
```

---

### Problem 3: Port Already in Use

**Error Message**:
```
Error: listen EADDRINUSE: address already in use :::5000
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause**: Another process is using the port

**Solution**:

**Find and kill the process**:
```powershell
# For port 5000
netstat -ano | findstr ":5000"
taskkill /PID <PID> /F

# For port 3000
netstat -ano | findstr ":3000"
taskkill /PID <PID> /F
```

Then restart the servers:
```powershell
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

---

### Problem 4: "Cannot GET /api/assignments"

**Error Message**:
```
GET /api/assignments 404 in 121ms
```

**Cause**: The assignments endpoint doesn't exist or is not exposed

**Why This Happens**: Assignments are part of the course structure but may not have a dedicated endpoint

**Solution**: This is not critical. The application still works. If you need to implement assignments, add routes in [server/src/routes/assignmentRoutes.js](server/src/routes/assignmentRoutes.js)

---

### Problem 5: MongoDB Connection Failed

**Error Message**:
```
MongoDB connection error: MongoServerSelectionError
```

**Causes**:
1. Invalid MongoDB URI
2. Network connectivity issue
3. MongoDB Atlas cluster down
4. IP not whitelisted

**Solutions**:

**Check MongoDB URI in .env**:
```powershell
cat server\.env | findstr MONGODB_URI
# Should look like:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

**Test connection**:
```powershell
# Try pinging MongoDB
# This is a manual verification step
```

**If using MongoDB Atlas**:
1. Go to https://www.mongodb.com/cloud/atlas
2. Check cluster status
3. Verify IP whitelist includes your IP
4. Check database credentials

**Temporary Fix** (for local development):
Install MongoDB locally and use:
```
MONGODB_URI=mongodb://localhost:27017/nptel-hub
```

---

### Problem 6: Frontend Doesn't Load (Blank Page)

**Causes**:
1. Next.js build failed
2. Backend not responding for SSR
3. Browser cache issues

**Solutions**:

**Clear Next.js cache**:
```powershell
cd client
rm -r .next
npm run dev
```

**Check frontend terminal for errors**:
Look for any red error messages in the terminal where `npm run dev` is running

**Wait for build to complete**:
Next.js may be rebuilding. Wait for:
```
✓ Ready in XXXms
```

---

### Problem 7: Sidebar Not Loading Subjects

**Cause**: API is responding but component isn't rendering data correctly

**Solution**:

**Verify API is working**:
```powershell
(Invoke-WebRequest -Uri "http://localhost:5000/api/courses/subjects" -UseBasicParsing).Content
```

**Check browser console for errors**:
- Open DevTools (F12)
- Go to Console tab
- Look for any error messages
- Check Network tab to see if API call succeeded

**If API returns data but component doesn't show**:
- Try refreshing the page (Ctrl+R)
- Clear browser cache
- Hard reload (Ctrl+Shift+R)

---

### Problem 8: Materials Not Showing for Weeks

**Cause**: Database doesn't have materials, or Week model is missing materials field

**Solution**:

**Verify database has materials**:
```powershell
cd server
npm run seed
```

This repopulates the database with Cloud Computing course and materials

**Check that Week model has materials field**:
Look at [server/src/models/Week.js](server/src/models/Week.js) and ensure it has:
```javascript
materials: [
  {
    title: String,
    type: String,
    url: String,
    fileType: String,
    uploadedAt: Date
  }
]
```

---

### Problem 9: "Unsupported metadata viewport" Warnings

**Error Message**:
```
Unsupported metadata viewport is configured in metadata export
Please move it to viewport export instead
```

**Severity**: ⚠️ Warning (non-blocking)

**Impact**: None - application works fine

**Solution** (if you want to fix):
Find files with metadata viewport and create separate viewport export. This is a Next.js 13+ best practice but not required.

---

### Problem 10: Node Version Incompatibility

**Error Message**:
```
npm warn EBADENGINE Unsupported engine
package: 'undici@7.24.6'
required: { node: '>=20.18.1' }
current: { node: 'v20.17.0' }
```

**Severity**: ⚠️ Warning (usually safe to ignore)

**Solution**: Upgrade Node.js if you need full compatibility:
```powershell
# Using nvm (Node Version Manager)
nvm install 20.18.1
nvm use 20.18.1

# Or download from https://nodejs.org/
```

---

## 📊 Verification Checklist

Run through these checks to verify everything is working:

### ✅ Backend Checks

- [ ] Backend starts without errors
  ```powershell
  cd server && npm run dev
  ```

- [ ] Health endpoint responds
  ```powershell
  (Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing).Content
  ```

- [ ] MongoDB connected
  ```
  Check terminal output for "MongoDB connected"
  ```

- [ ] Subjects API responds
  ```powershell
  (Invoke-WebRequest -Uri "http://localhost:5000/api/courses/subjects" -UseBasicParsing).Content
  ```

### ✅ Frontend Checks

- [ ] Frontend starts without critical errors
  ```powershell
  cd client && npm run dev
  ```

- [ ] Page loads in browser
  ```
  http://localhost:3000
  ```

- [ ] No red errors in browser console (F12)

- [ ] Sidebar loads subjects
  ```
  Should show "Cloud Computing" subject
  ```

### ✅ Integration Checks

- [ ] Clicking on subject expands to show courses

- [ ] Clicking on course expands to show year instances

- [ ] Clicking on year instance expands to show weeks

- [ ] Clicking on week shows materials organized by type

---

## 🎯 Step-by-Step Start Guide

### Fresh Start (Windows PowerShell)

```powershell
# Terminal 1 - Backend
CD D:\heavens for self studies\nptel-hub\server
npm install
npm run dev

# Wait for output: "MongoDB connected" and "Server running on port 5000"
```

```powershell
# Terminal 2 - Frontend
CD D:\heavens for self studies\nptel-hub\client
npm install
npm run dev

# Wait for output: "✓ Ready in XXXms"
```

```powershell
# Terminal 3 - Seed Database (optional, if data needed)
CD D:\heavens for self studies\nptel-hub\server
npm run seed

# Wait for output: "Database seeding completed successfully!"
```

### Access the Application

- **Frontend**: Open browser to `http://localhost:3000`
- **Backend API**: `http://localhost:5000/api`
- **API Health Check**: `http://localhost:5000/api/health`

---

## 🔧 Using Batch Files (Recommended for Windows)

Instead of manual commands, use the provided batch files:

**Terminal 1**:
```
D:\heavens for self studies\nptel-hub\start-backend.bat
```

**Terminal 2**:
```
D:\heavens for self studies\nptel-hub\start-frontend.bat
```

---

## 📝 Log Files to Check

If something is wrong, check these logs:

1. **Backend Console Output**:
   - Shows all API requests
   - Shows database errors
   - Shows sync errors

2. **Frontend Browser Console** (F12):
   - Shows JavaScript errors
   - Shows failed API calls
   - Shows warnings

3. **Network Tab** (F12 → Network):
   - Shows all HTTP requests
   - Shows request/response status
   - Shows timing information

---

## 🆘 Still Having Issues?

### Collect Information

When reporting an issue, provide:

1. **Error message** (copy the exact text)
2. **When it occurs** (on startup, on click, when navigating)
3. **Terminal output** (from npm run dev)
4. **Browser console** (F12 → Console tab)
5. **Network requests** (F12 → Network tab)

### Check These Logs

**Backend Logs**:
```
Check terminal where "npm run dev" is running in /server
Look for red error text
```

**Frontend Logs**:
```
Press F12 → Console tab
Look for red error messages
```

**System Logs**:
```
Windows Event Viewer might show system errors
Task Manager might show high CPU/memory usage
```

---

## 🚀 Performance Tuning

If the application is running slowly:

1. **Clear cache**:
   ```powershell
   cd client
   rm -r .next
   npm run dev
   ```

2. **Restart services**:
   ```
   Kill both backend and frontend processes
   Start them fresh
   ```

3. **Check system resources**:
   ```
   Open Task Manager (Ctrl+Shift+Esc)
   Check CPU and memory usage
   ```

4. **Review database queries**:
   - Look at MongoDB Atlas metrics
   - Check if indexes are properly created

---

## 📚 Additional Resources

- **Project Verification Report**: [PROJECT_VERIFICATION_REPORT.md](PROJECT_VERIFICATION_REPORT.md)
- **Material Structure Guide**: [MATERIAL_STRUCTURE_GUIDE.md](MATERIAL_STRUCTURE_GUIDE.md)
- **Architecture Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Setup Guide**: [SETUP.md](SETUP.md)
- **Quick Start Guide**: [QUICK_START.md](QUICK_START.md)

---

## ✅ Common Success Indicators

Everything is working correctly if you see:

1. ✅ Backend Terminal:
   ```
   [nodemon] 3.1.14
   Server running on port 5000
   MongoDB connected
   ```

2. ✅ Frontend Terminal:
   ```
   ▲ Next.js 16.2.1
   ✓ Ready in XXXms
   ```

3. ✅ Browser Console:
   ```
   No red error messages
   ```

4. ✅ Browser Page:
   ```
   Page loads
   Sidebar shows subjects
   Can click to expand courses
   ```

5. ✅ API Response:
   ```powershell
   {"success":true,"data":[...]}
   ```

---

## 🎉 You're All Set!

If all checks pass, the NPTEL Hub is ready for development and testing. Happy coding!

**Last Updated**: March 30, 2026
**Verified**: All systems operational ✅
