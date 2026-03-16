'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HubLayout({ children }) {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';
  const userInitial = (clerkUser?.firstName?.[0] || userEmail[0] || 'U').toUpperCase();

  return (
    <div className="min-h-screen bg-surface-page">
      {/* ── Top bar ── */}
      <header className="bg-surface-card border-b border-border px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-content-primary">
            Marketing Command Center
          </h1>

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
                  <div className="absolute right-0 mt-2 w-56 bg-surface-card rounded-lg shadow-lg border border-border z-50 py-1">
                    <div className="px-4 py-2 border-b border-border-secondary">
                      <p className="text-sm font-medium text-content-primary truncate">
                        {userEmail}
                      </p>
                      <p className="text-xs text-content-muted">
                        {clerkUser?.publicMetadata?.role || 'User'}
                      </p>
                    </div>
                    <button
                      onClick={() => signOut()}
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
