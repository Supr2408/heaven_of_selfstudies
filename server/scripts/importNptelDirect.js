#!/usr/bin/env node
/*
 * Helper script: import one NPTEL course directly (without auth) by courseName and/or courseCode.
 * Usage examples:
 *   node scripts/importNptelDirect.js --name "Natural Language Processing" --code noc25_cs51
 *   node scripts/importNptelDirect.js --name "Natural Language Processing" --institute "IIT Kharagpur"
 *   node scripts/importNptelDirect.js --code noc25_cs51
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('../src/models/Subject');
const Course = require('../src/models/Course');
const YearInstance = require('../src/models/YearInstance');
const Week = require('../src/models/Week');
const Resource = require('../src/models/Resource');
const Message = require('../src/models/Message');
const { sanitizeInput } = require('../src/utils/validation');
const { importNptelCourse } = require('../src/utils/nptelCourseImporter');
const MAX_IMPORTED_WEEK = 12;

const slugify = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const isGenericTitle = (title = '') => {
  const t = title.toLowerCase();
  return t.includes('nptel course') || t === 'nptel' || t === 'course' || t.length <= 4;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = {};
  args.forEach((arg, idx) => {
    if (arg === '--name' && args[idx + 1]) result.courseName = args[idx + 1];
    if (arg === '--code' && args[idx + 1]) result.courseCode = args[idx + 1];
    if (arg === '--institute' && args[idx + 1]) result.institute = args[idx + 1];
    if (arg.startsWith('--name=')) result.courseName = arg.split('=')[1];
    if (arg.startsWith('--code=')) result.courseCode = arg.split('=')[1];
    if (arg.startsWith('--institute=')) result.institute = arg.split('=')[1];
  });
  return result;
};

const removeStaleImportedWeeks = async (yearInstanceId, incomingWeekNumbers = []) => {
  const staleWeeks = await Week.find({
    yearInstanceId,
    $or: [
      { weekNumber: { $gt: MAX_IMPORTED_WEEK } },
      ...(incomingWeekNumbers.length ? [{ weekNumber: { $nin: incomingWeekNumbers } }] : []),
    ],
  }).select('_id');

  let removed = 0;
  let skipped = 0;

  for (const staleWeek of staleWeeks) {
    const [hasMessages, hasResources] = await Promise.all([
      Message.exists({ weekId: staleWeek._id }),
      Resource.exists({ weekId: staleWeek._id, isDeleted: { $ne: true } }),
    ]);

    if (hasMessages || hasResources) {
      skipped += 1;
      continue;
    }

    await Week.deleteOne({ _id: staleWeek._id });
    removed += 1;
  }

  return { removed, skipped };
};

const run = async () => {
  const { courseName, courseCode, institute } = parseArgs();
  if (!courseName && !courseCode) {
    console.error('Please provide --name and/or --code (e.g., --code noc25_cs51).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const imported = await importNptelCourse({ courseName, courseCode, institute });
  const subjectSlug = slugify(imported.subject.slug || imported.subject.name);

  let subject = await Subject.findOne({ slug: subjectSlug });
  if (!subject) {
    subject = await Subject.create({
      name: sanitizeInput(imported.subject.name),
      slug: subjectSlug,
      description: '',
      icon: '📘',
    });
  } else if (isGenericTitle(subject.name)) {
    subject.name = sanitizeInput(imported.subject.name);
    subject.slug = subjectSlug;
    await subject.save();
  }

  let course = await Course.findOne({ code: imported.course.code.toUpperCase() });
  if (!course) {
    course = await Course.create({
      subjectId: subject._id,
      title: sanitizeInput(imported.course.title),
      code: imported.course.code.toUpperCase(),
      description: sanitizeInput(imported.course.description || ''),
      instructors: imported.course.instructors || [],
      nptelLink: imported.course.nptelLink || '',
      credits: 3,
    });
  } else {
    let changed = false;
    if (isGenericTitle(course.title) || course.title !== imported.course.title) {
      course.title = sanitizeInput(imported.course.title);
      changed = true;
    }
    if (!course.description || isGenericTitle(course.description)) {
      course.description = sanitizeInput(imported.course.description || '');
      changed = true;
    }
    if ((!course.instructors || course.instructors.length === 0) && imported.course.instructors?.length) {
      course.instructors = imported.course.instructors;
      changed = true;
    }
    if (!course.nptelLink && imported.course.nptelLink) {
      course.nptelLink = imported.course.nptelLink;
      changed = true;
    }
    if (course.subjectId.toString() !== subject._id.toString()) {
      course.subjectId = subject._id;
      changed = true;
    }
    if (changed) await course.save();
  }

  let weeksAdded = 0;
  let weeksUpdated = 0;
  const runsData = imported.metadata?.runsData || [
    { ...imported.yearInstance, weeks: imported.weeks, courseCode: imported.course.code },
  ];

  for (const run of runsData) {
    const { year, semester, status, syllabus, weeks = [] } = run;
    const totalWeeks = run.totalWeeks || weeks.length || 12;

    let yearInstance = await YearInstance.findOne({ courseId: course._id, year, semester });
    if (!yearInstance) {
      yearInstance = await YearInstance.create({
        courseId: course._id,
        year,
        semester,
        status: status || 'completed',
        totalWeeks,
        syllabus: syllabus || '',
      });
    } else {
      yearInstance.status = status || yearInstance.status || 'completed';
      yearInstance.totalWeeks = totalWeeks;
      yearInstance.syllabus = syllabus || yearInstance.syllabus || '';
      await yearInstance.save();
    }

    const incomingWeekNumbers = [...new Set(weeks.map((week) => week.weekNumber).filter(Boolean))];
    await removeStaleImportedWeeks(yearInstance._id, incomingWeekNumbers);

    for (const weekPayload of weeks) {
      const existing = await Week.findOne({
        yearInstanceId: yearInstance._id,
        weekNumber: weekPayload.weekNumber,
      });

      if (existing) {
        existing.title = sanitizeInput(weekPayload.title);
        existing.description = sanitizeInput(weekPayload.description || '');
        existing.topicsOverview = weekPayload.topicsOverview || [];
        existing.materials = weekPayload.materials || [];
        existing.pdfLinks = weekPayload.pdfLinks || [];
        existing.pyqLinks = weekPayload.pyqLinks || [];
        await existing.save();
        weeksUpdated += 1;
        continue;
      }

      await Week.create({
        yearInstanceId: yearInstance._id,
        weekNumber: weekPayload.weekNumber,
        title: sanitizeInput(weekPayload.title),
        description: sanitizeInput(weekPayload.description || ''),
        topicsOverview: weekPayload.topicsOverview || [],
        materials: weekPayload.materials || [],
        pdfLinks: weekPayload.pdfLinks || [],
        pyqLinks: weekPayload.pyqLinks || [],
      });
      weeksAdded += 1;
    }
  }

  console.log({ subject: subject.slug, course: course.code, weeksAdded, weeksUpdated });
  await mongoose.disconnect();
  console.log('Done');
};

run().catch((err) => {
  console.error('Import failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
