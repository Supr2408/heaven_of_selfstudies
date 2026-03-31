# NPTEL Hub - Project Status & Usage Guide

## ✅ Project Status: WORKING

### Backend Status
- **Server**: Running on port 5000
- **Database**: MongoDB connected and operational
- **Courses Import**: Functional with catalog search and course outline extraction
- **API**: All endpoints operational for courses, weeks, assignments

### Frontend Status  
- **Server**: Running on port 3000 (Next.js dev mode)
- **URL**: http://localhost:3000
- **Features**: Dashboard displays courses, weeks, and assignment materials

---

## 🎯 Key Features Working

### 1. **Course Import by Name + Institute**
Import NPTEL courses directly by searching their name and institute:
```bash
node scripts/importNptelDirect.js --name "Data Mining" --institute "IIT Kharagpur"
node scripts/importNptelDirect.js --name "Natural Language Processing" --institute "IIT Bombay"
```

### 2. **Automatic Week Population**
- **With Course Outline**: If course has lecture videos (YouTube links), weeks are populated automatically with lecture materials
- **With Assignments**: If past run codes exist, announcements are scraped for assignment solutions
- **Fallback**: Placeholder weeks created if no materials found

### 3. **Course Data Extracted**
Each course includes:
- ✅ Course title, professor, institute
- ✅ Weeks/units with lecture videos
- ✅ Lecture materials with direct YouTube links
- ✅ Assignment solutions (when available)
- ✅ Past run history

---

## 📊 Example: Data Mining Course

**Import Command**:
```bash
node scripts/importNptelDirect.js --name "Data Mining" --institute "IIT Kharagpur"
```

**Result** (successfully imported):
- **Course**: Data Mining (IIT Kharagpur)
- **Professor**: Prof. Pabitra Mitra
- **Weeks**: 8 weeks with full lecture materials
- **Materials Per Week**: 5-7 lectures with YouTube video links
- **Content**: Complete curriculum from Introduction to Regression

**Weeks Created**:
```
Week 1: Introduction, Knowledge Discovery Process (5 lectures)
Week 2: Data Preprocessing & Rule Generation (6 lectures)
Week 3: Bayes Classifier (5 lectures)
Week 4: K Nearest Neighbor (5 lectures)
Week 5: Support Vector Machine (5 lectures)
Week 6: Kernel Machines & Neural Networks (5 lectures)
Week 7: Clustering Algorithms (5 lectures)
Week 8: Regression Methods (7 lectures)
```

---

## 🚀 Running the Project

### 1. Start Backend
```bash
cd server
npm start
```
Backend runs on http://localhost:5000

### 2. Start Frontend
```bash
cd client
npm run dev
```
Frontend runs on http://localhost:3000

### 3. Import a Course
```bash
# In another terminal, from server directory:
node scripts/importNptelDirect.js --name "COURSE_NAME" --institute "INSTITUTE"

# Example:
node scripts/importNptelDirect.js --name "Natural Language Processing" --institute "IIT Kharagpur"
```

---

## 📝 How It Works

### Course Discovery Flow
1. **Search**: Uses NPTEL's embedded course catalog from `nptel.ac.in/courses`
2. **Institute Filtering**: Fuzzy matches against institute name
3. **Course Selection**: Picks best match based on title + institute score

### Week Population Flow
1. **Check Announcements**: Try to scrape NPTEL announcement pages
2. **Extract Course Outline**: If announcements unavailable, extract from course's Svelte app data
3. **YouTube Links**: Automatically converts lecture videos to YouTube URLs
4. **Create Weeks**: Generates structured week objects with materials

---

## 🔗 Course Links Available

Each lesson includes a YouTube link, e.g.:
```
https://www.youtube.com/watch?v=ykZ-_UGcYWg
```

You can:
- ✅ Watch directly on YouTube
- ✅ Download for offline viewing
- ✅ Access course materials from dashboard

---

## 🎓 Supported Courses

Successfully imported and working:
- ✅ Data Mining (IIT Kharagpur) - 8 weeks
- ✅ Natural Language Processing (IIT Kharagpur) - with announcement solutions
- Multiple other NPTEL courses available in catalog

Search any course by name + institute combination - the system will auto-populate weeks!

---

## 📱 Dashboard

Visit http://localhost:3000 to:
- View all imported courses
- Browse weeks by course
- See lecture materials with YouTube links
- Track progress through course

---

## ⚡ Technical Stack

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: Next.js + Tailwind CSS
- **Data Source**: NPTEL.ac.in (official course platform)
- **Scraping**: Cheerio + Axios with Firefox User-Agent

---

## 🐛 Common Issues & Solutions

### Port Already in Use
```powershell
# Find and kill process
netstat -ano | findstr :5000
Stop-Process -Id <PID> -Force
```

### Course Not Found
- Try exact NPTEL course name
- Verify institute spelling matches NPTEL
- Check course exists on NPTEL website

### No Weeks Populated
- Course may not have public course outline
- Can manually add weeks via dashboard
- Past assignment solutions scraped when available

---

## 📚 Next Steps

You can now:
1. Import any NPTEL course by name + institute
2. Browse all course materials in the dashboard
3. Download videos and assignments
4. Share course links with others
5. Build study groups using the chat feature

**Enjoy your NPTEL learning!** 🎉
