require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Subject = require('../src/models/Subject');
const Course = require('../src/models/Course');
const YearInstance = require('../src/models/YearInstance');
const Week = require('../src/models/Week');

// Materials folder has been removed - Cloud Computing materials no longer available
// const MATERIALS_BASE_PATH = path.join(__dirname, '../../Cloud Computing');
const MATERIALS_BASE_PATH = null; // Disabled: folder removed

// Materials folder has been removed
const MATERIAL_BASE_URL = (() => {
  return 'http://localhost:5000/materials'; // Fallback URL (folder won't exist)
})();

const getDirectories = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) return [];
  return fs
    .readdirSync(directoryPath)
    .filter((name) => fs.statSync(path.join(directoryPath, name)).isDirectory());
};

const normalizeSemester = (semesterDir = '') => {
  const lower = semesterDir.toLowerCase();
  if (lower.includes('jan')) return 'Jan-Apr';
  if (lower.includes('aug')) return 'Aug-Oct';
  if (lower.includes('jul')) return 'Jul-Oct';
  if (lower.includes('july')) return 'July-Oct';
  return semesterDir || 'Jul-Oct';
};

const inferMaterialType = (fileName = '') => {
  const lower = fileName.toLowerCase();
  if (lower.includes('assignment')) return 'assignment';
  if (lower.includes('solution')) return 'solution';
  if (lower.includes('lecture') || lower.includes('note')) return 'lecture_note';
  if (lower.includes('code')) return 'code';
  return 'other';
};

const extractWeekNumberFromFile = (fileName = '') => {
  // Use the last number in the filename as the week indicator, e.g. Solution_Week_01_12.pdf -> 12
  const matches = fileName.match(/(\d+)/g);
  if (!matches || !matches.length) return null;
  const last = parseInt(matches[matches.length - 1], 10);
  return Number.isFinite(last) ? last : null;
};

const buildWeeksFromFolder = (yearDir, semesterDir, weekDir) => {
  const weekPath = path.join(MATERIALS_BASE_PATH, yearDir, semesterDir, weekDir);
  const files = fs
    .readdirSync(weekPath)
    .filter((file) => fs.statSync(path.join(weekPath, file)).isFile());

  // Group files by inferred week number inside the folder
  const grouped = new Map();
  files.forEach((file) => {
    const weekNumber = extractWeekNumberFromFile(file) || 1;
    if (!grouped.has(weekNumber)) grouped.set(weekNumber, []);
    const ext = path.extname(file).replace('.', '').toLowerCase();
    grouped.get(weekNumber).push({
      title: file,
      type: inferMaterialType(file),
      url: `${MATERIAL_BASE_URL}/${encodeURIComponent(yearDir)}/${encodeURIComponent(semesterDir)}/${encodeURIComponent(weekDir)}/${encodeURIComponent(file)}`,
      fileType: ext,
      uploadedAt: new Date(),
    });
  });

  // Build week entries sorted by week number
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, materials]) => ({
      weekNumber,
      title: `Week ${String(weekNumber).padStart(2, '0')}`,
      description: `Materials for Week ${weekNumber} (${yearDir} ${semesterDir})`,
      topicsOverview: ['Course materials'],
      materials,
      pdfLinks: [],
      pyqLinks: [],
    }));
};

const buildMaterialStructure = () => {
  // Cloud Computing materials folder has been removed
  if (!MATERIALS_BASE_PATH) {
    console.log('⚠️  Cloud Computing materials folder not available (folder was removed)');
    return [];
  }
  
  const years = getDirectories(MATERIALS_BASE_PATH).filter((dir) => /^\d{4}$/.test(dir));
  const structure = [];

  years.forEach((yearDir) => {
    const semesters = getDirectories(path.join(MATERIALS_BASE_PATH, yearDir));

    semesters.forEach((semesterDir) => {
      const semester = normalizeSemester(semesterDir);
      const weekDirs = getDirectories(path.join(MATERIALS_BASE_PATH, yearDir, semesterDir));
      if (!weekDirs.length) return;

      const weeks = weekDirs.flatMap((weekDir) => buildWeeksFromFolder(yearDir, semesterDir, weekDir));

      structure.push({
        year: parseInt(yearDir, 10),
        semester,
        semesterDir,
        weeks,
      });
    });
  });

  return structure;
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected for seeding'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Subject.deleteMany({});
    await Course.deleteMany({});
    await YearInstance.deleteMany({});
    await Week.deleteMany({});
    
    console.log('✅ Database cleared successfully!');
    console.log('📝 Ready to import NPTEL courses using the admin panel or API\n');
    console.log('Next steps:');
    console.log('  1. Visit the Courses page in your browser');
    console.log('  2. Use the "Import NPTEL Course" feature');
    console.log('  3. Or use the API to create subjects and courses manually');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
