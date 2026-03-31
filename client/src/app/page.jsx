'use client';

import MainLayout from '@/components/MainLayout';
import Link from 'next/link';
import { BookOpen, Search } from 'lucide-react';

export default function Home() {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-12 text-center mb-12">
          <BookOpen size={48} className="mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Welcome to NPTEL Hub</h1>
          <p className="text-xl opacity-90 mb-6">
            Community-driven learning platform for NPTEL courses
          </p>
          <div className="mb-6">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-blue-700 hover:bg-blue-50"
            >
              <Search size={18} />
              Search and Import NPTEL Courses
            </Link>
          </div>
          <p className="text-sm opacity-75">
            Not affiliated with NPTEL. Content belongs to original creators.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              title: 'Hierarchical Navigation',
              description: 'Easily browse subjects, courses, and weeks',
             icon: '🗂️',
            },
            {
              title: 'Real-time Chat',
              description: 'Connect with peers in dedicated week rooms',
              icon: '💬',
            },
            {
              title: 'Community Vault',
              description: 'Share and discover study materials',
              icon: '📚',
            },
          ].map((feature, idx) => (
            <div key={idx} className="p-6 bg-white border border-slate-200 rounded-lg hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Getting Started</h2>
          <ol className="space-y-3 text-slate-700">
            <li>
              <span className="font-semibold">1. Choose a Subject:</span> Select from the sidebar
            </li>
            <li>
              <span className="font-semibold">2. Pick a Course:</span> Explore available courses
            </li>
            <li>
              <span className="font-semibold">3. Select a Year:</span> Choose your preferred offering
            </li>
            <li>
              <span className="font-semibold">4. Browse Weeks:</span> Access week-specific content
            </li>
            <li>
              <span className="font-semibold">5. Collaborate:</span> Chat, share resources, and learn
            </li>
          </ol>
        </div>
      </div>
    </MainLayout>
  );
}
