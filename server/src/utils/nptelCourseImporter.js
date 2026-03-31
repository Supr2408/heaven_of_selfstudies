const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('vm');
const { scrapeNPTELAnnouncements, convertDriveLink } = require('./nptelScraper');

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const slugify = (text = '') =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const safeTrim = (value = '') => value.trim();
const normalize = (text = '') => safeTrim(text).toLowerCase();
const cleanNptelTitle = (text = '') =>
  safeTrim(text)
    .replace(/^NOC\s*:\s*/i, '')
    .replace(/\s+/g, ' ');

const determineSemesterFromTimeline = (timeline = '') => {
  const lower = timeline.toLowerCase();
  if (lower.includes('jan')) return 'Jan-Apr';
  if (lower.includes('feb')) return 'Jan-Apr';
  if (lower.includes('mar')) return 'Jan-Apr';
  if (lower.includes('apr')) return 'Jan-Apr';
  if (lower.includes('jul')) return 'Jul-Oct';
  if (lower.includes('aug')) return 'Jul-Oct';
  if (lower.includes('oct')) return 'Jul-Oct';
  if (lower.includes('sep')) return 'Jul-Oct';
  if (lower.includes('dec')) return 'Jul-Oct';
  return 'Jul-Oct';
};

const buildCourseCodeFromRun = (courseId = '') => courseId.replace(/-/g, '_').toLowerCase();

const parseYearFromTimeline = (timeline = '') => {
  const match = timeline.match(/(20\d{2})/);
  if (match) return parseInt(match[1], 10);
  return null;
};

const fetchHtml = async (url) => {
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: REQUEST_HEADERS,
  });
  return cheerio.load(data);
};

const fetchText = async (url) => {
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: REQUEST_HEADERS,
  });
  return data;
};

const levenshtein = (a = '', b = '') => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
};

const extractCoursesArray = (scriptText = '') => {
  const marker = 'courses:[';
  const start = scriptText.indexOf(marker);
  if (start === -1) return null;

  let idx = start + marker.length;
  let depth = 1;

  while (idx < scriptText.length && depth > 0) {
    const ch = scriptText[idx];
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    idx += 1;
  }

  if (depth !== 0) return null;
  return scriptText.slice(start + marker.length, idx - 1);
};

const mapCatalogCourse = (course = {}) => ({
  courseNumericId: course.id?.toString() || '',
  title: safeTrim(course.title || ''),
  instituteName: safeTrim(course.instituteName || ''),
  professor: safeTrim(course.professor || ''),
  discipline: safeTrim(course.discipline || course.disciplineName || ''),
  courseType: safeTrim(course.courseType || ''),
  courseUrl: course.id ? `https://nptel.ac.in/courses/${course.id}` : '',
});

const fetchCoursesCatalog = async () => {
  try {
    const html = await fetchText('https://nptel.ac.in/courses');
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const target = scripts.find((script) => script.includes('courses:['));
    if (!target) return [];

    const arrayText = extractCoursesArray(target);
    if (!arrayText) return [];

    const catalog = vm.runInNewContext(`[${arrayText}]`, {}, { timeout: 2000 });
    if (!Array.isArray(catalog)) return [];

    return catalog.map(mapCatalogCourse).filter((course) => course.courseNumericId && course.title);
  } catch (err) {
    console.warn('Failed to load NPTEL catalog:', err.message);
    return [];
  }
};

const resolveCatalogCourse = async ({
  courseNumericId,
  courseUrl,
  courseName,
  institute,
}) => {
  const catalog = await fetchCoursesCatalog();
  if (!catalog.length) return null;

  if (courseNumericId) {
    return catalog.find((course) => course.courseNumericId === courseNumericId.toString()) || null;
  }

  if (courseUrl) {
    return catalog.find((course) => course.courseUrl === courseUrl) || null;
  }

  if (!courseName) return null;

  const queryNorm = normalize(courseName);
  const instituteNorm = normalize(institute || '');
  const pool = instituteNorm
    ? catalog.filter((course) => normalize(course.instituteName).includes(instituteNorm))
    : catalog;

  const candidates = (pool.length ? pool : catalog).map((course) => {
    const titleNorm = normalize(course.title);
    const distance = levenshtein(queryNorm, titleNorm || queryNorm);
    const containsBonus = titleNorm.includes(queryNorm) ? -5 : 0;
    const instituteBonus =
      instituteNorm && normalize(course.instituteName).includes(instituteNorm) ? -8 : 0;

    return {
      ...course,
      score: distance + containsBonus + instituteBonus,
    };
  });

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] || null;
};

const searchNptelCatalog = async ({ query, institute, limit = 12 }) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const catalog = await fetchCoursesCatalog();
  if (!catalog.length) return [];

  const normalizedInstitute = normalize(institute || '');

  const scored = catalog
    .map((course) => {
      const titleNorm = normalize(course.title);
      const professorNorm = normalize(course.professor);
      const instituteNorm = normalize(course.instituteName);
      const disciplineNorm = normalize(course.discipline);
      const searchableText = [titleNorm, professorNorm, instituteNorm, disciplineNorm].join(' ');

      const containsTitle = titleNorm.includes(normalizedQuery);
      const containsText = searchableText.includes(normalizedQuery);
      const instituteMatch =
        !normalizedInstitute || instituteNorm.includes(normalizedInstitute);

      if (!containsTitle && !containsText) {
        return null;
      }

      const distance = levenshtein(normalizedQuery, titleNorm || normalizedQuery);
      const containsBonus = containsTitle ? -8 : containsText ? -4 : 0;
      const instituteBonus = instituteMatch ? -5 : 0;

      return {
        ...course,
        score: distance + containsBonus + instituteBonus,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, Math.min(limit, 20)));

  return scored.map(({ score, ...course }) => course);
};

const parseStatsApiRuns = (payload = {}) => {
  const rows = Array.isArray(payload?.run_wise_stats) ? payload.run_wise_stats : [];
  const seen = new Set();

  return rows
    .map((row) => {
      const timeline = safeTrim(row?.Timeline || row?.timeline || '');
      const courseId = safeTrim(row?.noc_courseid || row?.courseid || row?.courseId || '');
      if (!timeline || !courseId || !normalize(courseId).startsWith('noc')) {
        return null;
      }

      const key = `${timeline}|${courseId.toLowerCase()}`;
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        timeline,
        courseId,
      };
    })
    .filter(Boolean);
};

const extractCourseOutlineFromPage = (html) => {
  try {
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const script of scripts) {
      if (!script.includes('courseOutline:') || !script.includes('units:[')) continue;

      const titleMatch = script.match(/title:"([^"]+)"/);
      const professorMatch = script.match(/professor:"([^"]+)"/);
      const instituteMatch = script.match(/instituteName:"([^"]+)"/);
      const unitsArrayMatch = script.match(/units:\[((?:\{(?:[^{}]|(?:\{[^{}]*\}))*\},?)*)\]/);

      if (!unitsArrayMatch?.[1]) continue;

      try {
        const units = vm.runInNewContext(`[${unitsArrayMatch[1]}]`, {}, { timeout: 1000 });
        return {
          title: titleMatch ? titleMatch[1] : 'NPTEL Course',
          professor: professorMatch ? professorMatch[1] : '',
          instituteName: instituteMatch ? instituteMatch[1] : '',
          units: Array.isArray(units) ? units : [],
        };
      } catch (err) {
        const unitCount = (script.match(/\{id:\d+,name:"Week \d+"/g) || []).length;
        return {
          title: titleMatch ? titleMatch[1] : 'NPTEL Course',
          professor: professorMatch ? professorMatch[1] : '',
          instituteName: instituteMatch ? instituteMatch[1] : '',
          unitCount,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to extract course outline:', err.message);
  }

  return null;
};

const fetchCoursePage = async (courseUrl, fallbackTitle) => {
  const $ = await fetchHtml(courseUrl);
  const title = cleanNptelTitle(
    safeTrim($('h1').first().text()) ||
      safeTrim($('title').text()) ||
      fallbackTitle ||
      'NPTEL Course'
  );

  return {
    title,
  };
};

const fetchCourseStats = async (courseNumericId) => {
  if (!courseNumericId) return [];

  try {
    const { data } = await axios.get(`https://nptel.ac.in/api/stats/${courseNumericId}`, {
      timeout: 10000,
      headers: REQUEST_HEADERS,
    });

    const statsPayload = Array.isArray(data?.data) ? data.data[0] : null;
    return parseStatsApiRuns(statsPayload);
  } catch (err) {
    console.warn(`Failed to load NPTEL stats for ${courseNumericId}:`, err.message);
    return [];
  }
};

const buildRunPreview = (run) => {
  const announcementCourseCode = buildCourseCodeFromRun(run.courseId || '');
  const year = parseYearFromTimeline(run.timeline || '');
  const semester = determineSemesterFromTimeline(run.timeline || '');

  return {
    timeline: run.timeline || '',
    courseId: run.courseId || '',
    year,
    semester,
    announcementCourseCode,
    announcementsUrl: announcementCourseCode
      ? `https://onlinecourses.nptel.ac.in/${announcementCourseCode}/announcements`
      : '',
  };
};

const getNptelCoursePreview = async ({
  courseNumericId,
  courseUrl,
  courseName,
  institute,
  professor,
}) => {
  const resolvedCourse = await resolveCatalogCourse({
    courseNumericId,
    courseUrl,
    courseName,
    institute,
  });

  if (!resolvedCourse) {
    throw new Error('Unable to locate course on NPTEL');
  }

  const page = await fetchCoursePage(resolvedCourse.courseUrl, resolvedCourse.title);
  const runs = await fetchCourseStats(resolvedCourse.courseNumericId);

  return {
    courseNumericId: resolvedCourse.courseNumericId,
    courseUrl: resolvedCourse.courseUrl,
    title: cleanNptelTitle(page.title || resolvedCourse.title || courseName || 'NPTEL Course'),
    instituteName: resolvedCourse.instituteName || institute || '',
    professor: resolvedCourse.professor || professor || '',
    discipline: resolvedCourse.discipline || '',
    courseType: resolvedCourse.courseType || '',
    runs: runs.map(buildRunPreview),
  };
};

const groupSolutionsByWeek = (solutions = []) => {
  const grouped = new Map();
  solutions.forEach((solution) => {
    const weekNumber = Number(solution.weekNumber || 0);
    if (!Number.isInteger(weekNumber) || weekNumber <= 0) {
      return;
    }
    if (!grouped.has(weekNumber)) grouped.set(weekNumber, []);
    grouped.get(weekNumber).push(solution);
  });
  return grouped;
};

const getOutlineWeekCount = (outline) => {
  if (!outline) return 0;
  if (Array.isArray(outline.units) && outline.units.length > 0) {
    return outline.units.length;
  }
  return outline.unitCount || 0;
};

const buildPlaceholderWeeks = (count = 12) =>
  Array.from({ length: count }, (_, index) => {
    const weekNumber = index + 1;
    return {
      weekNumber,
      title: `Week ${String(weekNumber).padStart(2, '0')}`,
      description: `No assignment solution PDF found yet for Week ${weekNumber}.`,
      topicsOverview: ['Assignment solution branch'],
      materials: [],
      pdfLinks: [],
      pyqLinks: [],
    };
  });

const buildWeeksFromSolutions = (groupedSolutions, expectedWeekCount = 12) => {
  const weekNumbers = Array.from(groupedSolutions.keys()).filter((weekNumber) => weekNumber > 0);
  const highestSolutionWeek = weekNumbers.length ? Math.max(...weekNumbers) : 0;
  const totalWeeks = Math.max(expectedWeekCount, highestSolutionWeek, 1);

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const rawItems = groupedSolutions.get(weekNumber) || [];
    const seenUrls = new Set();
    const items = rawItems.filter((item) => {
      const normalizedUrl = item.driveFileId
        ? convertDriveLink(item.driveFileId)
        : item.driveLink;
      if (!normalizedUrl || seenUrls.has(normalizedUrl)) return false;
      seenUrls.add(normalizedUrl);
      return true;
    });

    return {
      weekNumber,
      title: `Week ${String(weekNumber).padStart(2, '0')}`,
      description: items.length
        ? `Assignment solution PDFs found for Week ${weekNumber}.`
        : `No assignment solution PDF found yet for Week ${weekNumber}.`,
      topicsOverview: items.length
        ? ['Assignment solution PDFs']
        : ['Assignment solution branch'],
      materials: items.map((item, itemIndex) => ({
        title: item.title || `Week ${weekNumber} Solution ${itemIndex + 1}`,
        type: 'solution',
        url: item.driveFileId ? convertDriveLink(item.driveFileId) : item.driveLink,
        fileType: 'pdf',
        uploadedAt: new Date(),
      })),
      pdfLinks: [],
      pyqLinks: [],
    };
  });
};

const importNptelCourse = async ({
  courseName,
  courseCode,
  institute,
  professor,
  courseNumericId,
  courseUrl,
}) => {
  if (!courseName && !courseCode && !courseNumericId && !courseUrl) {
    throw new Error('courseName, courseCode, courseNumericId, or courseUrl is required');
  }

  let instituteName = institute || '';
  let professorName = professor || '';
  let resolvedCourseUrl = courseUrl || '';
  let subjectTitle = courseName || courseCode || 'NPTEL Course';
  let courseCodeNormalized = courseCode ? buildCourseCodeFromRun(courseCode) : '';
  let runs = [];
  let courseTitle = subjectTitle;

  if (!courseCodeNormalized) {
    const preview = await getNptelCoursePreview({
      courseNumericId,
      courseUrl,
      courseName,
      institute,
      professor,
    });

    resolvedCourseUrl = preview.courseUrl;
    courseTitle = preview.title || courseTitle;
    subjectTitle = preview.title || subjectTitle;
    instituteName = preview.instituteName || instituteName;
    professorName = preview.professor || professorName;
    runs = preview.runs.map((run) => ({
      timeline: run.timeline,
      courseId: run.courseId,
    }));

    const latestRun = runs.length ? runs[runs.length - 1] : null;
    courseCodeNormalized = latestRun?.courseId
      ? buildCourseCodeFromRun(latestRun.courseId)
      : '';
  }

  const yearFromCode = (() => {
    const match = courseCodeNormalized.match(/noc(\d{2})/);
    return match ? 2000 + parseInt(match[1], 10) : null;
  })();

  const runsData = [];
  const runsList = runs.length ? runs : [{ timeline: '', courseId: courseCodeNormalized }];

  for (const run of runsList) {
    const runCode = buildCourseCodeFromRun(run.courseId || courseCodeNormalized || '');
    const runYear =
      parseYearFromTimeline(run.timeline || '') || yearFromCode || new Date().getFullYear();
    const runSemester = determineSemesterFromTimeline(run.timeline || '') || 'Jul-Oct';

    let solutions = [];
    if (runCode) {
      const scrape = await scrapeNPTELAnnouncements(runCode);
      if (scrape.success) {
        solutions = scrape.solutions || [];
        if (scrape.courseInfo?.name) {
          subjectTitle = courseName || scrape.courseInfo.name || subjectTitle;
          courseTitle = scrape.courseInfo.name || courseTitle;
        }
      }
    }

    const grouped = groupSolutionsByWeek(solutions);
    let expectedWeekCount = 12;

    if (resolvedCourseUrl) {
      try {
        const html = await fetchText(resolvedCourseUrl);
        const outline = extractCourseOutlineFromPage(html);
        const outlineWeekCount = getOutlineWeekCount(outline);
        if (outlineWeekCount > 0) {
          expectedWeekCount = outlineWeekCount;
        }

        if (outline?.title) {
          const cleanedOutlineTitle = cleanNptelTitle(outline.title);
          courseTitle = cleanedOutlineTitle;
          subjectTitle = courseName || cleanedOutlineTitle || subjectTitle;
        }
        if (outline?.professor && !professorName) {
          professorName = outline.professor;
        }
        if (outline?.instituteName && !instituteName) {
          instituteName = outline.instituteName;
        }
      } catch (err) {
        console.warn('Failed to extract course outline:', err.message);
      }
    }

    const weeks = grouped.size
      ? buildWeeksFromSolutions(grouped, expectedWeekCount)
      : buildPlaceholderWeeks(expectedWeekCount);

    runsData.push({
      courseCode: runCode || courseCodeNormalized || courseTitle,
      year: runYear,
      semester: runSemester,
      totalWeeks: weeks.length,
      status: 'completed',
      syllabus: `${courseTitle} (${runSemester} ${runYear})`,
      weeks,
    });
  }

  const latestRunData = runsData[runsData.length - 1];
  const finalSubjectTitle = cleanNptelTitle(subjectTitle);
  const finalCourseTitle = cleanNptelTitle(courseTitle || finalSubjectTitle);
  const slug = slugify(finalSubjectTitle);

  return {
    subject: {
      name: finalSubjectTitle,
      slug,
    },
    course: {
      title: finalCourseTitle,
      code: (courseCodeNormalized || latestRunData.courseCode || finalSubjectTitle).toUpperCase(),
      description: `${finalSubjectTitle} by ${professorName || 'NPTEL'}`,
      instructors: professorName ? [professorName] : [],
      nptelLink: resolvedCourseUrl && resolvedCourseUrl.includes('nptel.ac.in') ? resolvedCourseUrl : '',
      },
    yearInstance: {
      year: latestRunData.year,
      semester: latestRunData.semester,
      totalWeeks: latestRunData.weeks.length,
      status: 'completed',
      syllabus: `${finalSubjectTitle} (${latestRunData.semester} ${latestRunData.year})`,
    },
    weeks: latestRunData.weeks,
    metadata: {
      institute: instituteName,
      runs,
      courseCode: courseCodeNormalized,
      courseNumericId: courseNumericId || '',
      courseUrl: resolvedCourseUrl,
      runsData,
    },
  };
};

module.exports = {
  fetchCoursesCatalog,
  searchNptelCatalog,
  getNptelCoursePreview,
  importNptelCourse,
};
