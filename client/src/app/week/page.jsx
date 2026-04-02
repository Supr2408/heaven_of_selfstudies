'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Download } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import WeekDiscussions from '@/components/WeekDiscussions';

export default function WeekPage({ params }) {
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sample week data
    const sampleWeek = {
      id: '1',
      weekNumber: 1,
      title: 'Introduction to Cloud Computing',
      course: 'Cloud Computing Fundamentals',
      description:
        'Learn the fundamentals of cloud computing, deployment models, and service models. Understand the benefits and challenges of cloud technology.',
      materials: [
        {
          title: 'Lecture Notes Week_01.pdf',
          type: 'lecture_note',
          url: '#',
          fileType: 'pdf',
          size: '2.4 MB',
        },
        {
          title: 'Assignment_Week_01.pdf',
          type: 'assignment',
          url: '#',
          fileType: 'pdf',
          size: '1.2 MB',
        },
        {
          title: 'Solution_Week_01.pdf',
          type: 'solution',
          url: '#',
          fileType: 'pdf',
          size: '1.8 MB',
        },
      ],
      learningOutcomes: [
        'Understand basic cloud computing concepts and terminology',
        'Differentiate between deployment models (public, private, hybrid)',
        'Compare service models (IaaS, PaaS, SaaS)',
        'Identify use cases for cloud computing',
        'Recognize cloud providers and their services',
      ],
      keyTopics: [
        'Cloud Definition',
        'On-Premises vs Cloud',
        'Deployment Models',
        'Service Models',
        'Cloud Providers',
        'Cost Benefits',
      ],
    };

    setWeek(sampleWeek);
    setLoading(false);
  }, [params]);

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto py-12 text-center">
          <p className="text-slate-600">Loading week content...</p>
        </div>
      </MainLayout>
    );
  }

  if (!week) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto py-12 text-center">
          <p className="text-slate-600">Week not found</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-sm text-blue-600 font-medium mb-2">{week.course}</div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Week {week.weekNumber}: {week.title}</h1>
          <p className="text-lg text-slate-600">{week.description}</p>
        </div>

        {/* Learning Outcomes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">📚 Learning Outcomes</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {week.learningOutcomes.map((outcome, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="text-blue-600 font-bold mt-1">✓</span>
                <span className="text-slate-700">{outcome}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Learning Materials */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">📄 Study Materials</h2>
          <div className="space-y-3">
            {week.materials && week.materials.length > 0 ? (
              week.materials.map((material, idx) => (
                <a
                  key={idx}
                  href={material.url}
                  className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow group cursor-pointer"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                    <Download size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
                      {material.title}
                    </h4>
                    <p className="text-sm text-slate-500">
                      {material.type.replace('_', ' ')} • {material.size || material.fileType}
                    </p>
                  </div>
                  <div className="text-slate-400 group-hover:text-slate-600">↓</div>
                </a>
              ))
            ) : (
              <p className="text-slate-600">No materials available yet</p>
            )}
          </div>
        </div>

        {/* Key Topics */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">🎯 Key Topics</h2>
          <div className="flex flex-wrap gap-2">
            {week.keyTopics.map((topic, idx) => (
              <span
                key={idx}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Week Discussions Component */}
        <WeekDiscussions weekNumber={week.weekNumber} weekTitle={week.title} />
      </div>
    </MainLayout>
  );
}
