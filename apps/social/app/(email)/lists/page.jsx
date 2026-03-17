'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

export default function EmailListsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const utils = trpc.useUtils();
  const { data: lists, isLoading } = trpc.emailLists.list.useQuery();

  const createMutation = trpc.emailLists.create.useMutation({
    onSuccess: () => {
      utils.emailLists.list.invalidate();
      setName('');
      setDescription('');
      setShowCreate(false);
    },
  });

  const deleteMutation = trpc.emailLists.delete.useMutation({
    onSuccess: () => {
      utils.emailLists.list.invalidate();
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), description: description.trim() || undefined });
  };

  const handleDelete = (id, listName) => {
    if (!confirm(`Delete "${listName}" and all its subscribers?`)) return;
    deleteMutation.mutate({ id });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-content-primary">Email Lists</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showCreate ? 'Cancel' : 'New List'}
        </button>
      </div>

      {/* Create list form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-surface-card border border-border rounded-xl shadow-sm p-5 mb-6"
        >
          <h3 className="text-sm font-semibold text-content-primary mb-3">Create New List</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                List Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly Newsletter"
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      )}

      {/* Lists display */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl shadow-sm p-5 animate-pulse">
              <div className="h-5 w-48 bg-skeleton rounded mb-2" />
              <div className="h-4 w-32 bg-skeleton rounded" />
            </div>
          ))}
        </div>
      ) : lists?.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">&#x1F4E7;</p>
          <h3 className="text-lg font-semibold text-content-primary mb-1">No email lists yet</h3>
          <p className="text-sm text-content-muted mb-4">
            Create your first list to start managing email subscribers.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Your First List
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lists?.map((list) => (
            <div
              key={list.id}
              className="bg-surface-card border border-border rounded-xl shadow-sm p-5 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <Link
                href={`/email/lists/${list.id}`}
                className="flex-1 min-w-0"
              >
                <h3 className="text-sm font-semibold text-content-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {list.name}
                </h3>
                {list.description && (
                  <p className="text-xs text-content-muted mt-0.5 truncate max-w-md">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-content-faint">
                  <span>{list._count.subscribers} subscriber{list._count.subscribers !== 1 ? 's' : ''}</span>
                  <span>Created {new Date(list.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(list.id, list.name)}
                disabled={deleteMutation.isPending}
                className="ml-4 p-2 text-content-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                title="Delete list"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
