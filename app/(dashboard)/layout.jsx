'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { Avatar } from '@/components/ui';

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

  // Fetch accounts for the account switcher in the top nav
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const accountsList = accounts ?? [];

  /** Check if this tab href matches the current route */
  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top navigation bar ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">
              Social Command Center
            </h1>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              Internal
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Account switcher */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex -space-x-1.5">
                {accountsList.length > 0
                  ? accountsList.map((a) => (
                      <Avatar
                        key={a.id}
                        initials={a.avatar ?? a.handle?.slice(1, 3).toUpperCase() ?? '??'}
                        platform={a.platform}
                        size="sm"
                      />
                    ))
                  : /* Fallback while loading */
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-gray-200 animate-pulse"
                      />
                    ))}
              </div>
              <span className="text-sm text-gray-600 ml-1">All Accounts</span>
              <span className="text-gray-400">{'\u25BE'}</span>
            </div>

            {/* User menu */}
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              M
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab navigation bar ── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const active = isActive(tab.key);
            return (
              <Link
                key={tab.key}
                href={tab.key}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
      <main className="px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
}
