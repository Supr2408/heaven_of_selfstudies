'use client';

import { Moon, SunMedium } from 'lucide-react';
import useStore from '@/store/useStore';

export default function ThemeToggle({ className = '', compact = false }) {
  const currentTheme = useStore((state) => state.currentTheme);
  const setTheme = useStore((state) => state.setTheme);
  const isDarkTheme = currentTheme === 'dark';
  const nextTheme = isDarkTheme ? 'light' : 'dark';
  const visibleThemeLabel = isDarkTheme ? 'Dark' : 'Light';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${className}`.trim()}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      {isDarkTheme ? <SunMedium size={16} /> : <Moon size={16} />}
      <span className={compact ? 'hidden sm:inline' : ''}>{visibleThemeLabel}</span>
    </button>
  );
}
