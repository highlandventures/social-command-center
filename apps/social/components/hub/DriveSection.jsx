'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Skeleton } from '@/components/ui';
import GoogleConnectCard from './GoogleConnectCard';

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── File Type Icons (SVG) ────────────────────────────────────

const FILE_ICONS = {
  'application/vnd.google-apps.document': (
    <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6zm2-7h8v1.5H8V13zm0 3h8v1.5H8V16zm0-6h3v1.5H8V10z"/>
    </svg>
  ),
  'application/vnd.google-apps.spreadsheet': (
    <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6zm2-7h3v1.5H8V13zm5 0h3v1.5h-3V13zm-5 3h3v1.5H8V16zm5 3h3v1.5h-3V16z"/>
    </svg>
  ),
  'application/vnd.google-apps.presentation': (
    <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6zm2-6h8v4H8v-4z"/>
    </svg>
  ),
  'application/vnd.google-apps.folder': (
    <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/>
    </svg>
  ),
  'application/pdf': (
    <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
    </svg>
  ),
};

function getFileIcon(mimeType) {
  return FILE_ICONS[mimeType] || (
    <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

/**
 * Build the embedded editor URL for a Google Workspace file.
 * Falls back to webViewLink for non-Workspace files (PDFs, images, etc.)
 */
function getEmbedUrl(file) {
  if (!file) return null;
  const { id, mimeType } = file;

  const EMBED_MAP = {
    'application/vnd.google-apps.document': `https://docs.google.com/document/d/${id}/edit?embedded=true`,
    'application/vnd.google-apps.spreadsheet': `https://docs.google.com/spreadsheets/d/${id}/edit?embedded=true&rm=minimal`,
    'application/vnd.google-apps.presentation': `https://docs.google.com/presentation/d/${id}/edit?embedded=true&rm=minimal`,
  };

  return EMBED_MAP[mimeType] || null;
}

// ── Type filter chips ────────────────────────────────────────

const TYPE_FILTERS = [
  { label: 'All', mimeType: null },
  { label: 'Docs', mimeType: 'application/vnd.google-apps.document' },
  { label: 'Sheets', mimeType: 'application/vnd.google-apps.spreadsheet' },
  { label: 'Slides', mimeType: 'application/vnd.google-apps.presentation' },
  { label: 'PDFs', mimeType: 'application/pdf' },
];

// ── File Row ─────────────────────────────────────────────────

function FileRow({ file, onOpenEditor }) {
  const embedUrl = getEmbedUrl(file);

  function handleClick(e) {
    // If embeddable, open in the inline editor panel
    if (embedUrl) {
      e.preventDefault();
      onOpenEditor(file);
    }
    // Otherwise, the <a> tag opens webViewLink in a new tab
  }

  return (
    <a
      href={file.webViewLink || '#'}
      target={embedUrl ? undefined : '_blank'}
      rel={embedUrl ? undefined : 'noopener noreferrer'}
      onClick={handleClick}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group"
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {getFileIcon(file.mimeType)}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content-primary truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {file.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-secondary text-content-faint">
            {file.typeLabel}
          </span>
          {file.owner && (
            <span className="text-xs text-content-faint truncate">{file.owner}</span>
          )}
        </div>
      </div>

      {/* Time + open indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-content-muted">{timeAgo(file.modifiedTime)}</span>
        {embedUrl ? (
          <span className="text-[10px] font-medium text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
            Edit
          </span>
        ) : (
          <svg className="w-3 h-3 text-content-faint opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        )}
      </div>
    </a>
  );
}

// ── Embedded Editor Panel ────────────────────────────────────

function EditorPanel({ file, onClose }) {
  const embedUrl = getEmbedUrl(file);

  if (!embedUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex">
      {/* Sidebar with file info */}
      <div className="w-72 bg-surface-primary border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            {getFileIcon(file.mimeType)}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-secondary text-content-faint">
              {file.typeLabel}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-content-primary leading-snug">
            {file.name}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs text-content-muted">
            {file.owner && <span>{file.owner}</span>}
            {file.modifiedTime && (
              <>
                <span className="text-content-faint">&middot;</span>
                <span>{timeAgo(file.modifiedTime)}</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 flex-1">
          <p className="text-xs text-content-faint">
            Editing in Google {file.typeLabel?.replace('Google ', '')}. Changes save automatically.
          </p>
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full text-xs font-medium text-content-secondary rounded-lg border border-border px-3 py-2 hover:bg-surface-secondary transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in full Google {file.typeLabel?.replace('Google ', '')}
          </a>
          <button
            onClick={onClose}
            className="w-full text-xs font-medium text-content-muted rounded-lg border border-border px-3 py-2 hover:bg-surface-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Editor iframe */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-10 bg-surface-primary border-b border-border flex items-center justify-between px-4">
          <span className="text-xs text-content-muted truncate">{file.name}</span>
          <button
            onClick={onClose}
            className="text-content-faint hover:text-content-primary transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Iframe */}
        <iframe
          src={embedUrl}
          className="flex-1 w-full border-0"
          allow="clipboard-read; clipboard-write"
          title={`Edit ${file.name}`}
        />
      </div>
    </div>
  );
}

// ── Search Input ─────────────────────────────────────────────

function SearchInput({ value, onChange, onClear }) {
  return (
    <div className="relative mb-3">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onClear()}
        placeholder="Search Drive..."
        className="w-full text-xs bg-surface-secondary text-content-primary placeholder:text-content-faint rounded-lg border border-border pl-8 pr-8 py-1.5 outline-none focus:border-blue-400 transition-colors"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-faint hover:text-content-primary"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Re-auth Banner ───────────────────────────────────────────

function DriveReauthBanner() {
  return (
    <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 mb-3">
      <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
        Reconnect Google to enable Drive access
      </p>
      <a
        href="/api/connect/google"
        className="inline-flex items-center gap-1.5 text-[10px] font-medium bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 transition-colors"
      >
        Reconnect
      </a>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function DriveSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(null); // mimeType or null
  const [showFilters, setShowFilters] = useState(false);
  const [editorFile, setEditorFile] = useState(null);

  // Debounce search input
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    clearTimeout(window.__driveSearchTimeout);
    window.__driveSearchTimeout = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 400);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearch('');
  }, []);

  // Connection status
  const { data: connStatus } = trpc.google.connectionStatus.useQuery(undefined, {
    staleTime: 300_000,
  });

  // Recent files (when not searching)
  const recentQuery = trpc.google.driveRecentFiles.useQuery(
    { pageSize: 5 },
    {
      staleTime: 120_000,
      enabled: !!connStatus?.connected && !debouncedSearch,
    }
  );

  // Search results (when searching)
  const searchQuery = trpc.google.driveSearch.useQuery(
    { searchTerm: debouncedSearch, pageSize: 10, mimeType: activeFilter || undefined },
    {
      staleTime: 60_000,
      enabled: !!connStatus?.connected && !!debouncedSearch,
    }
  );

  const isSearching = !!debouncedSearch;
  const activeQuery = isSearching ? searchQuery : recentQuery;
  const files = activeQuery.data?.files || [];
  const isLoading = activeQuery.isLoading;
  const isConnected = connStatus?.connected;

  // Check if Drive scope is missing (connected to Google but no Drive)
  const hasDriveScope = connStatus?.connected; // The tRPC response will error if scope is missing — we detect via error state
  const driveError = activeQuery.data?.error;
  const needsReauth = isConnected && driveError?.includes('insufficient');

  // Filter files by type when not searching (search already filters via API)
  const displayFiles = (!isSearching && activeFilter)
    ? files.filter(f => f.mimeType === activeFilter)
    : files;

  return (
    <>
      <div className="bg-surface-card rounded-xl border border-border p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <h3 className="text-sm font-semibold text-content-primary">Drive</h3>
          {isConnected && (
            <a
              href="https://drive.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-content-faint hover:text-blue-500 ml-auto transition-colors"
            >
              Open &rarr;
            </a>
          )}
        </div>

        {/* Loading */}
        {isLoading && !isConnected && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <Skeleton className="w-4 h-4" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        )}

        {/* Not connected */}
        {!isLoading && connStatus && !isConnected && (
          <GoogleConnectCard
            title="Connect Google Drive"
            description="See your recent files and edit docs without leaving the hub"
          />
        )}

        {/* Needs re-auth for Drive scope */}
        {needsReauth && <DriveReauthBanner />}

        {/* Connected — show search + files */}
        {isConnected && !needsReauth && (
          <>
            {/* Search */}
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              onClear={clearSearch}
            />

            {/* Filter toggle + chips */}
            <div className="mb-3">
              <button
                onClick={() => {
                  setShowFilters(!showFilters);
                  if (showFilters) setActiveFilter(null); // reset filter when closing
                }}
                className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                  showFilters || activeFilter
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-surface-secondary text-content-muted hover:text-content-primary'
                }`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filter{activeFilter ? `: ${TYPE_FILTERS.find(f => f.mimeType === activeFilter)?.label}` : ''}
              </button>

              {showFilters && (
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
                  {TYPE_FILTERS.map(({ label, mimeType }) => (
                    <button
                      key={label}
                      onClick={() => setActiveFilter(mimeType)}
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                        activeFilter === mimeType
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-surface-secondary text-content-muted hover:text-content-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loading files */}
            {isLoading && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <Skeleton className="w-4 h-4" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-10" />
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {!isLoading && displayFiles.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-content-muted">
                  {isSearching ? 'No files found' : 'No recent files'}
                </p>
                <p className="text-xs text-content-faint mt-1">
                  {isSearching ? 'Try a different search term' : 'Files you edit will appear here'}
                </p>
              </div>
            )}

            {/* File list */}
            {!isLoading && displayFiles.length > 0 && (
              <div className="space-y-2">
                {displayFiles.map(file => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onOpenEditor={setEditorFile}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Embedded editor overlay */}
      {editorFile && (
        <EditorPanel
          file={editorFile}
          onClose={() => setEditorFile(null)}
        />
      )}
    </>
  );
}
