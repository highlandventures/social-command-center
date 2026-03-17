'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

const categoryColors = {
  newsletter: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  announcement: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  product_update: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  event_invite: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  custom: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
};

function formatCategory(cat) {
  if (!cat) return 'Custom';
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TemplatesPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.emailTemplates.list.useQuery();

  const duplicateMutation = trpc.emailTemplates.duplicate.useMutation({
    onSuccess: (newTemplate) => {
      utils.emailTemplates.list.invalidate();
      router.push(`/email/templates/${newTemplate.id}`);
    },
  });

  const deleteMutation = trpc.emailTemplates.delete.useMutation({
    onSuccess: () => {
      utils.emailTemplates.list.invalidate();
    },
  });

  const handleDuplicate = (id) => {
    duplicateMutation.mutate({ id });
  };

  const handleDelete = (id, name) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-content-primary">Templates</h2>
        <Link
          href="/email/templates/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Create Template
        </Link>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl shadow-sm p-5 animate-pulse">
              <div className="h-5 w-40 bg-skeleton rounded mb-3" />
              <div className="h-4 w-24 bg-skeleton rounded mb-2" />
              <div className="h-4 w-56 bg-skeleton rounded" />
            </div>
          ))}
        </div>
      ) : templates?.length === 0 ? (
        /* Empty state */
        <div className="bg-surface-card border border-border rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">&#x1F3A8;</p>
          <h3 className="text-lg font-semibold text-content-primary mb-1">No templates yet</h3>
          <p className="text-sm text-content-muted mb-4">
            Create your first email template to get started.
          </p>
          <Link
            href="/email/templates/new"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Your First Template
          </Link>
        </div>
      ) : (
        /* Template grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((template) => (
            <div
              key={template.id}
              className="bg-surface-card border border-border rounded-xl shadow-sm p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex flex-col"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-2">
                <Link
                  href={`/email/templates/${template.id}`}
                  className="text-sm font-semibold text-content-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate flex-1 min-w-0"
                >
                  {template.name}
                </Link>
                {template.isStarter && (
                  <span className="ml-2 shrink-0 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-medium">
                    Starter
                  </span>
                )}
              </div>

              {/* Category badge */}
              <div className="mb-2">
                <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full ${categoryColors[template.category] || categoryColors.custom}`}>
                  {formatCategory(template.category)}
                </span>
              </div>

              {/* Subject preview */}
              {template.subject && (
                <p className="text-xs text-content-muted truncate mb-2">
                  Subject: {template.subject}
                </p>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-4 text-xs text-content-faint mt-auto pt-2">
                <span>{template._count?.campaigns || 0} campaign{(template._count?.campaigns || 0) !== 1 ? 's' : ''}</span>
                <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-secondary">
                <Link
                  href={`/email/templates/${template.id}`}
                  className="px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDuplicate(template.id)}
                  disabled={duplicateMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-content-secondary hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  Duplicate
                </button>
                {!template.isStarter && (
                  <button
                    onClick={() => handleDelete(template.id, template.name)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-content-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 ml-auto"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
