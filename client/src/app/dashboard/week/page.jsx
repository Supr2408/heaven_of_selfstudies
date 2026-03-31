'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Download } from 'lucide-react';
import WeekDetail from '@/components/WeekDetail';
import WeekDiscussions from '@/components/WeekDiscussions';
import ChatRoom from '@/components/ChatRoom';
import ResourceVault from '@/components/ResourceVault';
import { yearInstanceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const SEMESTER_MONTHS = {
  'Jan-Apr': ['January', 'February', 'March', 'April'],
  'July-Oct': ['July', 'August', 'September', 'October'],
};

const getSemesterMonths = (semester) => SEMESTER_MONTHS[semester] || ['General'];

const groupWeeksByMonth = (weeks = [], semester) => {
  if (!weeks.length) return [];
  const months = getSemesterMonths(semester);
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const weeksPerMonth = Math.max(1, Math.ceil(sorted.length / months.length));

  return months
    .map((month, index) => {
      const start = index * weeksPerMonth;
      const end = start + weeksPerMonth;
      return {
        month,
        weeks: sorted.slice(start, end),
      };
    })
    .filter((bucket) => bucket.weeks.length > 0);
};

export default function WeekPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    selectedYear,
    setSelectedYear,
    setSelectedWeek,
  } = useStore((state) => ({
    selectedYear: state.selectedYear,
    setSelectedYear: state.setSelectedYear,
    setSelectedWeek: state.setSelectedWeek,
  }));

  const weekId = searchParams?.get('weekId') || null;
  const providedYearInstanceId = searchParams?.get('yearInstanceId') || null;

  const [week, setWeek] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [activeYearInstance, setActiveYearInstance] = useState(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [error, setError] = useState(null);

  // Track current weekId to prevent race conditions
  const currentWeekIdRef = useRef(null);

  const resolvedYearInstanceId = useMemo(() => {
    return (
      providedYearInstanceId ||
      week?.yearInstanceId?._id ||
      selectedYear?._id ||
      null
    );
  }, [providedYearInstanceId, week, selectedYear]);

  // Fetch individual week when weekId changes
  useEffect(() => {
    if (!weekId) {
      setWeek(null);
      currentWeekIdRef.current = null;
      return;
    }

    // Skip if we're already fetching this week
    if (currentWeekIdRef.current === weekId) {
      return;
    }

    currentWeekIdRef.current = weekId;

    const fetchWeek = async () => {
      try {
        setLoadingWeek(true);
        setError(null);
        console.log('🔄 Fetching week:', weekId);
        const response = await yearInstanceAPI.getWeek(weekId);
        
        // Only update if this is still the requested week
        if (currentWeekIdRef.current === weekId) {
          console.log('✅ Week loaded:', response.data?.weekNumber, response.data?.title);
          setWeek(response.data);
          setSelectedWeek(response.data);
          if (response.data?.yearInstanceId) {
            setActiveYearInstance(response.data.yearInstanceId);
            setSelectedYear(response.data.yearInstanceId);
          }
        }
      } catch (err) {
        if (currentWeekIdRef.current === weekId) {
          console.error('Failed to fetch week details:', err);
          setError('Unable to load this week. Please pick another one.');
        }
      } finally {
        setLoadingWeek(false);
      }
    };

    fetchWeek();
  }, [weekId]);

  // Fetch weeks list for the active year instance
  useEffect(() => {
    if (!resolvedYearInstanceId) return;

    // Avoid refetching if we already have the weeks for this year
    const fetchWeeks = async () => {
      try {
        setLoadingWeeks(true);
        const response = await yearInstanceAPI.getWeeks(resolvedYearInstanceId);
        setWeeks(response.data || []);
      } catch (err) {
        console.error('Failed to fetch weeks list:', err);
      } finally {
        setLoadingWeeks(false);
      }
    };

    fetchWeeks();
  }, [resolvedYearInstanceId]);

  // Ensure we have year instance metadata when navigating directly via query
  useEffect(() => {
    if (!resolvedYearInstanceId) return;

    // Skip if we already have the data from a previous fetch
    if (activeYearInstance?._id === resolvedYearInstanceId) {
      return;
    }

    // Also skip if selectedYear is already set to this ID
    if (selectedYear?._id === resolvedYearInstanceId) {
      setActiveYearInstance(selectedYear);
      return;
    }

    const fetchYearInstance = async () => {
      try {
        const response = await yearInstanceAPI.getYearInstance(resolvedYearInstanceId);
        setActiveYearInstance(response.data);
        setSelectedYear(response.data);
      } catch (err) {
        console.error('Failed to load year instance details:', err);
      }
    };

    fetchYearInstance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedYearInstanceId]);

  const handleNavigateToWeek = (targetWeekId) => {
    if (!targetWeekId) return;
    const params = new URLSearchParams();
    params.set('weekId', targetWeekId);
    router.push(`/dashboard/week?${params.toString()}`);
  };

  const currentSemester = activeYearInstance?.semester || selectedYear?.semester || 'General';
  const monthBuckets = groupWeeksByMonth(weeks, currentSemester);

  const courseIdForChat = week?.yearInstanceId?.courseId?._id || week?.yearInstanceId?.courseId;
  const courseYearForChat = week?.yearInstanceId?.year || activeYearInstance?.year;

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {loadingWeek ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600">Loading week details…</p>
        </div>
      ) : week ? (
        <WeekDetail key={week._id} week={week} />
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-8 text-center">
          <p className="text-slate-700">
            Select a week from the sidebar or pick one from the list below to begin exploring assignments and materials.
          </p>
        </div>
      )}

      {week && (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Real-time Chat</h2>
            <ChatRoom
              weekId={week._id}
              courseId={courseIdForChat || week?.yearInstanceId?.courseId?._id || ''}
              year={courseYearForChat || new Date().getFullYear()}
            />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Community Vault</h2>
            <ResourceVault weekId={week._id} />
          </div>

          <div>
            <WeekDiscussions weekId={week._id} weekNumber={week.weekNumber} weekTitle={week.title} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Browse Weeks</h2>
          {activeYearInstance && (
            <span className="text-sm text-slate-500">
              {activeYearInstance.year} • {activeYearInstance.semester}
            </span>
          )}
        </div>

        {loadingWeeks ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-600">
            Loading available weeks…
          </div>
        ) : weeks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-600">
            Weeks will appear here once materials are extracted.
          </div>
        ) : (
          <div className="space-y-4">
            {monthBuckets.map((bucket) => (
              <div key={`${bucket.month}-${bucket.weeks[0]._id}`} className="bg-white border border-slate-200 rounded-lg">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{bucket.month}</div>
                  <div className="text-xs text-slate-500">{bucket.weeks.length} week(s)</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {bucket.weeks.map((bucketWeek) => (
                    <button
                      key={bucketWeek._id}
                      onClick={() => handleNavigateToWeek(bucketWeek._id)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          Week {bucketWeek.weekNumber}: {bucketWeek.title}
                        </div>
                        <p className="text-sm text-slate-600">{bucketWeek.description || 'Materials and assignments for this week.'}</p>
                      </div>
                      <Download size={18} className="text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
