'use client';

import { useState } from 'react';
import { Download, Link as LinkIcon, MessageCircle, Search } from 'lucide-react';
import { assignmentAPI } from '@/lib/api';

export default function AssignmentExtractor() {
  const [courseCode, setCourseCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assignments, setAssignments] = useState(null);

  const handleExtract = async () => {
    if (!courseCode.trim()) {
      setError('Please enter a course code');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const data = await assignmentAPI.extractAssignments(courseCode.toLowerCase().trim());
      setSuccess(`Successfully extracted ${data.totalSolutions} assignments!`);
      setAssignments(data);
      setCourseCode('');
    } catch (err) {
      setError(err?.data?.details || err?.data?.error || err.message || 'Failed to extract assignments');
      setAssignments(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with Help Info */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">📚 NPTEL Assignment Extractor</h1>
        <p className="text-slate-600 mb-4">
          Extract assignment solutions directly from NPTEL announcements. Enter a course code and we'll fetch all available solutions.
        </p>

        {/* Course Code Examples */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="font-semibold text-slate-900 mb-2">📝 Course Code Format:</p>
          <p className="text-sm text-slate-700 mb-3">
            <code className="bg-slate-100 px-2 py-1 rounded">noc{'YY'}_{'SUBJECT'}{'NUMBER'}</code>
          </p>
          <div className="text-sm text-slate-600 space-y-1">
            <p>• <code className="bg-slate-100 px-1">noc26_cs58</code> = Data Mining (Jan-Apr 2026)</p>
            <p>• <code className="bg-slate-100 px-1">noc25_cs107</code> = Cloud Computing (Jul-Oct 2025)</p>
            <p>• <code className="bg-slate-100 px-1">noc24_cs118</code> = Web Development (Jul-Oct 2024)</p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
        <label className="block text-lg font-semibold text-slate-900 mb-3">
          Enter NPTEL Course Code
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleExtract()}
            placeholder="e.g., noc26_cs58"
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          />
          <button
            onClick={handleExtract}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {loading ? 'Extracting...' : 'Extract'}
            <Search size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✅ {success}
          </div>
        )}
      </div>

      {/* Results Section */}
      {assignments && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          {/* Course Header */}
          <div className="mb-6 pb-4 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">{assignments.courseName}</h2>
            <div className="flex gap-4 mt-2 text-slate-600">
              <p>
                <span className="font-semibold">Code:</span> {assignments.courseCode}
              </p>
              <p>
                <span className="font-semibold">Semester:</span> {assignments.semester}
              </p>
              <p>
                <span className="font-semibold">Year:</span> {assignments.year}
              </p>
            </div>
          </div>

          {/* Solutions List */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {assignments.totalSolutions} Assignment Solutions Found
            </h3>

            {assignments.totalSolutions > 0 ? (
              <div className="space-y-3">
                {assignments.solutions
                  .sort((a, b) => a.weekNumber - b.weekNumber)
                  .map((solution, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          {solution.assignmentNumber} - Week {solution.weekNumber}
                        </p>
                        {solution.title && (
                          <p className="text-sm text-slate-600 mt-1">{solution.title}</p>
                        )}
                      </div>

                      <a
                        href={solution.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                      >
                        <LinkIcon size={16} />
                        View
                      </a>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-600">
                <p>No assignment solutions found in announcements.</p>
              </div>
            )}
          </div>

          {/* Info Message */}
          <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            💡 Assignments are extracted from NPTEL announcements and stored locally. You can now view and discuss these with other students.
          </div>
        </div>
      )}
    </div>
  );
}
