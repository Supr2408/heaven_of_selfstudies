import './globals.css';
import { Metadata } from 'next';

export const metadata = {
  title: 'NPTEL Hub - Community Learning Platform',
  description: 'Community-driven learning ecosystem for NPTEL learners',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50">
        {children}
      </body>
    </html>
  );
}
