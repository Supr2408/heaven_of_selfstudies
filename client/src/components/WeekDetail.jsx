'use client';

import { useState } from 'react';
import { FileText, Loader2, UploadCloud } from 'lucide-react';
import StudyPdfViewer from '@/components/StudyPdfViewer';
import { resourceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getBatchLabel = (yearInstance) => {
  if (!yearInstance?.year || !yearInstance?.semester) return '';
  return `Batch ${yearInstance.year} - ${yearInstance.semester}`;
};

export default function WeekDetail({ week, yearInstance, navigationSlot = null }) {
  const { isAuthenticated } = useStore((state) => ({
    isAuthenticated: state.isAuthenticated,
  }));
  const firstPdfIndex = (week?.materials || []).findIndex(
    (material) => (material?.fileType || '').toLowerCase() === 'pdf'
  );
  const firstPdf = firstPdfIndex >= 0 ? week.materials[firstPdfIndex] : null;
  const previewUrl =
    week?._id && firstPdfIndex >= 0
      ? `${API_BASE_URL}/weeks/week/${week._id}/materials/${firstPdfIndex}/pdf`
      : null;

  const batchLabel = getBatchLabel(yearInstance || week?.yearInstanceId);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState({
    title: `${week?.title || 'Week material'} community PDF`,
    description: '',
    file: null,
    message: '',
    error: '',
  });

  const handleUpload = async () => {
    if (!isAuthenticated) {
      setUploadState((state) => ({
        ...state,
        error: 'Please log in first to upload a PDF for review.',
        message: '',
      }));
      return;
    }

    if (!uploadState.title.trim()) {
      setUploadState((state) => ({
        ...state,
        error: 'Please add a title for this PDF submission.',
        message: '',
      }));
      return;
    }

    if (!uploadState.file) {
      setUploadState((state) => ({
        ...state,
        error: 'Please choose a PDF file to upload.',
        message: '',
      }));
      return;
    }

    const formData = new FormData();
    formData.append('weekId', week._id);
    formData.append('title', uploadState.title.trim());
    formData.append('description', uploadState.description.trim());
    formData.append('type', 'solution');
    formData.append('file', uploadState.file);

    try {
      setUploading(true);
      setUploadState((state) => ({ ...state, error: '', message: '' }));
      await resourceAPI.uploadResourcePdf(formData);
      setUploadState((state) => ({
        ...state,
        description: '',
        file: null,
        message: 'PDF submitted successfully. It will stay pending until admin review.',
        error: '',
      }));
    } catch (error) {
      setUploadState((state) => ({
        ...state,
        error: error?.message || 'Unable to upload this PDF right now.',
        message: '',
      }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 px-6 py-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{week.title}</h1>
            <p className="max-w-3xl text-sm text-blue-50 md:text-base">
              {week.description || `Study materials for ${week.title}.`}
            </p>
          </div>
          {batchLabel ? (
            <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              {batchLabel}
            </div>
          ) : null}
        </div>
      </div>

      {navigationSlot}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Materials</h2>

        {previewUrl ? (
          <StudyPdfViewer
            src={previewUrl}
            storageKey={`${week?._id || week?.weekNumber}-${firstPdfIndex}`}
            title={firstPdf?.title || `${week.title} PDF`}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8">
            <div className="text-center">
              <FileText size={40} className="mx-auto mb-3 text-slate-400" />
              <p className="text-base font-medium text-slate-700">
                No PDF materials available for this week yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                If you already have the required PDF, upload it here and we will keep it pending for admin review before publishing.
              </p>
            </div>

            <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                  <UploadCloud size={22} />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">Upload a community PDF</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Students can submit missing solution PDFs here. Admin verification will be added later, so every upload is stored as pending review for now.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                  <input
                    value={uploadState.title}
                    onChange={(event) =>
                      setUploadState((state) => ({
                        ...state,
                        title: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Week 03 community solution PDF"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Note for reviewer
                  </label>
                  <textarea
                    value={uploadState.description}
                    onChange={(event) =>
                      setUploadState((state) => ({
                        ...state,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Mention source or anything useful about this uploaded PDF."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">PDF file</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) =>
                      setUploadState((state) => ({
                        ...state,
                        file: event.target.files?.[0] || null,
                        error: '',
                        message: '',
                      }))
                    }
                    className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                  />
                  {uploadState.file ? (
                    <p className="mt-2 text-xs text-slate-500">{uploadState.file.name}</p>
                  ) : null}
                </div>

                {uploadState.error ? (
                  <p className="text-sm font-medium text-red-600">{uploadState.error}</p>
                ) : null}

                {uploadState.message ? (
                  <p className="text-sm font-medium text-emerald-600">{uploadState.message}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    Upload for review
                  </button>
                  <span className="text-xs text-slate-500">
                    PDF only. The submission is not treated as official material until admin approval.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
