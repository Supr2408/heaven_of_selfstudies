'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { resourceAPI, resolveApiAssetUrl } from '@/lib/api';
import { getPublicUserName, isAdminUser } from '@/lib/user';
import useStore from '@/store/useStore';

const getSubmissionContext = (item) => {
  if (item?.weekId) {
    const batch = item.weekId?.yearInstanceId;
    const course = batch?.courseId;
    return {
      courseTitle: course?.title || 'Course',
      courseCode: course?.code || '',
      branchLabel: `Week ${item.weekId?.weekNumber || ''} material branch`,
      extraLabel: batch?.year && batch?.semester ? `${batch.year} - ${batch.semester}` : '',
      title: item.weekId?.title || '',
    };
  }

  return {
    courseTitle: item?.courseId?.title || 'Course discussion',
    courseCode: item?.courseId?.code || '',
    branchLabel: 'Course discussion branch',
    extraLabel: '',
    title: '',
  };
};

export default function AdminReviewPage() {
  const user = useStore((state) => state.user);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState({});
  const [reviewerNotes, setReviewerNotes] = useState({});

  const isAdmin = useMemo(() => isAdminUser(user), [user]);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await resourceAPI.getReviewQueue({ status: 'pending' });
      setQueue(response?.data || []);
    } catch (err) {
      setError(err?.message || 'Unable to load the admin review queue right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadQueue();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadQueue]);

  const handleReview = async (item, action) => {
    const reviewText = reviewerNotes[item._id]?.trim() || '';

    try {
      setActionState((state) => ({ ...state, [item._id]: action }));
      if (action === 'approve') {
        await resourceAPI.approveReviewSubmission(item._id, { reviewerNote: reviewText });
      } else {
        await resourceAPI.rejectReviewSubmission(item._id, { reviewerNote: reviewText });
      }

      setQueue((current) => current.filter((entry) => entry._id !== item._id));
    } catch (err) {
      alert(err?.message || `Unable to ${action} this submission right now.`);
    } finally {
      setActionState((state) => ({ ...state, [item._id]: '' }));
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center text-amber-800 shadow-sm">
        <ShieldAlert className="mx-auto mb-3" size={28} />
        This page is only available to admin accounts.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-800 to-blue-700 px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">
            Admin Review
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Pending upload approvals</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
            Review community-submitted PDFs from week material requests and course discussion
            branches, then approve or reject them from one place.
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-sm">
          Loading admin review queue...
        </div>
      ) : queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-600">
          No pending upload requests right now.
        </div>
      ) : (
        <div className="grid gap-5">
          {queue.map((item) => {
            const context = getSubmissionContext(item);
            const fileUrl = resolveApiAssetUrl(item.url);
            const action = actionState[item._id] || '';

            return (
              <article
                key={item._id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        <Clock3 size={13} />
                        Pending review
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {context.branchLabel}
                      </span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {item.type}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{item.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {context.courseTitle}
                        {context.courseCode ? ` - ${context.courseCode}` : ''}
                        {context.extraLabel ? ` - ${context.extraLabel}` : ''}
                      </p>
                      {context.title ? (
                        <p className="mt-1 text-sm text-slate-500">{context.title}</p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-900">Uploaded by:</span>{' '}
                        {getPublicUserName(item.userId)}
                      </p>
                      {item.userId?.email ? (
                        <p className="mt-1">
                          <span className="font-semibold text-slate-900">Email:</span>{' '}
                          {item.userId.email}
                        </p>
                      ) : null}
                      <p className="mt-1">
                        <span className="font-semibold text-slate-900">Submitted:</span>{' '}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {item.description ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                        <p className="font-semibold text-slate-900">Uploader note</p>
                        <p className="mt-2 whitespace-pre-wrap">{item.description}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full max-w-xl space-y-4">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <FileText size={16} />
                      Open submitted PDF
                    </a>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Reviewer note
                      </label>
                      <textarea
                        value={reviewerNotes[item._id] || ''}
                        onChange={(event) =>
                          setReviewerNotes((state) => ({
                            ...state,
                            [item._id]: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Optional note for approval or rejection."
                        className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleReview(item, 'approve')}
                        disabled={Boolean(action)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {action === 'approve' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Approve
                      </button>

                      <button
                        onClick={() => handleReview(item, 'reject')}
                        disabled={Boolean(action)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {action === 'reject' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <XCircle size={16} />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
