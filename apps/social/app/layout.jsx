import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Providers from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'Marketing Command Center — Highland Ventures',
  description: 'Internal marketing hub — social media, ads, email, and analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-surface-page antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
