'use client';

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import AssignmentViewer from '@/components/AssignmentViewer';
import Link from 'next/link';
import { assignmentAPI } from '@/lib/api';

export default function CourseAssignmentsPage({ params }) {
  const [courseCode] = useState(params?.courseCode || '');
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCourseAssignments = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await assignmentAPI.getAssignments(courseCode);
        setCourseData(data);
        if (data.solutions && data.solutions.length > 0) {
          setSelectedWeek(data.solutions[0].weekNumber);
        }
      } catch (err) {
        setError(err?.data?.error || err.message || 'Course not found');
      } finally {
        setLoading(false);
      }
    };

    if (courseCode) {
      fetchCourseAssignments();
    }
  }, [courseCode]);

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto py-12 text-center">
          <p className="text-slate-600">Loading course assignments...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !courseData) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto py-12 text-center">
          <p className="text-red-600 font-semibold">{error || 'Course not found'}</p>
          <Link
            href="/assignments"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Assignments
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-slate-600">
          <Link href="/assignments" className="hover:text-blue-600">
            Assignments
          </Link>
          <ChevronRight size={18} />
          <span className="text-slate-900 font-medium">{courseData.courseName}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            {courseData.courseName}
          </h1>
          <div className="flex gap-4 text-slate-600">
            <p>
              <span className="font-semibold">Code:</span> {courseCode}
            </p>
            <p>
              <span className="font-semibold">Semester:</span> {courseData.semester}
            </p>
            <p>
              <span className="font-semibold">Year:</span> {courseData.year}
            </p>
            <p>
              <span className="font-semibold">Solutions:</span>{' '}
              {courseData.totalSolutions}
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assignment List Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm sticky top-6">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">
                  Solutions ({courseData.totalSolutions})
                </h3>
              </div>

              <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
                {courseData.solutions
                  .sort((a, b) => a.weekNumber - b.weekNumber)
                  .map((solution) => (
                    <button
                      key={solution.weekNumber}
                      onClick={() => setSelectedWeek(solution.weekNumber)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                        selectedWeek === solution.weekNumber
                          ? 'bg-blue-50 border-l-4 border-blue-600'
                          : ''
                      }`}
                    >
                      <p className="font-medium text-slate-900">
                        {solution.assignmentNumber}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Week {solution.weekNumber}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Assignment Viewer */}
          <div className="lg:col-span-2">
            {selectedWeek !== null ? (
              <AssignmentViewer
                key={`${courseCode}-${selectedWeek}`}
                courseCode={courseCode}
                weekNumber={selectedWeek}
              />
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600">Select an assignment to view</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-slate-700">
            💡 <strong>Note:</strong> These are previous year solutions extracted from NPTEL
            announcements. Use them as a reference while solving your assignments. Discuss any
            doubts with other students below each solution.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
