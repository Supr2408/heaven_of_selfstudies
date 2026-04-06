const Subject = require('../models/Subject');
const Course = require('../models/Course');
const User = require('../models/User');
const YearInstance = require('../models/YearInstance');
const Week = require('../models/Week');
const Resource = require('../models/Resource');
const Message = require('../models/Message');
const { sanitizeInput } = require('../utils/validation');
const { AppError, catchAsync } = require('../utils/errorHandler');
const {
  importNptelCourse,
  searchNptelCatalog,
  getNptelCoursePreview: fetchNptelCoursePreview,
} = require('../utils/nptelCourseImporter');

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

const SEMESTER_ORDER = {
  'Jan-Apr': 1,
  'Aug-Oct': 2,
  'Jul-Oct': 2,
  'July-Oct': 2,
};
const MAX_IMPORTED_WEEK = 12;
const MAX_SEARCH_RESULTS = 20;
const clampImportedWeekCount = (value) => Math.min(Math.max(Number(value) || 0, 1), MAX_IMPORTED_WEEK);

const sortInstancesDesc = (instances = []) =>
  [...instances].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return (SEMESTER_ORDER[b.semester] || 0) - (SEMESTER_ORDER[a.semester] || 0);
  });

const getLibraryInstanceIdSet = (user) =>
  new Set((user?.libraryYearInstances || []).map((id) => String(id)));

const buildHubCourseState = async (course, user) => {
  if (!course) {
    return null;
  }

  const instances = sortInstancesDesc(
    await YearInstance.find({ courseId: course._id }).select('_id year semester').lean()
  );
  const latestInstance = instances[0] || null;
  const latestFirstWeek = latestInstance
    ? await Week.findOne({ yearInstanceId: latestInstance._id }).sort({ weekNumber: 1 }).select('_id').lean()
    : null;

  const libraryInstanceIds = getLibraryInstanceIdSet(user);
  const userInstances = instances.filter((instance) => libraryInstanceIds.has(String(instance._id)));
  const preferredInstance = userInstances[0] || latestInstance;
  const preferredFirstWeek = preferredInstance
    ? await Week.findOne({ yearInstanceId: preferredInstance._id }).sort({ weekNumber: 1 }).select('_id').lean()
    : null;

  return {
    courseId: course._id,
    title: course.title,
    code: course.code,
    subject: course.subjectId || null,
    importedRuns: instances.length,
    userHasCourse: userInstances.length > 0,
    latestYearInstanceId: preferredInstance?._id || null,
    firstWeekId: preferredFirstWeek?._id || null,
    globalLatestYearInstanceId: latestInstance?._id || null,
    globalFirstWeekId: latestFirstWeek?._id || null,
  };
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

const findBestImportedCourse = async ({ courseCode = '', nptelLink = '' } = {}) => {
  const filters = [];

  if (nptelLink) {
    filters.push({ nptelLink });
  }

  if (courseCode) {
    filters.push({ code: courseCode.toUpperCase() });
  }

  if (!filters.length) {
    return null;
  }

  const candidates = await Course.find({ $or: filters }).populate('subjectId', 'name slug');
  if (!candidates.length) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const scored = await Promise.all(
    candidates.map(async (course) => ({
      course,
      runCount: await YearInstance.countDocuments({ courseId: course._id }),
    }))
  );

  scored.sort((a, b) => {
    if (b.runCount !== a.runCount) {
      return b.runCount - a.runCount;
    }
    return new Date(b.course.updatedAt || 0) - new Date(a.course.updatedAt || 0);
  });

  return scored[0].course;
};

const dedupeCoursesByIdentity = async (courses = []) => {
  if (courses.length <= 1) {
    return courses;
  }

  const runCounts = await YearInstance.aggregate([
    {
      $match: {
        courseId: {
          $in: courses.map((course) => course._id),
        },
      },
    },
    {
      $group: {
        _id: '$courseId',
        runCount: { $sum: 1 },
      },
    },
  ]);

  const runCountMap = new Map(
    runCounts.map((item) => [item._id.toString(), item.runCount])
  );

  const picked = new Map();
  courses.forEach((course) => {
    const subjectId =
      course.subjectId && typeof course.subjectId === 'object'
        ? course.subjectId._id?.toString?.() || course.subjectId.toString()
        : course.subjectId?.toString?.() || '';
    const identityKey =
      course.nptelLink || `${subjectId}:${(course.title || '').trim().toLowerCase()}`;
    const candidateScore = runCountMap.get(course._id.toString()) || 0;
    const current = picked.get(identityKey);

    if (!current) {
      picked.set(identityKey, course);
      return;
    }

    const currentScore = runCountMap.get(current._id.toString()) || 0;
    if (candidateScore > currentScore) {
      picked.set(identityKey, course);
      return;
    }

    if (
      candidateScore === currentScore &&
      new Date(course.updatedAt || 0) > new Date(current.updatedAt || 0)
    ) {
      picked.set(identityKey, course);
    }
  });

  return [...picked.values()].sort((a, b) => {
    const titleCompare = (a.title || '').localeCompare(b.title || '');
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return (a.code || '').localeCompare(b.code || '');
  });
};

/**
 * Get all subjects
 */
exports.getAllSubjects = catchAsync(async (req, res) => {
  const subjects = await Subject.find().sort({ name: 1 }).lean();

  res.status(200).json({
    success: true,
    count: subjects.length,
    data: subjects,
  });
});

/**
 * Get subject by slug
 */
exports.getSubjectBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  const subject = await Subject.findOne({ slug }).lean();
  if (!subject) {
    return next(new AppError('Subject not found', 404));
  }

  res.status(200).json({
    success: true,
    data: subject,
  });
});

/**
 * Create subject (admin only)
 */
exports.createSubject = catchAsync(async (req, res, next) => {
  const { name, slug, description, icon } = req.body;

  if (!name || !slug) {
    return next(new AppError('Please provide name and slug', 400));
  }

  const subject = await Subject.create({
    name: sanitizeInput(name),
    slug: slug.toLowerCase(),
    description: description ? sanitizeInput(description) : '',
    icon: icon || '📚',
  });

  res.status(201).json({
    success: true,
    message: 'Subject created successfully',
    data: subject,
  });
});

/**
 * Update subject
 */
exports.updateSubject = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, icon } = req.body;

  let subject = await Subject.findById(id);
  if (!subject) {
    return next(new AppError('Subject not found', 404));
  }

  if (name) subject.name = sanitizeInput(name);
  if (description) subject.description = sanitizeInput(description);
  if (icon) subject.icon = icon;

  await subject.save();

  res.status(200).json({
    success: true,
    message: 'Subject updated successfully',
    data: subject,
  });
});

/**
 * Delete subject
 */
exports.deleteSubject = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const subject = await Subject.findByIdAndDelete(id);
  if (!subject) {
    return next(new AppError('Subject not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Subject deleted successfully',
  });
});

/**
 * Get courses by subject
 */
exports.getCoursesBySubject = catchAsync(async (req, res, next) => {
  const { subjectId } = req.params;

  const courses = await Course.find({ subjectId })
    .populate('subjectId', 'name slug')
    .sort({ code: 1 })
    .lean();
  const dedupedCourses = await dedupeCoursesByIdentity(courses);

  res.status(200).json({
    success: true,
    count: dedupedCourses.length,
    data: dedupedCourses,
  });
});

/**
 * Get course by code
 */
exports.getCourseByCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;

  const course = await Course.findOne({ code })
    .populate('subjectId', 'name slug')
    .lean();

  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  res.status(200).json({
    success: true,
    data: course,
  });
});

/**
 * Search live NPTEL catalog
 */
exports.searchNptelCourses = catchAsync(async (req, res, next) => {
  const query = sanitizeInput(req.query.q || '');
  const institute = sanitizeInput(req.query.institute || '');
  const limit = Math.min(parseInt(req.query.limit, 10) || 12, MAX_SEARCH_RESULTS);

  if (!query) {
    return next(new AppError('Search query is required', 400));
  }

  const results = await searchNptelCatalog({ query, institute, limit });

  res.status(200).json({
    success: true,
    count: results.length,
    data: results,
  });
});

/**
 * Fetch a selected NPTEL course preview plus run statistics
 */
exports.getNptelCoursePreview = catchAsync(async (req, res) => {
  const { catalogId } = req.params;
  const courseUrl = req.query.courseUrl || '';
  const courseName = req.query.courseName || '';
  const institute = req.query.institute || '';
  const professor = req.query.professor || '';

  const preview = await fetchNptelCoursePreview({
    courseNumericId: catalogId,
    courseUrl,
    courseName,
    institute,
    professor,
  });

  const importedCourse = await findBestImportedCourse({
    nptelLink: preview.courseUrl,
  });

  const hubCourse = await buildHubCourseState(importedCourse, req.user);

  res.status(200).json({
    success: true,
    data: {
      ...preview,
      hubCourse,
    },
  });
});

/**
 * Create course
 */
exports.createCourse = catchAsync(async (req, res, next) => {
  const { subjectId, title, code, description, instructors, nptelLink, credits } = req.body;

  if (!subjectId || !title || !code) {
    return next(new AppError('Please provide required fields', 400));
  }

  const course = await Course.create({
    subjectId,
    title: sanitizeInput(title),
    code: code.toUpperCase(),
    description: description ? sanitizeInput(description) : '',
    instructors: instructors || [],
    nptelLink: nptelLink || '',
    credits: credits || 3,
  });

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: course,
  });
});

/**
 * Update course
 */
exports.updateCourse = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, description, instructors, nptelLink, credits } = req.body;

  let course = await Course.findById(id);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  if (title) course.title = sanitizeInput(title);
  if (description) course.description = sanitizeInput(description);
  if (instructors) course.instructors = instructors;
  if (nptelLink) course.nptelLink = nptelLink;
  if (credits) course.credits = credits;

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course updated successfully',
    data: course,
  });
});

/**
 * Delete course
 */
exports.deleteCourse = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const course = await Course.findByIdAndDelete(id);
  if (!course) {
    return next(new AppError('Course not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Course deleted successfully',
  });
});

/**
 * Import NPTEL course by searching with course name, institute, professor.
 * Creates Subject, Course, YearInstance, Weeks, and Materials (links only).
 */
exports.importNptelCourse = catchAsync(async (req, res, next) => {
  const {
    courseName,
    courseCode,
    institute,
    professor,
    courseNumericId,
    courseUrl,
  } = req.body;

  if (!courseName && !courseCode && !courseNumericId && !courseUrl) {
    return next(
      new AppError('Please provide courseName, courseCode, courseNumericId, or courseUrl', 400)
    );
  }

  // Pull data from NPTEL
  const imported = await importNptelCourse({
    courseName,
    courseCode,
    institute,
    professor,
    courseNumericId,
    courseUrl,
  });

  // Subject
  const subjectSlug = slugify(imported.subject.slug || imported.subject.name);
  const importedSubjectName = sanitizeInput(imported.subject.name);
  let subject = await Subject.findOne({
    $or: [{ slug: subjectSlug }, { name: importedSubjectName }],
  });
  if (!subject) {
    subject = await Subject.create({
      name: importedSubjectName,
      slug: subjectSlug,
      description: institute ? sanitizeInput(institute) : '',
      icon: '📘',
    });
  } else if (isGenericTitle(subject.name)) {
    // Upgrade generic subject to real name/slug based on imported data
    subject.name = importedSubjectName;
    subject.slug = subjectSlug;
    subject.description = institute ? sanitizeInput(institute) : subject.description;
    await subject.save();
  }

  // Course
  let course = await findBestImportedCourse({
    courseCode: imported.course.code,
    nptelLink: imported.course.nptelLink,
  });
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
    // If we already created a placeholder course earlier, upgrade its fields
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

  const runsData = imported.metadata?.runsData || [{ ...imported.yearInstance, weeks: imported.weeks, courseCode: imported.course.code }];

  let weeksAdded = 0;
  let runsAdded = 0;
  const importedYearInstanceIds = [];
  for (const run of runsData) {
    const { year, semester, status, syllabus, weeks } = run;
    const totalWeeks = clampImportedWeekCount(run.totalWeeks || (weeks || []).length || 12);

    let yearInstance = await YearInstance.findOne({
      courseId: course._id,
      year,
      semester,
    });

    if (!yearInstance) {
      yearInstance = await YearInstance.create({
        courseId: course._id,
        year,
        semester,
        status: status || 'completed',
        totalWeeks,
        syllabus: syllabus || '',
      });
      runsAdded += 1;
    } else {
      importedYearInstanceIds.push(yearInstance._id);
      yearInstance.status = status || yearInstance.status || 'completed';
      yearInstance.totalWeeks = totalWeeks;
      yearInstance.syllabus = syllabus || yearInstance.syllabus || '';
      await yearInstance.save();
    }

    // Track all imported or updated year instances for the current import
    if (!importedYearInstanceIds.includes(String(yearInstance._id))) {
      importedYearInstanceIds.push(yearInstance._id);
    }

    const incomingWeekNumbers = [...new Set((weeks || []).map((week) => week.weekNumber).filter(Boolean))];
    await removeStaleImportedWeeks(yearInstance._id, incomingWeekNumbers);

    for (const weekPayload of weeks) {
      const existing = await Week.findOne({ yearInstanceId: yearInstance._id, weekNumber: weekPayload.weekNumber });

      if (existing) {
        existing.title = sanitizeInput(weekPayload.title);
        existing.description = sanitizeInput(weekPayload.description || '');
        existing.set('topicsOverview', weekPayload.topicsOverview || []);
        existing.set('materials', weekPayload.materials || []);
        existing.set('pdfLinks', weekPayload.pdfLinks || []);
        existing.set('pyqLinks', weekPayload.pyqLinks || []);
        existing.markModified('topicsOverview');
        existing.markModified('materials');
        existing.markModified('pdfLinks');
        existing.markModified('pyqLinks');
        await existing.save();
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

  // If a user is authenticated, add all imported runs to their personal library
  if (req.user && importedYearInstanceIds.length) {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: { libraryYearInstances: { $each: importedYearInstanceIds } },
      },
      { new: true }
    );
  }

  const latestImportedRun = runsData[runsData.length - 1] || null;
  let latestInstance = latestImportedRun
    ? await YearInstance.findOne({
        courseId: course._id,
        year: latestImportedRun.year,
        semester: latestImportedRun.semester,
      })
    : null;

  if (!latestInstance) {
    latestInstance = sortInstancesDesc(
      await YearInstance.find({ courseId: course._id })
    )[0];
  }

  const firstWeek = latestInstance
    ? await Week.findOne({ yearInstanceId: latestInstance._id }).sort({ weekNumber: 1 })
    : null;

  res.status(201).json({
    success: true,
    message: 'Course imported from NPTEL',
    data: {
      subject,
      course,
      runsAdded,
      weeksAdded,
      courseCodes: runsData.map((r) => r.courseCode),
      navigation: {
        subjectSlug: subject.slug,
        courseCode: course.code,
        latestYearInstanceId: latestInstance?._id || null,
        latestWeekId: firstWeek?._id || null,
      },
    },
  });
});
