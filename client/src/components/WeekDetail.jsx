'use client';

import { useState } from 'react';
import { FileText, LinkIcon, HelpCircle, Eye, FileCode, ExternalLink, Download } from 'lucide-react';

export default function WeekDetail({ week }) {
  const [activeTab, setActiveTab] = useState('materials');
  const visibleMaterials = (week?.materials || []).filter(
    (material) => (material?.fileType || '').toLowerCase() !== 'video'
  );
  const [previewUrl, setPreviewUrl] = useState(() => {
    const firstPdf = visibleMaterials.find((m) => (m.fileType || '').toLowerCase() === 'pdf');
    return firstPdf ? firstPdf.url : null;
  });

  // Helper to get material type icon and color
  const getMaterialIcon = (type) => {
    const icons = {
      lecture_note: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
      assignment: { icon: FileCode, color: 'text-purple-600', bg: 'bg-purple-100' },
      solution: { icon: Download, color: 'text-green-600', bg: 'bg-green-100' },
      code: { icon: FileCode, color: 'text-orange-600', bg: 'bg-orange-100' },
      other: { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' },
    };
    return icons[type] || icons.other;
  };

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

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          {[
            { id: 'materials', label: 'Solution PDFs', icon: Download },
            { id: 'pyq', label: 'PYQs', icon: HelpCircle },
            { id: 'chat', label: 'Chat', icon: LinkIcon },
            { id: 'resources', label: 'Community Vault', icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'materials' && (
          <div className="space-y-4">
            {visibleMaterials.length > 0 ? (
              <div className="space-y-3">
                {visibleMaterials.map((material, idx) => {
                  const { icon: Icon, color, bg } = getMaterialIcon(material.type);
                  const isPdf = (material.fileType || '').toLowerCase() === 'pdf';

                  const handleOpen = (e) => {
                    e.preventDefault();
                    if (isPdf) {
                      setPreviewUrl(material.url);
                    } else {
                      window.open(material.url, '_blank', 'noreferrer');
                    }
                  };

                  return (
                    <button
                      key={idx}
                      onClick={handleOpen}
                      className="w-full text-left p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow flex items-start justify-between group"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`${bg} p-2 rounded-lg flex-shrink-0`}>
                          <Icon size={20} className={color} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 group-hover:text-blue-600">
                            {material.title}
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">
                            Type: <span className="capitalize">{material.type.replace('_', ' ')}</span>
                            {material.fileType && ` • ${material.fileType.toUpperCase()}`}
                            {isPdf && ' • Inline view available'}
                          </p>
                        </div>
                      </div>
                      {isPdf ? (
                        <Eye size={20} className="text-blue-500 group-hover:scale-105" />
                      ) : (
                        <ExternalLink size={20} className="text-slate-400 group-hover:text-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : week.pdfLinks && week.pdfLinks.length > 0 ? (
              <div className="space-y-3">
                {week.pdfLinks.map((pdf, idx) => (
                  <a
                    key={idx}
                    href={pdf.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={20} className="text-green-600" />
                      <div>
                        <div className="font-semibold text-green-600">{pdf.title}</div>
                        <p className="text-xs text-slate-500 mt-1">PDF Document</p>
                      </div>
                    </div>
                    <Download size={20} className="text-green-600 group-hover:scale-110" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 bg-slate-50 rounded-lg">
                <FileText size={40} className="mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600">No assignment solution PDFs available for this week yet</p>
              </div>
            )}

            {previewUrl && (
              <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Inline PDF viewer</div>
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
            )}
          </div>
        )}

        {activeTab === 'pyq' && (
          <div className="space-y-4">
            {week.pyqLinks?.length > 0 ? (
              week.pyqLinks.map((pyq, idx) => (
                <a
                  key={idx}
                  href={pyq.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow block group"
                >
                  <div className="font-semibold text-slate-900 group-hover:text-blue-600">{pyq.question}</div>
                  <div className="text-sm text-slate-600 mt-1">Year: {pyq.year}</div>
                </a>
              ))
            ) : (
              <div className="text-center p-8 bg-slate-50 rounded-lg">
                <HelpCircle size={40} className="mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600">No PYQs available yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="bg-slate-50 p-8 rounded-lg text-center">
            <LinkIcon size={40} className="mx-auto text-slate-400 mb-2" />
            <p className="text-slate-600">Chat Room Component</p>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="bg-slate-50 p-8 rounded-lg text-center">
            <FileText size={40} className="mx-auto text-slate-400 mb-2" />
            <p className="text-slate-600">Community Resource Vault</p>
          </div>
        )}
      </div>
    </div>
  );
}

