'use client';

import { useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import useStore from '@/store/useStore';

export default function MainLayout({ children }) {
  const store = useStore();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        store.sidebarOpen ? 'ml-64' : 'ml-20'
      }`}>
        {/* Top Bar */}
        <header className="sticky top-0 bg-white border-b border-slate-200 z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => store.toggleSidebar()}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-4">
              {store.isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {store.user?.name}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                    {store.user?.name?.charAt(0)}
                  </div>
                </div>
              ) : (
                <a href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Login
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="overflow-auto h-[calc(100vh-64px)]">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Disclaimer Footer */}
      <footer className="fixed bottom-0 right-0 text-xs text-slate-500 p-2 bg-white border-t border-slate-200 w-full">
        <div className="text-center">
          <p>Not affiliated with NPTEL. Content belongs to original creators. | MIT License</p>
        </div>
      </footer>
    </div>
  );
}
