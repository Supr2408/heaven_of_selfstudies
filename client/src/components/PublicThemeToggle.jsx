'use client';

import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

const PUBLIC_THEME_ROUTES = new Set(['/', '/login', '/register']);

export default function PublicThemeToggle() {
  const pathname = usePathname();

  if (!PUBLIC_THEME_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <ThemeToggle />
    </div>
  );
}
