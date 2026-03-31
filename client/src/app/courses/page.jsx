'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import { courseAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const timelineBadgeClass = (semester = '') => {
  if (semester === 'Jan-Apr') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (semester === 'Jul-Oct' || semester === 'July-Oct' || semester === 'Aug-Oct') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function CoursesPage() {
  const router = useRouter();
  const bumpContentVersion = useStore((state) => state.bumpContentVersion);

  const [query, setQuery] = useState('');
  const [institute, setInstitute] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [importingId, setImportingId] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchError('Enter a course name to search NPTEL.');
      setResults([]);
      return;
    }

    setSearching(true);
    setSearchError('');
    setImportMessage('');
    setPreview(null);
    setSelectedCourse(null);

    try {
      const response = await courseAPI.searchNptelCourses({
        query: query.trim(),
        institute: institute.trim(),
      });
      setResults(response.data || []);

      if (!response.data?.length) {
        setSearchError('No NPTEL courses matched that search. Try a broader title or remove the institute filter.');
      }
    } catch (error) {
      setResults([]);
      setSearchError(
        error?.data?.message || error.message || 'Unable to search NPTEL right now.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handlePreview = async (course) => {
    setSelectedCourse(course);
    setPreview(null);
    setPreviewError('');
    setImportMessage('');
    setPreviewLoading(true);

    try {
      const response = await courseAPI.getNptelCoursePreview({
        catalogId: course.courseNumericId,
        courseUrl: course.courseUrl,
        courseName: course.title,
        institute: course.instituteName,
        professor: course.professor,
      });
      setPreview(response.data);
    } catch (error) {
      setPreviewError(
        error?.data?.message || error.message || 'Unable to load course runs from NPTEL.'
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const openImportedCourse = (hubCourse) => {
    if (hubCourse?.firstWeekId) {
      router.push(`/dashboard/week?weekId=${hubCourse.firstWeekId}`);
      return;
    }

    if (hubCourse?.latestYearInstanceId) {
      router.push(`/dashboard/week?yearInstanceId=${hubCourse.latestYearInstanceId}`);
      return;
    }

    router.push('/dashboard');
  };

  const handleImport = async () => {
    if (!selectedCourse) return;

    setImportingId(selectedCourse.courseNumericId);
    setImportMessage('');
    setPreviewError('');

    try {
      const response = await courseAPI.importNptelCourse({
        courseName: selectedCourse.title,
        institute: selectedCourse.instituteName,
        professor: selectedCourse.professor,
        courseNumericId: selectedCourse.courseNumericId,
        courseUrl: selectedCourse.courseUrl,
      });

      bumpContentVersion();
      setImportMessage(
        `Imported ${response.data?.course?.title || selectedCourse.title} and added it to the Hub.`
      );

      const navigation = response.data?.navigation;
      if (navigation?.latestWeekId) {
        router.push(`/dashboard/week?weekId=${navigation.latestWeekId}`);
      } else if (navigation?.latestYearInstanceId) {
        router.push(`/dashboard/week?yearInstanceId=${navigation.latestYearInstanceId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      setPreviewError(
        error?.data?.message || error.message || 'Import failed. Please try again.'
      );
    } finally {
      setImportingId('');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.16),_transparent_38%),linear-gradient(135deg,#f8fafc_0%,#eef6ff_50%,#f8fafc_100%)] p-8 shadow-sm">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-1 text-sm font-medium text-sky-700">
              <Sparkles size={16} />
              Live NPTEL discovery
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Search any NPTEL course and bring its assignment solutions into the Hub
            </h1>
            <p className="text-lg text-slate-600">
              This page follows the same flow you described manually: search the course,
              inspect its statistics runs, derive the run IDs, scrape announcement solutions,
              and create the same subject, batch, week, and solution-branch structure used by the
              existing Cloud Computing section.
            </p>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr),260px,160px]">
            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Course Search
              </div>
              <div className="flex items-center gap-3">
                <Search size={18} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                  placeholder="Natural Language Processing, Data Mining, Cloud Computing..."
                  className="w-full border-0 bg-transparent p-0 text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Institute Filter
              </div>
              <input
                value={institute}
                onChange={(event) => setInstitute(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                placeholder="IIT Kharagpur"
                className="w-full border-0 bg-transparent p-0 text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <button
              onClick={handleSearch}
              disabled={searching}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Search
            </button>
          </div>

          {(searchError || importMessage) && (
            <div className="mt-4 space-y-3">
              {searchError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {searchError}
                </div>
              )}
              {importMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {importMessage}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),minmax(380px,0.85fr)]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Search Results</h2>
              <span className="text-sm text-slate-500">{results.length} course(s)</span>
            </div>

            {results.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                Search for a course above to load live results from `nptel.ac.in/courses`.
              </div>
            ) : (
              <div className="grid gap-4">
                {results.map((course) => {
                  const isSelected =
                    selectedCourse?.courseNumericId === course.courseNumericId;

                  return (
                    <button
                      key={course.courseNumericId}
                      onClick={() => handlePreview(course)}
                      className={`rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        isSelected
                          ? 'border-sky-400 ring-2 ring-sky-100'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            <BookOpen size={14} />
                            NPTEL catalog
                          </div>
                          <h3 className="text-xl font-semibold text-slate-900">{course.title}</h3>
                          <p className="text-sm text-slate-600">
                            {course.instituteName || 'Institute not listed'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {course.professor || 'Professor not listed'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
                          Inspect
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {!selectedCourse ? (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center text-slate-500">
                <BookOpen size={44} className="mb-4 text-slate-300" />
                <h3 className="text-xl font-semibold text-slate-900">Pick a course</h3>
                <p className="mt-2 max-w-sm">
                  I’ll load its statistics runs so we can see the exact `nocYY_xxNN`
                  announcement IDs before importing it into the Hub.
                </p>
              </div>
            ) : previewLoading ? (
              <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-600">
                <Loader2 size={20} className="animate-spin" />
                Loading course statistics and run IDs...
              </div>
            ) : previewError ? (
              <div className="min-h-[420px] rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                {previewError}
              </div>
            ) : preview ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Selected Course
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{preview.title}</h2>
                    <p className="mt-1 text-slate-600">{preview.instituteName}</p>
                    <p className="text-sm text-slate-500">{preview.professor}</p>
                  </div>
                  <a
                    href={preview.courseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-800"
                  >
                    Open official NPTEL page
                    <ExternalLink size={15} />
                  </a>
                </div>

                {preview.hubCourse ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-sm font-semibold text-emerald-800">
                      Already available in the Hub
                    </div>
                    <p className="mt-1 text-sm text-emerald-700">
                      {preview.hubCourse.importedRuns} batch(es) already imported for this course.
                    </p>
                    <button
                      onClick={() => openImportedCourse(preview.hubCourse)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Open in Hub
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Not imported yet
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Importing will create the subject, course, batch history, weeks, and
                      assignment-solution branches so it appears in the same hierarchy as Cloud Computing.
                    </p>
                    <button
                      onClick={handleImport}
                      disabled={importingId === selectedCourse.courseNumericId}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importingId === selectedCourse.courseNumericId ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      Import to Hub
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Statistics Runs</h3>
                    <span className="text-sm text-slate-500">{preview.runs.length} run(s)</span>
                  </div>

                  {preview.runs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                      No public statistics runs were found on the course page. Import will still
                      create the course branch with empty solution weeks, but it will not import any video lessons.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {preview.runs.map((run) => (
                        <div
                          key={`${run.timeline}-${run.courseId}`}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {run.timeline || 'Unknown timeline'}
                              </div>
                              <div className="mt-1 font-mono text-sm text-slate-600">
                                {run.courseId}
                              </div>
                            </div>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${timelineBadgeClass(
                                run.semester
                              )}`}
                            >
                              {run.semester} {run.year || ''}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
                            <div className="rounded-xl bg-slate-100 px-3 py-2 font-mono text-slate-700">
                              {run.announcementCourseCode}
                            </div>
                            <a
                              href={run.announcementsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
                            >
                              Announcements
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
