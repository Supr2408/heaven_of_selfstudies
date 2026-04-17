import './globals.css';
import AuthBootstrap from '@/components/AuthBootstrap';
import PublicThemeToggle from '@/components/PublicThemeToggle';
import ThemeBootstrap from '@/components/ThemeBootstrap';

const themeInitScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem('nptel-theme');
      const theme =
        storedTheme === 'dark' || storedTheme === 'light'
          ? storedTheme
          : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.classList.remove('theme-light', 'theme-dark');
      root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    } catch (_) {}
  })();
`;

export const metadata = {
  title: 'NPTEL Hub - Community Learning Platform',
  description: 'Community-driven learning ecosystem for NPTEL learners',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AuthBootstrap />
        <ThemeBootstrap />
        <PublicThemeToggle />
        {children}
      </body>
    </html>
  );
}
