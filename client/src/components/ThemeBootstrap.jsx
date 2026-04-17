'use client';

import { useEffect, useRef } from 'react';
import useStore from '@/store/useStore';

const THEME_STORAGE_KEY = 'nptel-theme';

const normalizeTheme = (value) => (value === 'dark' ? 'dark' : 'light');

export const applyThemeToDocument = (theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedTheme = normalizeTheme(theme);
  const root = document.documentElement;

  root.dataset.theme = normalizedTheme;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(normalizedTheme === 'dark' ? 'theme-dark' : 'theme-light');

  if (document.body) {
    document.body.dataset.theme = normalizedTheme;
  }
};

const getPreferredTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function ThemeBootstrap() {
  const currentTheme = useStore((state) => state.currentTheme);
  const setTheme = useStore((state) => state.setTheme);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    const theme = getPreferredTheme();
    applyThemeToDocument(theme);

    if (theme !== currentTheme) {
      setTheme(theme);
    }
  }, [currentTheme, setTheme]);

  useEffect(() => {
    applyThemeToDocument(currentTheme);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(currentTheme));
    }
  }, [currentTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextTheme = normalizeTheme(event.newValue);
      applyThemeToDocument(nextTheme);
      setTheme(nextTheme);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [setTheme]);

  return null;
}
