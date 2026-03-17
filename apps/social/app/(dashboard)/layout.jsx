'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc-client';
import { Avatar } from '@/components/ui';
import { AccountProvider } from '@/lib/account-context';
import { ThemeToggle } from '@/components/theme-toggle';

const tabs = [
  { key: "/intelligence", label: "Intelligence", icon: "🧠" },
  { key: "/dashboard", label: "Dashboard", icon: "\uD83D\uDCCA" },
  { key: "/composer", label: "Composer", icon: "\u270F\uFE0F" },
  { key: "/reviews", label: "L&C Reviews", icon: "\uD83D\uDEE1\uFE0F" },
  { key: "/calendar", label: "Calendar", icon: "\uD83D\uDCC5" },
  { key: "/listening", label: "Social Listening", icon: "\uD83D\uDC42" },
  { key: "/kol", label: "KOL Tracking", icon: "\uD83C\uDF1F" },
  { key: "/competitors", label: "Competitors", icon: "\uD83C\uDFAF" },
  { key: "/reports", label: "Reports", icon: "\uD83D\uDCCB" },
  { key: "/admin", label: "Admin", icon: "\u2699" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null); // null = "All Accounts"
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Fetch accounts for the account switcher in the top nav
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const accountsList = (accounts ?? []).filter((a) => !a.isTest);
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';
  const userInitial = (clerkUser?.firstName?.[0] || userEmail[0] || 'U').toUpperCase();

  /** Check if this tab href matches the current route */
  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

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
              Social Command
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

        {/* Sidebar footer — user info & sign out */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-content-primary truncate">{userEmail}</p>
              <p className="text-xs text-content-muted">{clerkUser?.publicMetadata?.role || 'User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => signOut({ redirectUrl: '/auth/signin' })}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Top bar ── */}
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
              Social Command Center
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Account switcher */}
            <div className="relative">
              <button
                onClick={() => { setAccountMenuOpen(!accountMenuOpen); setUserMenuOpen(false); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg border border-border hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <div className="flex -space-x-1.5">
                  {accountsList.length > 0
                    ? (selectedAccount
                        ? [accountsList.find((a) => a.id === selectedAccount)].filter(Boolean)
                        : accountsList
                      ).map((a) => (
                        <Avatar
                          key={a.id}
                          initials={(a.username || '??').slice(0, 2).toUpperCase()}
                          src={a.avatarUrl}
                          platform={a.platform}
                          size="sm"
                        />
                      ))
                    : [1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full bg-skeleton animate-pulse"
                        />
                      ))}
                </div>
                <span className="text-sm text-content-secondary ml-1">
                  {selectedAccount
                    ? `@${accountsList.find((a) => a.id === selectedAccount)?.username || '...'}`
                    : 'All Accounts'}
                </span>
                <span className="text-content-faint">{'\u25BE'}</span>
              </button>
              {accountMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 mt-2 w-64 bg-surface-card rounded-lg shadow-lg border border-border z-50 py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setSelectedAccount(null); setAccountMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-surface-hover transition-colors ${
                        !selectedAccount ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-content-secondary'
                      }`}
                    >
                      <div className="flex -space-x-1">
                        {accountsList.slice(0, 3).map((a) => (
                          <Avatar
                            key={a.id}
                            initials={(a.username || '??').slice(0, 2).toUpperCase()}
                            src={a.avatarUrl}
                            platform={a.platform}
                            size="sm"
                          />
                        ))}
                      </div>
                      <span>All Accounts</span>
                      {!selectedAccount && <span className="ml-auto text-blue-500">{'\u2713'}</span>}
                    </button>
                    <div className="border-t border-border-secondary my-1" />
                    {accountsList.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAccount(a.id); setAccountMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-surface-hover transition-colors ${
                          selectedAccount === a.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-content-secondary'
                        }`}
                      >
                        <Avatar
                          initials={(a.username || '??').slice(0, 2).toUpperCase()}
                          src={a.avatarUrl}
                          platform={a.platform}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">@{a.username}</p>
                          <p className="text-xs text-content-faint capitalize">{(a.platform || '').toLowerCase()}</p>
                        </div>
                        {selectedAccount === a.id && <span className="text-blue-500">{'\u2713'}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* User avatar (opens sidebar on small screens, user menu on larger) */}
            <div className="relative">
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setAccountMenuOpen(false); }}
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
                      <p className="text-xs text-content-muted">{clerkUser?.publicMetadata?.role || 'User'}</p>
                    </div>
                    <button
                      onClick={() => signOut({ redirectUrl: '/auth/signin' })}
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

      {/* ── Page content ── */}
      <AccountProvider value={{ selectedAccount, setSelectedAccount }}>
        <main className="px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
      </AccountProvider>
    </div>
  );
}
