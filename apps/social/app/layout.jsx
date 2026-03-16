import './globals.css';
import Providers from '@/components/providers';

export const metadata = {
  title: 'Marketing Command Center — Highland Ventures',
  description: 'Internal marketing hub — social media, ads, email, and analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-surface-page antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
