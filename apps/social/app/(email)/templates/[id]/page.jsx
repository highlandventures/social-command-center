'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

const categories = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'product_update', label: 'Product Update' },
  { value: 'event_invite', label: 'Event Invite' },
  { value: 'custom', label: 'Custom' },
];

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [category, setCategory] = useState('custom');
  const [previewHtml, setPreviewHtml] = useState('');
  const [saved, setSaved] = useState(false);

  const utils = trpc.useUtils();

  const { data: template, isLoading } = trpc.emailTemplates.getById.useQuery(
    { id: params.id },
    { enabled: !isNew }
  );

  const createMutation = trpc.emailTemplates.create.useMutation({
    onSuccess: (created) => {
      utils.emailTemplates.list.invalidate();
      router.push(`/email/templates/${created.id}`);
    },
  });

  const updateMutation = trpc.emailTemplates.update.useMutation({
    onSuccess: () => {
      utils.emailTemplates.getById.invalidate({ id: params.id });
      utils.emailTemplates.list.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const duplicateMutation = trpc.emailTemplates.duplicate.useMutation({
    onSuccess: (newTemplate) => {
      utils.emailTemplates.list.invalidate();
      router.push(`/email/templates/${newTemplate.id}`);
    },
  });

  // Populate form from loaded template
  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setSubject(template.subject || '');
      setHtmlBody(template.htmlBody || '');
      setCategory(template.category || 'custom');
    }
  }, [template]);

  // Debounced preview update
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewHtml(htmlBody);
    }, 500);
    return () => clearTimeout(timer);
  }, [htmlBody]);

  const handleSave = () => {
    if (isNew) {
      createMutation.mutate({
        name: name.trim() || 'Untitled Template',
        subject: subject.trim() || undefined,
        htmlBody,
        category,
      });
    } else {
      updateMutation.mutate({
        id: params.id,
        name: name.trim() || undefined,
        subject: subject.trim() || undefined,
        htmlBody,
        category,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isStarter = template?.isStarter === true;

  // Generate a simple key for iframe re-render
  const iframeKey = `preview-${previewHtml.length}-${previewHtml.slice(0, 20)}`;

  if (!isNew && isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-skeleton rounded animate-pulse" />
        <div className="h-10 w-full bg-skeleton rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-96 bg-skeleton rounded animate-pulse" />
          <div className="h-96 bg-skeleton rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/email/templates"
        className="inline-flex items-center gap-1.5 text-xs text-content-faint hover:text-content-secondary transition-colors mb-4"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Templates
      </Link>

      {/* Starter template banner */}
      {isStarter && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              This is a starter template
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Duplicate it to make your own customized version.
            </p>
          </div>
          <button
            onClick={() => duplicateMutation.mutate({ id: params.id })}
            disabled={duplicateMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate Template'}
          </button>
        </div>
      )}

      {/* Top bar: name, category, save */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          disabled={isStarter}
          className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm font-medium text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isStarter}
          className="px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isSaving || isStarter}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors min-w-[80px]"
        >
          {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Subject line */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-content-muted mb-1">Subject Line</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line (optional)"
          disabled={isStarter}
          className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
      </div>

      {/* Split-pane editor */}
      <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 320px)' }}>
        {/* Left: HTML editor */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-content-muted mb-1">HTML</label>
          <textarea
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            spellCheck={false}
            disabled={isStarter}
            className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-lg font-mono text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
            placeholder="<html>\n  <body>\n    <h1>Your email content here</h1>\n  </body>\n</html>"
          />
        </div>

        {/* Right: Live preview */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-content-muted mb-1">Preview</label>
          <div className="flex-1 border border-border rounded-lg overflow-hidden bg-white">
            {previewHtml ? (
              <iframe
                key={iframeKey}
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                className="w-full h-full border-0"
                title="Template preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                HTML preview will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
