import './globals.css';
import Providers from '@/components/providers';

export const metadata = {
  title: 'Social Command Center — Highland Ventures',
  description: 'Internal social media management, monitoring, and reporting tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
