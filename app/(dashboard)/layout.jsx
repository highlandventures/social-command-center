'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { Avatar } from '@/components/ui';
import { AccountProvider } from '@/lib/account-context';
import { ThemeToggle } from '@/components/theme-toggle';

const tabs = [
  { key: "/", label: "Dashboard", icon: "\uD83D\uDCCA" },
  { key: "/composer", label: "Composer", icon: "\u270F\uFE0F" },
  { key: "/calendar", label: "Calendar", icon: "\uD83D\uDCC5" },
  { key: "/listening", label: "Social Listening", icon: "\uD83D\uDC42" },
  { key: "/kol", label: "KOL Tracking", icon: "\uD83C\uDF1F" },
  { key: "/reports", label: "Reports", icon: "\uD83D\uDCCB" },
  { key: "/admin", label: "Admin", icon: "\u2699" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null); // null = "All Accounts"

  // Fetch accounts for the account switcher in the top nav
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const accountsList = accounts ?? [];
  const userEmail = session?.user?.email || '';
  const userInitial = (userEmail[0] || 'U').toUpperCase();

  /** Check if this tab href matches the current route */
  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-surface-page">
      {/* ── Top navigation bar ── */}
      <header className="relative z-30 bg-surface-card border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-content-primary">
              Social Command Center
            </h1>
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
              Internal
            </span>
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

            {/* Theme toggle */}
            <ThemeToggle />

            {/* User menu */}
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
        </div>
      </header>

      {/* ── Tab navigation bar ── */}
      <div className="relative z-20 bg-surface-card border-b border-border px-6">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const active = isActive(tab.key);
            return (
              <Link
                key={tab.key}
                href={tab.key}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-content-primary text-content-primary'
                    : 'border-transparent text-content-muted hover:text-content-secondary hover:border-content-faint'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Page content ── */}
      <AccountProvider value={{ selectedAccount, setSelectedAccount }}>
        <main className="px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
      </AccountProvider>
    </div>
  );
}
