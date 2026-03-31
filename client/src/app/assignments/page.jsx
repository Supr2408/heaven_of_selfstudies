'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import AssignmentExtractor from '@/components/AssignmentExtractor';
import Link from 'next/link';
import { assignmentAPI } from '@/lib/api';

export default function AssignmentsPage() {
  const [allAssignments, setAllAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showExtractor, setShowExtractor] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // list or extract

  useEffect(() => {
    fetchAllAssignments();
  }, []);

  const fetchAllAssignments = async () => {
    try {
      setLoading(true);
      const data = await assignmentAPI.getAllAssignments();
      setAllAssignments(data.assignments || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (courseCode) => {
    if (confirm('Are you sure you want to delete these assignments?')) {
      try {
        await assignmentAPI.deleteAssignments(courseCode);
        alert('Assignments deleted successfully');
        setAllAssignments(
          allAssignments.filter((a) => a.courseCode !== courseCode)
        );
      } catch (error) {
        alert('Error deleting assignments: ' + error.message);
      }
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            📚 NPTEL Previous Year Solutions
          </h1>
          <p className="text-lg text-slate-600">
            Extract and practice with previous year assignments from NPTEL courses
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 My Courses ({allAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('extract')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'extract'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus size={18} className="inline mr-1" />
            Extract New Course
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' ? (
          /* Assignments List */
          <div>
            {loading ? (
              <div className="text-center py-12 text-slate-600">
                Loading assignments...
              </div>
            ) : allAssignments.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                <BookOpen size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 font-medium mb-4">
                  No courses extracted yet
                </p>
                <button
                  onClick={() => setActiveTab('extract')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  Extract Your First Course
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allAssignments.map((course) => (
                  <div
                    key={course.courseCode}
                    className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Course Header */}
                    <div className="mb-4 pb-4 border-b border-slate-200">
                      <h3 className="font-semibold text-slate-900 text-lg mb-1">
                        {course.courseName}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {course.courseCode}
                      </p>
                    </div>

                    {/* Course Details */}
                    <div className="space-y-2 mb-4 text-sm text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-900">
                          Semester:
                        </span>{' '}
                        {course.semester}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">
                          Year:
                        </span>{' '}
                        {course.year}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">
                          Solutions:
                        </span>{' '}
                        {course.totalSolutions}
                      </p>
                      <p className="text-xs text-slate-500 pt-2">
                        Updated:{' '}
                        {new Date(course.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/assignments/${course.courseCode}`}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center text-sm"
                      >
                        View Solutions
                      </Link>
                      <button
                        onClick={() => handleDelete(course.courseCode)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Extractor */
          <AssignmentExtractor />
        )}
      </div>
    </MainLayout>
  );
}
