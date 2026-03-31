'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Home, BookOpen, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { courseAPI, yearInstanceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const SEMESTER_MONTHS = {
  'Jan-Apr': ['January', 'February', 'March', 'April'],
  'Jul-Oct': ['July', 'August', 'September', 'October'],
  'July-Oct': ['July', 'August', 'September', 'October'],
  'Aug-Oct': ['August', 'September', 'October'],
};

const getSemesterMonths = (semester) => SEMESTER_MONTHS[semester] || ['General'];

const groupWeeksByMonth = (weeks = [], semester) => {
  if (!weeks.length) return [];

  const months = getSemesterMonths(semester);
  const sortedWeeks = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const weeksPerMonth = Math.max(1, Math.ceil(sortedWeeks.length / months.length));

  return months
    .map((month, index) => {
      const start = index * weeksPerMonth;
      const end = start + weeksPerMonth;
      return {
        month,
        weeks: sortedWeeks.slice(start, end),
      };
    })
    .filter((bucket) => bucket.weeks.length > 0);
};

export default function Sidebar() {
  const router = useRouter();
  const {
    sidebarOpen,
    selectedWeek,
    contentVersion,
    setSelectedSubject,
    setSelectedCourse,
    setSelectedYear,
    setSelectedWeek,
  } = useStore((state) => ({
    sidebarOpen: state.sidebarOpen,
    selectedWeek: state.selectedWeek,
    contentVersion: state.contentVersion,
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
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        const response = await courseAPI.getAllSubjects();
        setSubjects(response.data || []);
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
        setError('Unable to load subjects right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [contentVersion]);

  // Helper loaders ---------------------------------------------------------
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
    const data = (response.data || []).sort((a, b) => a.weekNumber - b.weekNumber);
    setWeeksByInstance((prev) => ({ ...prev, [instanceId]: data }));
    return data;
  };

  // Interaction handlers ---------------------------------------------------
  const handleSubjectClick = async (subject) => {
    if (expandedSubject === subject._id) {
      setExpandedSubject(null);
      setExpandedCourse(null);
      setExpandedYearInstance(null);
      return;
    }

    try {
      setLoading(true);
      await loadCoursesForSubject(subject._id);
      setExpandedSubject(subject._id);
      setExpandedCourse(null);
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
      await loadInstancesForCourse(course._id);
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
    router.push(`/dashboard/week?weekId=${week._id}`);
  };

  // ------------------------------------------------------------------------
  return (
    <aside
      className={`fixed left-0 top-0 h-screen ${
        sidebarOpen ? 'w-64' : 'w-20'
      } bg-slate-900 text-white transition-all duration-300 overflow-y-auto z-40`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">
              NH
            </div>
            <span className="font-bold text-lg">NPTEL Hub</span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="p-4 space-y-2">
        <Link href="/dashboard">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            {sidebarOpen && (
              <div className="flex items-center gap-2 flex-1">
                <Home size={18} />
                <span className="text-sm font-medium">Dashboard</span>
              </div>
            )}
            {!sidebarOpen && <Home size={18} />}
          </div>
        </Link>

        <Link href="/courses">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            {sidebarOpen && (
              <div className="flex items-center gap-2 flex-1">
                <BookOpen size={18} />
                <span className="text-sm font-medium">Courses</span>
              </div>
            )}
            {!sidebarOpen && <BookOpen size={18} />}
          </div>
        </Link>

        <Link href="/assignments">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            {sidebarOpen && (
              <div className="flex items-center gap-2 flex-1">
                <FileText size={18} />
                <span className="text-sm font-medium">Solutions</span>
              </div>
            )}
            {!sidebarOpen && <FileText size={18} />}
          </div>
        </Link>

        {sidebarOpen && <div className="border-t border-slate-700 my-2" />}

        {loading && sidebarOpen && (
          <div className="text-xs text-slate-400">Loading latest structure…</div>
        )}

        {error && sidebarOpen && (
          <div className="text-xs text-red-300">{error}</div>
        )}

        {subjects.map((subject) => {
          const subjectCourses = coursesBySubject[subject._id] || [];
          return (
            <div key={subject._id}>
              <button
                onClick={() => handleSubjectClick(subject)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {sidebarOpen ? (
                  <>
                    <span className="text-sm font-medium truncate">{subject.name}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${
                        expandedSubject === subject._id ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                ) : (
                  <span className="text-lg" role="img" aria-label={subject.name}>
                    {subject.icon || '📚'}
                  </span>
                )}
              </button>

              {expandedSubject === subject._id && sidebarOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {subjectCourses.length === 0 && !loading ? (
                    <div className="text-xs text-slate-400 px-3 py-1">No courses yet</div>
                  ) : (
                    subjectCourses.map((course) => {
                      const courseInstances = instancesByCourse[course._id] || [];
                      return (
                        <div key={course._id}>
                          <button
                            onClick={() => handleCourseClick(course, subject)}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded text-xs hover:bg-slate-700 transition-colors"
                          >
                            <span className="truncate">{course.title}</span>
                            <ChevronDown
                              size={14}
                              className={`transition-transform flex-shrink-0 ${
                                expandedCourse === course._id ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {expandedCourse === course._id && (
                            <div className="ml-3 mt-1 space-y-1 border-l border-slate-800 pl-2">
                              {courseInstances.length === 0 && !loading ? (
                                <div className="text-xs text-slate-500 px-2 py-1">
                                  Batches coming soon
                                </div>
                              ) : (
                                courseInstances.map((instance) => {
                                  const weeks = weeksByInstance[instance._id] || [];
                                  const monthBuckets = groupWeeksByMonth(weeks, instance.semester);

                                  return (
                                    <div key={instance._id} className="space-y-1">
                                      <button
                                        onClick={() =>
                                          handleYearInstanceClick(instance, course, subject)
                                        }
                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
                                          expandedYearInstance === instance._id
                                            ? 'bg-slate-800 text-white'
                                            : 'hover:bg-slate-800 text-slate-200'
                                        }`}
                                      >
                                        <span>
                                          {instance.year} • {instance.semester}
                                        </span>
                                        <ChevronRight
                                          size={12}
                                          className={`transition-transform ${
                                            expandedYearInstance === instance._id
                                              ? 'rotate-90'
                                              : ''
                                          }`}
                                        />
                                      </button>

                                      {expandedYearInstance === instance._id && (
                                        <div className="ml-3 space-y-1 border-l border-slate-800 pl-2">
                                          {weeks.length === 0 && !loading ? (
                                            <div className="text-xs text-slate-500 px-2 py-1">
                                              Weeks will appear once downloaded
                                            </div>
                                          ) : (
                                            monthBuckets.map((bucket) => {
                                              const monthKey = `${instance._id}-${bucket.month}`;
                                              const isExpanded = expandedMonths[monthKey];

                                              return (
                                                <div key={monthKey} className="space-y-1">
                                                  <button
                                                    onClick={() => handleMonthToggle(instance._id, bucket.month)}
                                                    className="w-full flex items-center justify-between px-3 py-1 rounded text-[11px] uppercase tracking-wide text-slate-300 hover:bg-slate-800"
                                                  >
                                                    <span>{bucket.month}</span>
                                                    <ChevronDown
                                                      size={12}
                                                      className={`transition-transform ${
                                                        isExpanded ? 'rotate-180' : ''
                                                      }`}
                                                    />
                                                  </button>

                                                  {isExpanded && (
                                                    <div className="ml-3 space-y-1">
                                                      {bucket.weeks.map((week) => {
                                                        const isSelected =
                                                          selectedWeek?._id === week._id;
                                                        return (
                                                          <button
                                                            key={week._id}
                                                            onClick={() =>
                                                              handleWeekSelect(
                                                                week,
                                                                course,
                                                                instance,
                                                                subject,
                                                              )
                                                            }
                                                            className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                                                              isSelected
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-slate-200 hover:bg-slate-800'
                                                            }`}
                                                          >
                                                            <div className="font-medium">
                                                              Week {week.weekNumber}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 truncate">
                                                              {week.title}
                                                            </div>
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
