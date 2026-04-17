'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Lock,
  BookOpen,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import { courseAPI } from '@/lib/api';
import { isGoogleUser } from '@/lib/user';
import useStore from '@/store/useStore';

const timelineBadgeClass = (semester = '') => {
  if (semester === 'Jan-Apr') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (semester === 'Jul-Oct' || semester === 'July-Oct' || semester === 'Aug-Oct') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

// Feature flag: set to 1 to show NPTEL statistics runs preview, 0 to hide it.
const ENABLE_STATISTICS_RUNS = 0;

export default function CoursesPage() {
  const router = useRouter();
  const bumpContentVersion = useStore((state) => state.bumpContentVersion);
  const currentTheme = useStore((state) => state.currentTheme);
  const user = useStore((state) => state.user);
  const hasGoogleAccess = isGoogleUser(user);
  const isDarkTheme = currentTheme === 'dark';

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

  const renderSelectedCoursePanel = () => {
    if (previewLoading) {
      return (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium ${
            isDarkTheme
              ? 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
              : 'border-sky-100 bg-sky-50 text-sky-800'
          }`}
        >
          <Loader2 size={18} className="animate-spin" />
          Loading course availability and import options...
        </div>
      );
    }

    if (previewError) {
      return (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            isDarkTheme
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {previewError}
        </div>
      );
    }

    if (!preview) return null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={preview.courseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              isDarkTheme
                ? 'border-slate-700 bg-slate-950/70 text-cyan-200 hover:bg-slate-900 hover:text-cyan-100'
                : 'border-slate-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800'
            }`}
          >
            Open official NPTEL page
            <ExternalLink size={15} />
          </a>
        </div>

        {preview.hubCourse ? (
          <div
            className={`rounded-2xl border p-4 ${
              isDarkTheme
                ? 'border-emerald-400/25 bg-emerald-500/10'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className={`text-sm font-semibold ${isDarkTheme ? 'text-emerald-100' : 'text-emerald-800'}`}>
              {preview.hubCourse.userHasCourse
                ? 'Continue with your copy'
                : 'Already available in the Hub'}
            </div>
            <p className={`mt-1 text-sm ${isDarkTheme ? 'text-emerald-200/90' : 'text-emerald-700'}`}>
              {preview.hubCourse.userHasCourse
                ? `This course is already in your library. ${preview.hubCourse.importedRuns} batch(es) are ready for you.`
                : `${preview.hubCourse.importedRuns} batch(es) are already imported for this course. Open it once and it will be added to your library.`}
            </p>
            <button
              type="button"
              onClick={() => openImportedCourse(preview.hubCourse)}
              className={`mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isDarkTheme
                  ? 'bg-emerald-300 text-slate-950 hover:bg-emerald-200'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800'
              }`}
            >
              {preview.hubCourse.userHasCourse ? 'Continue with this course' : 'Open in Hub'}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div
            className={`rounded-2xl border p-4 ${
              isDarkTheme
                ? 'border-slate-700 bg-slate-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-sm font-semibold text-slate-900">Not imported yet</div>
            <p className={`mt-1 text-sm ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
              Importing will create the subject, course, batch history, weeks, and
              assignment-solution branches so it appears in the Hub.
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importingId === selectedCourse?.courseNumericId}
              className={`mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isDarkTheme
                  ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {importingId === selectedCourse?.courseNumericId ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Import to Hub
            </button>
          </div>
        )}

        {ENABLE_STATISTICS_RUNS ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Statistics Runs</h3>
              <span className="text-sm text-slate-500">{preview.runs.length} run(s)</span>
            </div>

            {!hasGoogleAccess ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                    <Lock size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Statistics runs are available after Google sign-in
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Sign in with Google to view batch run history, announcement course
                      codes, and external announcement links for this NPTEL course.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push('/login')}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
                    >
                      Continue with Google
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : preview.runs.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-5 text-sm ${
                  isDarkTheme
                    ? 'border-slate-700 bg-slate-950/70 text-slate-400'
                    : 'border-slate-300 bg-slate-50 text-slate-500'
                }`}
              >
                No public statistics runs were found on the course page, so import will rely
                on the course outline fallback if announcements are unavailable.
              </div>
            ) : (
              <div className="space-y-3">
                {preview.runs.map((run) => (
                  <div
                    key={`${run.timeline}-${run.courseId}`}
                    className={`rounded-2xl border p-4 ${isDarkTheme ? 'border-slate-700 bg-slate-950/65' : 'border-slate-200'}`}
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
                      <div className={`rounded-xl px-3 py-2 font-mono ${isDarkTheme ? 'bg-slate-900 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                        {run.announcementCourseCode}
                      </div>
                      <a
                        href={run.announcementsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${
                          isDarkTheme
                            ? 'border-slate-700 text-slate-200 hover:bg-slate-900'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
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
        ) : null}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <section
          className={`rounded-3xl border p-8 ${
            isDarkTheme
              ? 'border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#082f49_100%)] shadow-[0_18px_45px_-28px_rgba(34,211,238,0.35)]'
              : 'border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.16),_transparent_38%),linear-gradient(135deg,#f8fafc_0%,#eef6ff_50%,#f8fafc_100%)] shadow-sm'
          }`}
        >
          <div className="max-w-3xl space-y-4">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-sm font-medium ${
                isDarkTheme
                  ? 'border-cyan-400/30 bg-slate-950/60 text-cyan-100'
                  : 'border-sky-200 bg-white/80 text-sky-700'
              }`}
            >
              <Sparkles size={16} />
              Live NPTEL discovery
            </div>
            <h1 className={`text-4xl font-bold tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
              Search any NPTEL course and bring its previous-year assignment solutions into the Hub
            </h1>
            <p className={`text-lg ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
              Find a course, pull in its older assignment solutions from the NPTEL announcements,
              and create the same subject, batch, week, and solution-branch structure used by the
              existing Cloud Computing section.
            </p>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr),260px,160px]">
            <label
              className={`rounded-2xl border px-4 py-3 ${
                isDarkTheme
                  ? 'border-slate-700 bg-slate-950/80 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.9)]'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                Course Search
              </div>
              <div className="flex items-center gap-3">
                <Search size={18} className={isDarkTheme ? 'text-slate-500' : 'text-slate-400'} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                  placeholder="Natural Language Processing, Data Mining, Cloud Computing..."
                  className={`w-full border-0 bg-transparent p-0 outline-none ${
                    isDarkTheme ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </label>

            <label
              className={`rounded-2xl border px-4 py-3 ${
                isDarkTheme
                  ? 'border-slate-700 bg-slate-950/80 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.9)]'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                Institute Filter
              </div>
              <input
                value={institute}
                onChange={(event) => setInstitute(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                placeholder="IIT Kharagpur"
                className={`w-full border-0 bg-transparent p-0 outline-none ${
                  isDarkTheme ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </label>

            <button
              onClick={handleSearch}
              disabled={searching}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isDarkTheme
                  ? 'bg-white text-slate-950 hover:bg-slate-100'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
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
            <div className="grid gap-4 lg:grid-cols-2">
              {results.map((course) => {
                const isSelected =
                  selectedCourse?.courseNumericId === course.courseNumericId;

                return (
                  <article
                    key={course.courseNumericId}
                    className={`overflow-hidden rounded-3xl border shadow-sm transition ${
                      isSelected
                        ? isDarkTheme
                          ? 'border-cyan-300 ring-2 ring-cyan-300/25 bg-slate-900'
                          : 'border-sky-400 ring-2 ring-sky-100 bg-white'
                        : isDarkTheme
                          ? 'border-slate-700 bg-slate-950 hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-md'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handlePreview(course)}
                      aria-expanded={isSelected}
                      className="w-full p-5 text-left"
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
                          {isSelected ? 'Selected' : 'Inspect'}
                          <ArrowRight
                            size={16}
                            className={`transition-transform ${isSelected ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </div>
                    </button>

                    {isSelected ? (
                      <div
                        className={`border-t p-5 ${
                          isDarkTheme
                            ? 'border-slate-800 bg-slate-900/90'
                            : 'border-slate-100 bg-slate-50/60'
                        }`}
                      >
                        {renderSelectedCoursePanel()}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
