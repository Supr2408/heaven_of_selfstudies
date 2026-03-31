'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Users, Clock, AlertCircle, Search, ArrowRight } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import useStore from '@/store/useStore';
import { yearInstanceAPI, courseAPI } from '@/lib/api';

export default function Dashboard() {
  const store = useStore();
  const router = useRouter();
  const bumpContentVersion = useStore((state) => state.bumpContentVersion);
  const [yearInstances, setYearInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importForm, setImportForm] = useState({ courseName: '', institute: '', professor: '' });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalWeeks: 0,
    communityMembers: 0,
  });

  const fetchYearInstances = async () => {
    try {
      setLoading(true);
      const response = await yearInstanceAPI.getAllYearInstances();
      if (response && response.data) {
        setYearInstances(response.data);
        setStats((prev) => ({
          ...prev,
          totalCourses: new Set(
            response.data.map((yi) =>
              typeof yi.courseId === 'string' ? yi.courseId : yi.courseId?._id
            )
          ).size,
          totalWeeks: response.data.reduce((sum, yi) => sum + (yi.totalWeeks || 0), 0),
        }));
      }
    } catch (err) {
      setError('Failed to load courses. Please try again later.');
      console.error('Error fetching year instances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYearInstances();
  }, []);

  const handleViewMaterials = (instance) => {
    router.push(`/dashboard/week?yearInstanceId=${instance._id}`);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportMessage('');
    setError(null);

    if (!importForm.courseName.trim()) {
      setError('Course name is required.');
      return;
    }

    try {
      setImporting(true);
      const response = await courseAPI.importNptelCourse(importForm);
      bumpContentVersion();
      setImportMessage('Course imported successfully.');
      setImportForm({ courseName: '', institute: '', professor: '' });
      await fetchYearInstances();

      const navigation = response?.data?.navigation;
      if (navigation?.latestWeekId) {
        router.push(`/dashboard/week?weekId=${navigation.latestWeekId}`);
      }
    } catch (err) {
      console.error('Import failed', err);
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 rounded-lg border border-sky-200 bg-sky-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Search NPTEL like the real site flow</h2>
              <p className="mt-1 text-sm text-slate-600">
                Use the dedicated search page to find a course, inspect its statistics runs,
                derive the announcement course code automatically, and import it into the same
                branch structure as Cloud Computing.
              </p>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Search size={16} />
              Open Course Search
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Import NPTEL Course */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">Import NPTEL Course</h2>
            <p className="text-sm text-slate-600">Provide course name, institute, and professor to fetch announcements and solutions (links only).</p>
          </div>
          <form onSubmit={handleImport} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Course name"
              value={importForm.courseName}
              onChange={(e) => setImportForm({ ...importForm, courseName: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Institute (optional)"
              value={importForm.institute}
              onChange={(e) => setImportForm({ ...importForm, institute: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Professor (optional)"
              value={importForm.professor}
              onChange={(e) => setImportForm({ ...importForm, professor: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="md:col-span-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={importing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Import Course'}
              </button>
              {importMessage && (
                <span className="text-sm text-green-700">{importMessage}</span>
              )}
            </div>
          </form>
        </div>

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-8 mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {store.user?.name || 'Learner'}! 👋</h1>
          <p className="text-blue-100">Explore NPTEL courses and materials</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Available Courses</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalCourses}</p>
              </div>
              <BookOpen size={40} className="text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Weeks</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalWeeks}</p>
              </div>
              <Clock size={40} className="text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Study Resources</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">Unlimited</p>
              </div>
              <Users size={40} className="text-purple-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Available Courses */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Available Year Instances</h2>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-200 rounded-lg p-6 h-24 animate-pulse" />
              ))}
            </div>
          ) : yearInstances.length > 0 ? (
            <div className="space-y-4">
              {yearInstances.map((instance) => (
                <div
                  key={instance._id}
                  className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Year {instance.year} - {instance.semester}
                      </h3>
                      <p className="text-sm text-slate-600 mt-2">{instance.totalWeeks} weeks • Status: {instance.status}</p>
                      {instance.syllabus && <p className="text-sm text-slate-700 mt-2">{instance.syllabus}</p>}
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {instance.status}
                    </span>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => handleViewMaterials(instance)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View Materials
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-8 text-center border border-slate-200">
              <p className="text-slate-600">No courses available yet. Check back soon!</p>
            </div>
          )}
        </div>

        {/* Footer Message */}
        <div className="mt-12 text-center p-8 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-slate-700">
            💡 Use the sidebar to browse subjects and courses with extracted materials and notes
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
