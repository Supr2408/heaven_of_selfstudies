'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import useStore from '@/store/useStore';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated } = useStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return <MainLayout>{children}</MainLayout>;
}
