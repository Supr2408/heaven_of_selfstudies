'use client';

const LAST_VIEWED_COURSE_KEY = 'nptel-last-viewed-course';

const isBrowser = () => typeof window !== 'undefined';

const normalizeRecentCourse = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const courseId = typeof value.courseId === 'string' ? value.courseId : '';
  const yearInstanceId = typeof value.yearInstanceId === 'string' ? value.yearInstanceId : '';

  if (!courseId && !yearInstanceId) {
    return null;
  }

  return {
    courseId,
    courseTitle: typeof value.courseTitle === 'string' ? value.courseTitle : '',
    yearInstanceId,
    year: Number.isFinite(Number(value.year)) ? Number(value.year) : null,
    semester: typeof value.semester === 'string' ? value.semester : '',
    weekId: typeof value.weekId === 'string' ? value.weekId : '',
    weekTitle: typeof value.weekTitle === 'string' ? value.weekTitle : '',
    savedAt: Number.isFinite(Number(value.savedAt)) ? Number(value.savedAt) : Date.now(),
  };
};

export const readLastViewedCourse = () => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(LAST_VIEWED_COURSE_KEY);
    if (!rawValue) {
      return null;
    }

    return normalizeRecentCourse(JSON.parse(rawValue));
  } catch {
    return null;
  }
};

export const saveLastViewedCourse = (value) => {
  if (!isBrowser()) {
    return null;
  }

  const normalizedValue = normalizeRecentCourse({
    ...value,
    savedAt: Date.now(),
  });

  if (!normalizedValue) {
    return null;
  }

  try {
    window.localStorage.setItem(LAST_VIEWED_COURSE_KEY, JSON.stringify(normalizedValue));
  } catch {
    return null;
  }

  return normalizedValue;
};
