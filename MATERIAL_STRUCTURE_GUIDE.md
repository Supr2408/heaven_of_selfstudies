# Material Extraction & Integration Guide

## Overview

The NPTEL Hub platform has been refactored to:
1. **Remove all video lecture links** - Focus on material extraction only
2. **Remove all fake/hardcoded data** - Work with real database records
3. **Implement proper material structure** - Subject > Year > Semester > Week > Materials

## New Material Structure

### Database Schema (Week Model)

```javascript
materials: [
  {
    title: String,              // "Cloud Computing Week 1 Notes"
    type: String,               // 'lecture_note' | 'assignment' | 'solution' | 'code' | 'other'
    url: String,                // Link to Google Drive or NPTEL resources
    fileType: String,           // 'pdf' | 'zip' | 'docx' | etc.
    uploadedAt: Date,           // When the material was added
  }
]
```

### Material Classifications

- **lecture_note**: Lecture slides, notes, PDFs
- **assignment**: Assignment questions, problem sets
- **solution**: Solution files, answer keys
- **code**: Code examples, scripts, sample implementations
- **other**: Any other materials

## Integration Points

### 1. Directory Structure (Subject → Year → Semester → Week → Material)

**Path Format**:
```
Subject (e.g., Cloud Computing)
  └── Year (2024)
      └── Semester (Jan-Apr / July-Oct)
          └── Week 1
              ├── Lecture Notes
              ├── Assignments
              ├── Solutions
              └── Code Examples
```

### 2. NPTEL Material Extraction

#### Source: NPTEL Announcements Page

**Format**: `https://onlinecourses.nptel.ac.in/{courseCode}/announcements`

**Example**: `https://onlinecourses.nptel.ac.in/noc26_cs58/announcements`

**How to Find Course Code**:
- Go to https://nptel.ac.in/courses
- Search for your course
- Click on the course page
- Find the course ID (e.g., 106105167)
- Convert to course code for announcements (e.g., noc26_cs58)

**Course Code Format**:
- `noc` = NPTEL Online Courses
- `26` = Year (2026)
- `cs` = Subject abbreviation
- `58` or `58` = Course identifier

#### Example Course Links

**NPTEL Main**: https://nptel.ac.in/courses/106105167
**Announcements**: https://onlinecourses.nptel.ac.in/noc26_cs58/announcements

### 3. API Endpoints

#### Get Materials for a Week
```
GET /api/weeks/week/{weekId}/materials

Response:
{
  success: true,
  data: {
    weekId: "...",
    weekTitle: "Week 1: Cloud Basics",
    totalMaterials: 5,
    materials: {
      all: [...],
      organized: {
        lectureNotes: [...],
        assignments: [...],
        solutions: [...],
        code: [...],
        others: [...]
      }
    }
  }
}
```

#### Add Material to Week
```
POST /api/weeks/week/{weekId}/materials

Body:
{
  title: "Cloud Computing Lecture Notes",
  type: "lecture_note",
  url: "https://drive.google.com/file/d/...",
  fileType: "pdf"
}

Response:
{
  success: true,
  message: "Material added successfully",
  data: { week object with updated materials }
}
```

#### Sync Materials from NPTEL
```
POST /api/weeks/week/{weekId}/materials/nptel-sync

Body:
{
  courseCode: "noc26_cs58"
}

Response:
{
  success: true,
  message: "Materials updated from NPTEL",
  data: {
    week: { week object },
    summary: {
      totalMaterials: 15,
      newMaterialsAdded: 5,
      extractedByType: {
        lectureNotes: 3,
        assignments: 1,
        solutions: 1,
        code: 0,
        others: 0
      }
    }
  }
}
```

#### Remove Material
```
DELETE /api/weeks/week/{weekId}/materials/{materialIndex}

Response:
{
  success: true,
  message: "Material removed successfully",
  data: { week object }
}
```

## Frontend Components

### WeekDetail Component

**Features**:
- Displays materials organized by type
- Icons and color coding for different material types
- Download buttons with proper icons
- Empty state when no materials available
- Falls back to legacy pdfLinks if materials empty

**Material Type Icons**:
- 📝 Lecture Notes (blue)
- 📋 Assignments (purple)
- ✅ Solutions (green)
- 💻 Code (orange)
- 📄 Other (gray)

### Dashboard Integration

**User Experience**:
1. User selects subject from sidebar
2. Choose year/semester
3. Select week
4. View all organized materials
5. Download materials via Drive links

**Structure Display**:
```
Cloud Computing
├── 2024
│   ├── Jan-Apr
│   │   ├── Week 1 → [Materials]
│   │   ├── Week 2 → [Materials]
│   │   └── Week 3 → [Materials]
│   └── July-Oct
│       ├── Week 1 → [Materials]
│       └── Week 2 → [Materials]
└── 2025
    └── Jan-Apr
        └── Week 1 → [Materials]
```

## Environment Variables

Add to `.env.local`:

```env
# Material Extraction
NEXT_PUBLIC_MATERIAL_API_URL=http://localhost:5000/api/weeks
NPTEL_SCRAPER_TIMEOUT=10000
ENABLE_NPTEL_SYNC=true
```

## How to Use

### For Admin Users

#### 1. Manually Add Materials
```javascript
import { materialAPI } from '@/lib/api';

await materialAPI.addMaterial('weekId', {
  title: 'Week 1 Lecture Notes',
  type: 'lecture_note',
  url: 'https://drive.google.com/file/d/...',
  fileType: 'pdf'
});
```

#### 2. Sync from NPTEL Announcements
```javascript
await materialAPI.syncMaterialsFromNptel('weekId', 'noc26_cs58');
```

#### 3. Remove Material
```javascript
await materialAPI.removeMaterial('weekId', 0); // Remove first material
```

### For Regular Users

1. Navigate to Dashboard
2. Browse Subjects → Year → Semester → Week
3. View all available materials
4. Click material to view/download from Google Drive

## Data Migration

### From Old Structure
```javascript
// Old
pdfLinks: [
  { title: "Lecture", url: "..." },
  { title: "Solution", url: "..." }
]
videoLink: "https://..."

// New
materials: [
  { title: "Lecture", type: "lecture_note", url: "...", fileType: "pdf" },
  { title: "Solution", type: "solution", url: "...", fileType: "pdf" }
]
// videoLink removed
```

### Run Migration
```bash
npm run migrate:materials
```

## Example: Complete Flow

### Step 1: Find Course

Go to https://nptel.ac.in/courses and find "Cloud Computing"
- Course ID: 106105167
- Direct link: https://nptel.ac.in/courses/106105167

### Step 2: Get Course Code

From announcements URL: https://onlinecourses.nptel.ac.in/noc26_cs58/announcements
- Course Code: **noc26_cs58**

### Step 3: Create Structure in DB

```javascript
// Seed creates:
Subject: "Cloud Computing"
  └── Course: "Cloud Computing Fundamentals" (code: noc26_cs58)
      └── YearInstance: 2024, Jan-Apr
          └── Weeks 1-12
```

### Step 4: Populate Materials

```javascript
// Option A: Manual
await materialAPI.addMaterial(week._id, {
  title: 'Cloud Computing Fundamentals Week 1.pdf',
  type: 'lecture_note',
  url: 'https://drive.google.com/file/d/example/view',
  fileType: 'pdf'
});

// Option B: Auto-sync from NPTEL
await materialAPI.syncMaterialsFromNptel(week._id, 'noc26_cs58');
```

### Step 5: User Views Materials

1. Dashboard → Select "Cloud Computing"
2. Choose "2024"
3. Choose "Jan-Apr"
4. Click "Week 1"
5. View all materials organized by type
6. Click to download from Google Drive

## Troubleshooting

### Materials Not Showing
- Check if week has materials in database
- Verify materials array is not empty
- Check console for API errors

### NPTEL Sync Not Working
- Verify courseCode is correct format (noc26_cs58, not 106105167)
- Check announcements page has materials
- Verify network connectivity
- Check server logs for scraper errors

### Missing Materials from NPTEL
- Materials must include "Week X" or "WX" in title
- Only links to drive.google.com are extracted
- Check if announcements page has materials shared

## Future Enhancements

- [ ] Automatic weekly sync from NPTEL announcements
- [ ] Material search across all weeks
- [ ] User-contributed materials with moderation
- [ ] Material analytics (most downloaded, etc.)
- [ ] Folder structure with drag-drop organization
- [ ] OCR for scanned documents
- [ ] Material recommendations based on week topics
- [ ] Offline material download cache

## Related Files

- **Model**: [Week.js](../models/Week.js)
- **Controller**: [yearInstanceController.js](../controllers/yearInstanceController.js)
- **Routes**: [weekRoutes.js](../routes/weekRoutes.js)
- **Utility**: [nptelMaterialExtractor.js](../utils/nptelMaterialExtractor.js)
- **Frontend**: [WeekDetail.jsx](../../client/src/components/WeekDetail.jsx)
- **API Client**: [api.js](../../client/src/lib/api.js)
