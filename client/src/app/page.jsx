'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useStore from '@/store/useStore';

export default function Home() {
  const router = useRouter();
  const { authReady } = useStore((state) => ({
    authReady: state.authReady,
  }));

  useEffect(() => {
    if (authReady) {
      router.replace('/dashboard');
    }
  }, [authReady, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
        Loading your dashboard...
      </div>
    </div>
  );
}
