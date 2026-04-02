'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import useStore from '@/store/useStore';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated, authReady } = useStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    authReady: state.authReady,
  }));

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authReady, isAuthenticated, router]);

  if (!authReady || !isAuthenticated) return null;

  return <MainLayout>{children}</MainLayout>;
}
