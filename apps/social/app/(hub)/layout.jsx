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
            <h1 className="text-lg font-bold text-content-primary">
              Marketing Command Center
            </h1>
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
