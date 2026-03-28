'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

import { useSession, signOut } from 'next-auth/react';

const tabs = [
  { key: '/email/lists', label: 'Lists', icon: '\uD83D\uDCCB' },
  { key: '/email/templates', label: 'Templates', icon: '\uD83C\uDFA8' },
  { key: '/email/campaigns', label: 'Campaigns', icon: '\u2709\uFE0F' },
];

export default function EmailLayout({ children }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const userEmail = session?.user?.email || '';
  const userName = session?.user?.name || '';
  const userInitial = (userName?.[0] || userEmail[0] || 'U').toUpperCase();

  /** Check if this tab href matches the current route */
  const isActive = (href) => {
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-surface-card border-r border-border z-50 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-content-primary">
              Email Campaigns
            </h1>
            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-medium">
              Internal
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md hover:bg-surface-hover transition-colors text-content-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation links */}
        <nav className="py-2 px-3 flex flex-col gap-0.5">
          {/* Back to hub */}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-content-faint hover:text-content-secondary hover:bg-surface-hover transition-colors mb-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Marketing Hub
          </Link>
          <div className="border-t border-border-secondary mb-1" />
          {tabs.map((tab) => {
            const active = isActive(tab.key);
            return (
              <Link
                key={tab.key}
                href={tab.key}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content-secondary'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-content-primary truncate">{userEmail}</p>
              <p className="text-xs text-content-muted">{session?.user?.role || 'User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="relative z-30 bg-surface-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-content-secondary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-content-primary">
              Email Campaigns
            </h1>
          </div>

          {/* User avatar with dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              {userInitial}
            </button>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div
                  className="absolute right-0 mt-2 w-56 bg-surface-card rounded-lg shadow-lg border border-border z-50 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-2 border-b border-border-secondary">
                    <p className="text-sm font-medium text-content-primary truncate">{userEmail}</p>
                    <p className="text-xs text-content-muted">{session?.user?.role || 'User'}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
}
