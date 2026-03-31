'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';

export default function WeekDetail({ week }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  // Update preview URL when week changes
  useEffect(() => {
    const visibleMaterials = (week?.materials || []).filter(
      (material) => (material?.fileType || '').toLowerCase() !== 'video'
    );
    const firstPdf = visibleMaterials.find((m) => (m.fileType || '').toLowerCase() === 'pdf');
    setPreviewUrl(firstPdf ? firstPdf.url : null);
  }, [week?._id, week?.materials]);

  return (
    <div className="space-y-6">
      {/* Week Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
        <h1 className="text-3xl font-bold">{week.title}</h1>
        <p className="text-blue-100 mt-2">{week.description}</p>
      </div>

      {/* Topics Overview */}
      {week.topicsOverview && week.topicsOverview.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Topics Covered</h3>
          <ul className="space-y-1">
            {week.topicsOverview.map((topic, idx) => (
              <li key={idx} className="text-sm text-blue-800 flex items-center">
                <span className="mr-2">•</span>
                {topic}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inline PDF Viewer - Direct display */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Materials</h2>
        
        {previewUrl ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">📄 Inline PDF Viewer</div>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Open in new tab
                <ExternalLink size={14} />
              </a>
            </div>
            <div className="w-full" style={{ height: '70vh' }}>
              <iframe
                src={previewUrl}
                title="Week material PDF"
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-slate-50 rounded-lg border border-slate-200">
            <FileText size={40} className="mx-auto text-slate-400 mb-2" />
            <p className="text-slate-600">No materials available for this week yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

