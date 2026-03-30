'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

const sections = [
  { key: '/dashboard', label: 'Social Command Center', icon: '💬' },
  { key: '/email/campaigns', label: 'Email Campaigns', icon: '✉️' },
];

export default function HubLayout({ children }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const userEmail = session?.user?.email || '';
  const userName = session?.user?.name || '';
  const userInitial = (userName?.[0] || userEmail[0] || 'U').toUpperCase();

  return (
    <div className="min-h-screen bg-surface-page">
      {/* ── Sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-surface-card border-r border-border z-50 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-content-primary">
              Marketing Hub
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
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-faint">
            Modules
          </p>
          {sections.map((section) => (
            <Link
              key={section.key}
              href={section.key}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content-secondary transition-colors"
            >
              <span className="text-base">{section.icon}</span>
              {section.label}
            </Link>
          ))}
        </nav>

        {/* Tools section — above footer */}
        <div className="px-3 mt-4">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-faint">
            Tools
          </p>
          <Link
            href="/drive"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content-secondary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
            Google Drive
          </Link>
          <Link
            href="/lc-review"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content-secondary transition-colors"
          >
            <span className="text-base">⚖️</span>
            L&amp;C Review
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content-secondary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Settings
          </Link>
        </div>

        {/* Connected Services */}
        <div className="px-3 mt-4">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-content-faint">
            Connected Services
          </p>
          <a
            href="/api/connect/google"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content-secondary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Connect Google
          </a>
        </div>

        {/* Sidebar footer — user info & sign out */}
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

      {/* ── Top bar ── */}
      <header className="bg-surface-card border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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
            <Link href="/" className="text-lg font-bold text-content-primary hover:text-content-secondary transition-colors">
              Marketing Command Center
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                {userInitial}
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 mt-2 w-56 bg-surface-card rounded-lg shadow-lg border border-border z-50 py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 py-2 border-b border-border-secondary">
                      <p className="text-sm font-medium text-content-primary truncate">
                        {userEmail}
                      </p>
                      <p className="text-xs text-content-muted">
                        {session?.user?.role || 'User'}
                      </p>
                    </div>
                    <a
                      href="/api/connect/google"
                      className="block px-4 py-2 text-sm text-content-secondary hover:bg-surface-hover transition-colors"
                    >
                      Connect Google
                    </a>
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
