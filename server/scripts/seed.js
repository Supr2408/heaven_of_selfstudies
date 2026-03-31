require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Subject = require('../src/models/Subject');
const Course = require('../src/models/Course');
const YearInstance = require('../src/models/YearInstance');
const Week = require('../src/models/Week');

// Materials live at repo root: ../Cloud Computing from server/, ../../ from scripts/
const MATERIALS_BASE_PATH = path.join(__dirname, '../../Cloud Computing');
const MATERIAL_BASE_URL = (() => {
  const envUrl = process.env.MATERIAL_BASE_URL || process.env.API_BASE_URL?.replace(/\/api\/?$/, '');
  const base = envUrl && envUrl.trim().length > 0 ? envUrl.trim() : 'http://localhost:5000';
  return base.endsWith('/materials') ? base : `${base}/materials`;
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
      topicsOverview: ['Cloud Computing materials'],
      materials,
      pdfLinks: [],
      pyqLinks: [],
    }));
};

const buildMaterialStructure = () => {
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

    // Create Subject - Only Cloud Computing
    console.log('📚 Creating Cloud Computing subject...');
    const subject = await Subject.create({
      name: 'Cloud Computing',
      slug: 'cloud-computing',
      description: 'Comprehensive cloud computing fundamentals, service models, providers, and architectures',
      icon: '☁️',
    });
    console.log(`✅ Created subject: ${subject.name}\n`);

    // Create Courses
    console.log('📖 Creating Cloud Computing course...');
    const coursesData = [
      {
        subjectId: subject._id,
        title: 'Cloud Computing Fundamentals',
        code: 'CLOUD-101',
        description: 'Introduction to cloud computing concepts, models, and service types (IaaS, PaaS, SaaS)',
        instructors: ['Prof. Yogesh Simmhan', 'Dr. Aniruddha Kembhavi'],
        nptelLink: 'https://nptel.ac.in/courses/106102048/',
        prerequisites: [],
        credits: 4,
      },
    ];

    const courses = await Course.insertMany(coursesData);
    console.log(`✅ Created ${courses.length} course\n`);

    // Build material structure from local filesystem
    const materialStructure = buildMaterialStructure();
    if (!materialStructure.length) {
      throw new Error('No materials found in Cloud Computing directory. Ensure the files are present.');
    }

    // Create Year Instances based on materials discovered
    console.log('📅 Creating year instances from local materials...');
    const yearInstancesData = materialStructure.map((entry) => ({
      courseId: courses[0]._id,
      year: entry.year,
      semester: entry.semester,
      status: 'completed',
      totalWeeks: entry.weeks.length,
      syllabus: `Cloud computing run ${entry.year} ${entry.semester}`,
      enrollmentCount: 0,
    }));

    const yearInstances = await YearInstance.insertMany(yearInstancesData);
    console.log(`✅ Created ${yearInstances.length} year instances\n`);

    // Create Weeks based on discovered files
    console.log('📆 Creating weeks with discovered materials...');
    const weeksData = [];

    materialStructure.forEach((entry, index) => {
      const yearInstanceId = yearInstances[index]._id;
      entry.weeks.forEach((week) => {
        weeksData.push({
          ...week,
          yearInstanceId,
        });
      });
    });

    const weeks = await Week.insertMany(weeksData);
    console.log(`✅ Created ${weeks.length} weeks with materials\n`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Subject: Cloud Computing ☁️`);
    console.log(`   - Courses: ${courses.length}`);
    console.log(`   - Year Instances: ${yearInstances.length}`);
    console.log(`   - Total Weeks: ${weeks.length}`);
    console.log('\n📚 Cloud Computing Courses:');
    courses.forEach(c => console.log(`   ${c.code} - ${c.title}`));
    console.log('\n✅ Clean Cloud Computing platform is ready!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
