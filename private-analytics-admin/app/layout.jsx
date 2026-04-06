import './globals.css';

export const metadata = {
  title: 'Private Analytics Admin',
  description: 'Admin dashboard for private NPTEL Hub analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
