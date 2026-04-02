import './globals.css';
import AuthBootstrap from '@/components/AuthBootstrap';

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
    <html lang="en">
      <body className="bg-slate-50">
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
