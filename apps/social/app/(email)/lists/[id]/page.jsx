'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'];

const STATUS_BADGE = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  UNSUBSCRIBED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  BOUNCED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  COMPLAINED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function SubscriberDetailPage() {
  const params = useParams();
  const listId = params.id;

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const utils = trpc.useUtils();

  // Fetch all lists to find current list name
  const { data: lists } = trpc.emailLists.list.useQuery();
  const currentList = lists?.find((l) => l.id === listId);

  // Fetch subscribers with filters
  const { data: subscriberData, isLoading } = trpc.emailSubscribers.list.useQuery({
    listId,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    search: searchQuery || undefined,
    limit: 50,
  });

  // Load more state
  const [allItems, setAllItems] = useState([]);
  const [currentCursor, setCurrentCursor] = useState(undefined);

  // Reset items when filters change or initial data loads
  useEffect(() => {
    if (subscriberData) {
      setAllItems(subscriberData.items);
      setCurrentCursor(subscriberData.nextCursor);
    }
  }, [subscriberData]);

  // Load more query (only when cursor is set manually)
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (!currentCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const moreData = await utils.client.emailSubscribers.list.query({
        listId,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchQuery || undefined,
        limit: 50,
        cursor: currentCursor,
      });
      setAllItems((prev) => [...prev, ...moreData.items]);
      setCurrentCursor(moreData.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Mutations
  const createMutation = trpc.emailSubscribers.create.useMutation({
    onSuccess: () => {
      utils.emailSubscribers.list.invalidate();
      utils.emailLists.list.invalidate();
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setShowAddForm(false);
    },
  });

  const importMutation = trpc.emailSubscribers.importCSV.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setImportPreview(null);
      utils.emailSubscribers.list.invalidate();
      utils.emailLists.list.invalidate();
    },
  });

  const deleteMutation = trpc.emailSubscribers.delete.useMutation({
    onSuccess: () => {
      utils.emailSubscribers.list.invalidate();
      utils.emailLists.list.invalidate();
    },
  });

  const handleAddSubscriber = (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    createMutation.mutate({
      listId,
      email: newEmail.trim(),
      firstName: newFirstName.trim() || undefined,
      lastName: newLastName.trim() || undefined,
    });
  };

  const handleDeleteSubscriber = (id) => {
    if (!confirm('Remove this subscriber?')) return;
    deleteMutation.mutate({ id });
  };

  // CSV parsing
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) {
          setImportError('CSV file must have a header row and at least one data row.');
          return;
        }

        // Parse header
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        const emailIdx = headers.findIndex((h) => h === 'email');
        if (emailIdx === -1) {
          setImportError('CSV must have an "email" column header.');
          return;
        }
        const firstNameIdx = headers.findIndex((h) =>
          h === 'firstname' || h === 'first name' || h === 'first_name'
        );
        const lastNameIdx = headers.findIndex((h) =>
          h === 'lastname' || h === 'last name' || h === 'last_name'
        );

        // Parse data rows
        const subscribers = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^['"]|['"]$/g, ''));
          const email = (cols[emailIdx] || '').toLowerCase().trim();
          if (!email || !email.includes('@')) continue;
          subscribers.push({
            email,
            firstName: firstNameIdx !== -1 ? cols[firstNameIdx] || null : null,
            lastName: lastNameIdx !== -1 ? cols[lastNameIdx] || null : null,
          });
        }

        if (subscribers.length === 0) {
          setImportError('No valid email addresses found in CSV.');
          return;
        }

        setImportPreview(subscribers);
      } catch {
        setImportError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    importMutation.mutate({ listId, subscribers: importPreview });
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-content-muted mb-4">
        <Link href="/email/lists" className="hover:text-content-primary transition-colors">
          Lists
        </Link>
        <span>&rsaquo;</span>
        <span className="text-content-primary font-medium">
          {currentList?.name || 'Loading...'}
        </span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-primary">
            {currentList?.name || 'Subscribers'}
          </h2>
          {currentList?.description && (
            <p className="text-sm text-content-muted mt-1">{currentList.description}</p>
          )}
        </div>
      </div>

      {/* Toolbar: search, filter, import, add */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 min-w-[200px] px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All Statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-surface-card border border-border hover:bg-surface-hover text-sm font-medium text-content-secondary rounded-lg transition-colors"
        >
          Import CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Subscriber'}
        </button>
      </div>

      {/* Import error */}
      {importError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-red-700 dark:text-red-300">{importError}</p>
          <button
            onClick={() => setImportError(null)}
            className="text-xs text-red-600 dark:text-red-400 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import preview */}
      {importPreview && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {importPreview.length} valid subscriber{importPreview.length !== 1 ? 's' : ''} found. Import?
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleConfirmImport}
              disabled={importMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {importMutation.isPending ? 'Importing...' : 'Confirm Import'}
            </button>
            <button
              onClick={() => setImportPreview(null)}
              className="px-3 py-1.5 text-xs text-content-muted hover:text-content-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            {importResult.imported} of {importResult.total} imported
            {importResult.total - importResult.imported > 0 &&
              ` (${importResult.total - importResult.imported} duplicate${importResult.total - importResult.imported !== 1 ? 's' : ''} skipped)`}
          </p>
          <button
            onClick={() => setImportResult(null)}
            className="text-xs text-green-600 dark:text-green-400 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add subscriber form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubscriber}
          className="bg-surface-card border border-border rounded-xl shadow-sm p-4 mb-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-content-muted mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="subscriber@example.com"
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-content-muted mb-1">First Name</label>
            <input
              type="text"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              placeholder="Jane"
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-content-muted mb-1">Last Name</label>
            <input
              type="text"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              placeholder="Doe"
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || !newEmail.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {createMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}

      {/* Subscribers table */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-4 w-48 bg-skeleton rounded" />
                <div className="h-4 w-24 bg-skeleton rounded" />
                <div className="h-4 w-24 bg-skeleton rounded" />
                <div className="h-4 w-16 bg-skeleton rounded" />
              </div>
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-3">&#x1F465;</p>
            <h3 className="text-sm font-semibold text-content-primary mb-1">No subscribers yet</h3>
            <p className="text-xs text-content-muted">
              Import a CSV or add subscribers manually.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-content-muted text-xs">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-content-muted text-xs">First Name</th>
                    <th className="text-left px-4 py-3 font-medium text-content-muted text-xs">Last Name</th>
                    <th className="text-left px-4 py-3 font-medium text-content-muted text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-content-muted text-xs">Added</th>
                    <th className="text-right px-4 py-3 font-medium text-content-muted text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((sub) => (
                    <tr key={sub.id} className="border-b border-border-secondary last:border-0 hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-3 text-content-primary font-medium">{sub.email}</td>
                      <td className="px-4 py-3 text-content-secondary">{sub.firstName || '-'}</td>
                      <td className="px-4 py-3 text-content-secondary">{sub.lastName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[sub.status] || ''}`}>
                          {sub.status.charAt(0) + sub.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-content-faint text-xs">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteSubscriber(sub.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1 text-content-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Remove subscriber"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {currentCursor && (
              <div className="p-4 text-center border-t border-border">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
