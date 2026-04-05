'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CourseDiscussionBoard from '@/components/CourseDiscussionBoard';
import { yearInstanceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const sortInstances = (instances = []) =>
  [...instances].sort((a, b) => {
    if ((b?.year || 0) !== (a?.year || 0)) {
      return (b?.year || 0) - (a?.year || 0);
    }
    return String(a?.semester || '').localeCompare(String(b?.semester || ''));
  });

function CourseDiscussionPageContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams?.get('courseId') || '';
  const fallbackCourseTitle = searchParams?.get('courseTitle') || '';
  const { setSelectedCourse, setSelectedYear, setSelectedWeek } = useStore((state) => ({
    setSelectedCourse: state.setSelectedCourse,
    setSelectedYear: state.setSelectedYear,
    setSelectedWeek: state.setSelectedWeek,
  }));

  const [yearInstances, setYearInstances] = useState([]);
  const [courseTitle, setCourseTitle] = useState(fallbackCourseTitle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourseContext = async () => {
      if (!courseId) {
        setYearInstances([]);
        setLoading(false);
        setError('Choose a course discussion branch from the sidebar.');
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await yearInstanceAPI.getYearInstances(courseId);
        const instances = sortInstances(response?.data || []);
        setYearInstances(instances);

        const resolvedCourse = instances[0]?.courseId || null;
        const nextTitle =
          resolvedCourse?.title ||
          resolvedCourse?.courseName ||
          resolvedCourse?.name ||
          fallbackCourseTitle ||
          'Course discussion';
        setCourseTitle(nextTitle);
        setSelectedCourse(resolvedCourse || { _id: courseId, title: nextTitle });
        setSelectedYear(null);
        setSelectedWeek(null);
      } catch {
        setError('Unable to load this course branch right now.');
      } finally {
        setLoading(false);
      }
    };

    loadCourseContext();
  }, [courseId, fallbackCourseTitle, setSelectedCourse, setSelectedWeek, setSelectedYear]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
        Loading course discussion branch...
      </div>
    );
  }

  if (error && !courseId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center text-amber-700 shadow-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <CourseDiscussionBoard
        courseId={courseId}
        courseTitle={courseTitle}
        yearInstances={yearInstances}
      />
    </div>
  );
}

export default function CourseDiscussionPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          Loading course discussion branch...
        </div>
      }
    >
      <CourseDiscussionPageContent />
    </Suspense>
  );
}
