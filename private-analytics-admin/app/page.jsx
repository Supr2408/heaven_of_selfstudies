'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getStoredToken() ? '/dashboard' : '/login');
  }, [router]);

  return <div className="admin-loading-screen">Loading private analytics dashboard...</div>;
}
