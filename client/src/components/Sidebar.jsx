'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Home, BookOpen, MessageSquare, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { courseAPI, yearInstanceAPI } from '@/lib/api';
import {
  getAvailabilityMeta,
  getSemesterMonths,
  groupWeeksByMonth,
  hasWeekStudyContent,
  normalizeVisibleWeeks,
  summarizeWeeksAvailability,
} from '@/lib/contentAvailability';
import { isAdminUser } from '@/lib/user';
import useStore from '@/store/useStore';

const normalizeSidebarLabel = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const dedupeByLabel = (items = [], getLabel = () => '') => {
  const seen = new Set();

  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = normalizeSidebarLabel(getLabel(item));
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getCourseInstitute = (course, subject) => {
  const directInstitute = course?.institute || course?.instituteName || '';
  if (directInstitute) return directInstitute;

  const subjectDescription = subject?.description || course?.subjectId?.description || '';
  return /iit|indian institute/i.test(subjectDescription) ? subjectDescription : '';
};

const getCourseProfessor = (course) => {
  if (course?.professor) return course.professor;
  if (Array.isArray(course?.instructors) && course.instructors.length) {
    return course.instructors.filter(Boolean).join(', ');
  }
  return '';
};

const getCourseIdentityKey = (course, subject) => {
  const visibleIdentity = [
    normalizeSidebarLabel(course?.title),
    normalizeSidebarLabel(getCourseInstitute(course, subject)),
    normalizeSidebarLabel(getCourseProfessor(course)),
  ]
    .filter(Boolean)
    .join('|');

  return visibleIdentity || course?.nptelLink || course?.code || course?._id || '';
};

const dedupeCoursesByIdentity = (items = [], subject = null) => {
  const seen = new Set();

  return (Array.isArray(items) ? items : []).filter((course) => {
    const key = getCourseIdentityKey(course, subject);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getCourseSubtitle = (course, subject) => {
  const details = [getCourseInstitute(course, subject), getCourseProfessor(course)].filter(Boolean);
  return details.length ? details.join(' - ') : course?.code || '';
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    sidebarOpen,
    selectedWeek,
    user,
    contentVersion,
    setSidebarOpen,
    setSelectedSubject,
    setSelectedCourse,
    setSelectedYear,
    setSelectedWeek,
  } = useStore((state) => ({
    sidebarOpen: state.sidebarOpen,
    selectedWeek: state.selectedWeek,
    user: state.user,
    contentVersion: state.contentVersion,
    setSidebarOpen: state.setSidebarOpen,
    setSelectedSubject: state.setSelectedSubject,
    setSelectedCourse: state.setSelectedCourse,
    setSelectedYear: state.setSelectedYear,
    setSelectedWeek: state.setSelectedWeek,
  }));

  const [subjects, setSubjects] = useState([]);
  const [coursesBySubject, setCoursesBySubject] = useState({});
  const [instancesByCourse, setInstancesByCourse] = useState({});
  const [weeksByInstance, setWeeksByInstance] = useState({});
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedYearInstance, setExpandedYearInstance] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeCourseDiscussionId =
    pathname === '/dashboard/discussion' ? searchParams?.get('courseId') || '' : '';
  const isAdminRoute = pathname === '/dashboard/admin';

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        const response = await courseAPI.getAllSubjects();
        setSubjects(dedupeByLabel(response.data || [], (subject) => subject?.name));
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
        setError('Unable to load subjects right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [contentVersion]);

  const loadCoursesForSubject = async (subjectId) => {
    if (coursesBySubject[subjectId]) {
      return coursesBySubject[subjectId];
    }

    const response = await courseAPI.getCoursesBySubject(subjectId);
    const data = response.data || [];
    setCoursesBySubject((prev) => ({ ...prev, [subjectId]: data }));
    return data;
  };

  const loadInstancesForCourse = async (courseId) => {
    if (instancesByCourse[courseId]) {
      return instancesByCourse[courseId];
    }

    const response = await yearInstanceAPI.getYearInstances(courseId);
    const data = response.data || [];
    setInstancesByCourse((prev) => ({ ...prev, [courseId]: data }));
    return data;
  };

  const loadWeeksForInstance = async (instanceId) => {
    if (weeksByInstance[instanceId]) {
      return weeksByInstance[instanceId];
    }

    const response = await yearInstanceAPI.getWeeks(instanceId);
    const data = normalizeVisibleWeeks(response.data || []);
    setWeeksByInstance((prev) => ({ ...prev, [instanceId]: data }));
    return data;
  };

  const handleSubjectClick = async (subject) => {
    if (expandedSubject === subject._id) {
      setExpandedSubject(null);
      setExpandedCourse(null);
      setExpandedYearInstance(null);
      return;
    }

    try {
      setLoading(true);
      const loadedCourses = dedupeCoursesByIdentity(
        await loadCoursesForSubject(subject._id),
        subject
      );
      const matchingCourse =
        loadedCourses.find(
          (course) =>
            normalizeSidebarLabel(course?.title) === normalizeSidebarLabel(subject?.name)
        ) || null;

      if (matchingCourse?._id) {
        const instances = await loadInstancesForCourse(matchingCourse._id);
        await Promise.all(instances.map((instance) => loadWeeksForInstance(instance._id)));
        setExpandedCourse(matchingCourse._id);
      } else {
        setExpandedCourse(null);
      }

      setExpandedSubject(subject._id);
      setExpandedYearInstance(null);
      setSelectedSubject(subject);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setError('Unable to load courses for this subject.');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = async (course, subject) => {
    if (expandedCourse === course._id) {
      setExpandedCourse(null);
      setExpandedYearInstance(null);
      return;
    }

    try {
      setLoading(true);
      const instances = await loadInstancesForCourse(course._id);
      await Promise.all(instances.map((instance) => loadWeeksForInstance(instance._id)));
      setExpandedCourse(course._id);
      setExpandedYearInstance(null);
      setSelectedSubject(subject);
      setSelectedCourse(course);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch year instances:', err);
      setError('Unable to load batches for this course.');
    } finally {
      setLoading(false);
    }
  };

  const handleYearInstanceClick = async (instance, course, subject) => {
    if (expandedYearInstance === instance._id) {
      setExpandedYearInstance(null);
      return;
    }

    try {
      setLoading(true);
      await loadWeeksForInstance(instance._id);
      setExpandedYearInstance(instance._id);
      setSelectedSubject(subject);
      setSelectedCourse(course);
      setSelectedYear(instance);
      setError(null);

      const firstMonth = getSemesterMonths(instance.semester)[0];
      if (firstMonth) {
        setExpandedMonths((prev) => ({
          ...prev,
          [`${instance._id}-${firstMonth}`]: true,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch weeks:', err);
      setError('Unable to load weeks for this year.');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthToggle = (instanceId, month) => {
    const key = `${instanceId}-${month}`;
    setExpandedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleWeekSelect = (week, course, instance, subject) => {
    setSelectedSubject(subject);
    setSelectedCourse(course);
    setSelectedYear(instance);
    setSelectedWeek(week);
    closeSidebarOnMobile();
    router.push(`/dashboard/week?weekId=${week._id}`);
  };

  const handleCourseDiscussionSelect = (course, subject) => {
    setSelectedSubject(subject);
    setSelectedCourse(course);
    setSelectedYear(null);
    setSelectedWeek(null);
    closeSidebarOnMobile();
    router.push(
      `/dashboard/discussion?courseId=${course._id}&courseTitle=${encodeURIComponent(course.title || '')}`
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen overflow-y-auto bg-slate-900 text-white transition-all duration-300 md:translate-x-0 ${
        sidebarOpen
          ? 'w-[min(85vw,20rem)] translate-x-0 md:w-64'
          : 'w-[min(85vw,20rem)] -translate-x-full md:w-20'
      }`}
    >
      <div className="border-b border-slate-700 p-4">
        {sidebarOpen ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold">
                NH
              </div>
              <span className="text-lg font-bold">NPTEL Hub</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 md:hidden"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-2 md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold">
              NH
            </div>
          </div>
        )}
      </div>

      <nav className="space-y-2 p-4">
        <Link href="/dashboard" onClick={closeSidebarOnMobile}>
          <div className="cursor-pointer rounded-lg px-3 py-2 transition-colors hover:bg-slate-800">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <Home size={18} />
                <span className="text-sm font-medium">Dashboard</span>
              </div>
            ) : (
              <Home size={18} />
            )}
          </div>
        </Link>

        <Link href="/courses" onClick={closeSidebarOnMobile}>
          <div className="cursor-pointer rounded-lg px-3 py-2 transition-colors hover:bg-slate-800">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <BookOpen size={18} />
                <span className="text-sm font-medium">Courses</span>
              </div>
            ) : (
              <BookOpen size={18} />
            )}
          </div>
        </Link>

        <Link href="/assignments" onClick={closeSidebarOnMobile}>
          <div className="cursor-pointer rounded-lg px-3 py-2 transition-colors hover:bg-slate-800">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <MessageSquare size={18} />
                <span className="text-sm font-medium">Discussion</span>
              </div>
            ) : (
              <MessageSquare size={18} />
            )}
          </div>
        </Link>

        {isAdminUser(user) ? (
          <Link href="/dashboard/admin" onClick={closeSidebarOnMobile}>
            <div
              className={`cursor-pointer rounded-lg px-3 py-2 transition-colors ${
                isAdminRoute ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'
              }`}
            >
              {sidebarOpen ? (
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} />
                  <span className="text-sm font-medium">Admin Review</span>
                </div>
              ) : (
                <MessageSquare size={18} />
              )}
            </div>
          </Link>
        ) : null}

        {sidebarOpen ? <div className="my-2 border-t border-slate-700" /> : null}

        {loading && sidebarOpen ? (
          <div className="text-xs text-slate-400">Loading latest structure...</div>
        ) : null}

        {error && sidebarOpen ? (
          <div className="text-xs text-red-300">{error}</div>
        ) : null}

        {sidebarOpen ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-300">
            <div className="flex flex-wrap items-center gap-3">
              {['full', 'partial', 'none'].map((status) => {
                const meta = getAvailabilityMeta(status);
                return (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <span className={`h-3 w-3 rounded-full ${meta.dotClass}`} />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {subjects.map((subject) => {
          const subjectCourses = dedupeCoursesByIdentity(
            coursesBySubject[subject._id] || [],
            subject
          );

          return (
            <div key={subject._id}>
              <button
                onClick={() => handleSubjectClick(subject)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-slate-800"
              >
                {sidebarOpen ? (
                  <>
                    <span className="truncate text-sm font-medium">{subject.name}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${
                        expandedSubject === subject._id ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                ) : (
                  <span className="text-lg" role="img" aria-label={subject.name}>
                    {subject.icon || 'S'}
                  </span>
                )}
              </button>

              {expandedSubject === subject._id && sidebarOpen ? (
                <div className="ml-4 mt-1 space-y-1">
                  {subjectCourses.length === 0 && !loading ? (
                    <div className="px-3 py-1 text-xs text-slate-400">No courses yet</div>
                  ) : (
                    subjectCourses.map((course) => {
                      const courseInstances = instancesByCourse[course._id] || [];
                      const courseSubtitle = getCourseSubtitle(course, subject);

                      return (
                        <div key={course._id}>
                          <button
                            onClick={() => handleCourseClick(course, subject)}
                            className="flex w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-xs transition-colors hover:bg-slate-700"
                          >
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block truncate font-medium">{course.title}</span>
                              {courseSubtitle ? (
                                <span className="block truncate text-[10px] text-slate-400">
                                  {courseSubtitle}
                                </span>
                              ) : null}
                            </span>
                            <ChevronDown
                              size={14}
                              className={`flex-shrink-0 transition-transform ${
                                expandedCourse === course._id ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {expandedCourse === course._id ? (
                            <div className="ml-3 mt-1 space-y-1 border-l border-slate-800 pl-2">
                              <button
                                onClick={() => handleCourseDiscussionSelect(course, subject)}
                                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs transition-colors ${
                                  activeCourseDiscussionId === course._id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <MessageSquare size={13} />
                                  Discussion
                                </span>
                                <ChevronRight size={12} />
                              </button>

                              {courseInstances.length === 0 && !loading ? (
                                <div className="px-2 py-1 text-xs text-slate-500">
                                  Batches coming soon
                                </div>
                              ) : (
                                courseInstances.map((instance) => {
                                  const weeks = weeksByInstance[instance._id] || [];
                                  const monthBuckets = groupWeeksByMonth(weeks, instance.semester);
                                  const runSummary = summarizeWeeksAvailability(weeks);
                                  const runMeta = getAvailabilityMeta(runSummary.status);

                                  return (
                                    <div key={instance._id} className="space-y-1">
                                      <button
                                        onClick={() =>
                                          handleYearInstanceClick(instance, course, subject)
                                        }
                                        className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-xs transition-colors ${
                                          expandedYearInstance === instance._id
                                            ? 'bg-slate-800 text-white'
                                            : 'text-slate-200 hover:bg-slate-800'
                                        }`}
                                      >
                                        <span className="inline-flex min-w-0 items-center gap-2">
                                          <span className={`h-3 w-3 rounded-full ${runMeta.dotClass}`} />
                                          <span className="truncate">
                                            {instance.year} - {instance.semester}
                                          </span>
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                          {weeks.length ? (
                                            <span
                                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${runMeta.badgeClass}`}
                                            >
                                              {runSummary.availableWeeks}/{runSummary.totalWeeks}
                                            </span>
                                          ) : null}
                                          <ChevronRight
                                            size={12}
                                            className={`transition-transform ${
                                              expandedYearInstance === instance._id
                                                ? 'rotate-90'
                                                : ''
                                            }`}
                                          />
                                        </span>
                                      </button>

                                      {expandedYearInstance === instance._id ? (
                                        <div className="ml-3 space-y-1 border-l border-slate-800 pl-2">
                                          {weeks.length === 0 && !loading ? (
                                            <div className="px-2 py-1 text-xs text-slate-500">
                                              Weeks will appear once downloaded
                                            </div>
                                          ) : (
                                            monthBuckets.map((bucket) => {
                                              const monthKey = `${instance._id}-${bucket.month}`;
                                              const isExpanded = expandedMonths[monthKey];
                                              const bucketMeta = getAvailabilityMeta(bucket.status);

                                              return (
                                                <div key={monthKey} className="space-y-1">
                                                  <button
                                                    onClick={() => handleMonthToggle(instance._id, bucket.month)}
                                                    className="flex w-full items-center justify-between rounded px-3 py-1 text-[11px] uppercase tracking-wide text-slate-300 hover:bg-slate-800"
                                                  >
                                                    <span className="inline-flex items-center gap-2">
                                                      <span className={`h-2.5 w-2.5 rounded-full ${bucketMeta.dotClass}`} />
                                                      <span>{bucket.month}</span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-2">
                                                      <span
                                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${bucketMeta.badgeClass}`}
                                                      >
                                                        {bucket.availableWeeks}/{bucket.totalWeeks}
                                                      </span>
                                                      <ChevronDown
                                                        size={12}
                                                        className={`transition-transform ${
                                                          isExpanded ? 'rotate-180' : ''
                                                        }`}
                                                      />
                                                    </span>
                                                  </button>

                                                  {isExpanded ? (
                                                    <div className="ml-3 space-y-1">
                                                      {bucket.weeks.map((week) => {
                                                        const isSelected =
                                                          selectedWeek?._id === week._id;
                                                        const hasContent = hasWeekStudyContent(week);

                                                        return (
                                                          <button
                                                            key={week._id}
                                                            onClick={() =>
                                                              handleWeekSelect(
                                                                week,
                                                                course,
                                                                instance,
                                                                subject
                                                              )
                                                            }
                                                            className={`w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
                                                              isSelected
                                                                ? 'bg-blue-600 text-white'
                                                                : hasContent
                                                                  ? 'text-slate-100 hover:bg-slate-800'
                                                                  : 'text-slate-300 hover:bg-slate-800'
                                                            }`}
                                                          >
                                                            <div className="flex items-center gap-2 font-medium">
                                                              <span
                                                                className={`h-2 w-2 rounded-full ${
                                                                  hasContent ? 'bg-emerald-400' : 'bg-rose-400'
                                                                }`}
                                                              />
                                                              Week {week.weekNumber}
                                                            </div>
                                                            <div className="mt-0.5 truncate text-[11px] text-slate-400">
                                                              {week.title}
                                                            </div>
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  ) : null}
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
