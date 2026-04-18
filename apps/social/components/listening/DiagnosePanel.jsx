'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { SectionTitle } from '@/components/ui';

/**
 * Self-contained Diagnose panel — shared between:
 *   - /listening (Diagnose sub-tab — in context of the feed)
 *   - /admin → Listening Ontology (historical home, currently unused — admins land
 *     on Brand Entities + gaps tile + patterns panel instead)
 *
 * The `onFixGap` prop receives a `{ kind, logId, ... }` payload describing the
 * user's chosen remediation. On /admin we open the entity editor inline. On
 * /listening we stash the payload to sessionStorage and route to /admin so the
 * same editor handles it — same mental model, one implementation.
 */
export default function DiagnosePanel({ onFixGap }) {
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');

  const diagnoseMutation = trpc.listening.diagnose.useMutation();

  const run = (e) => {
    e.preventDefault();
    diagnoseMutation.mutate({
      ...(url ? { url } : {}),
      ...(content ? { content } : {}),
      ...(author ? { authorUsername: author } : {}),
    });
  };

  const result = diagnoseMutation.data;
  const outcome = result?.outcome;
  const outcomeStyles = {
    CAPTURED_AS_HIT: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    CAPTURED_AS_MENTION: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    WOULD_BE_CAPTURED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    NO_QUERY_MATCH: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    BLOCKED_BY_NEGATIVE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    INSUFFICIENT_INPUT: 'bg-gray-100 text-gray-700',
  };

  const suggestedHandles = author ? [author.replace(/^@/, '')] : [];
  const suggestedName = author ? author.replace(/^@/, '') : (content.split(/\s+/)[0] || '');

  return (
    <div className="space-y-4">
      <SectionTitle subtitle="Paste a tweet URL or its text to trace why the listening pipeline did (or didn't) capture it. Every diagnosis is logged for ontology review.">
        Diagnose a post
      </SectionTitle>

      <form onSubmit={run} className="bg-surface-card rounded-xl border border-border p-4 space-y-3">
        <Field label="Tweet URL">
          <input type="url" placeholder="https://x.com/Figure/status/…" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
        </Field>
        <Field label="— OR — paste content">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
        </Field>
        <Field label="Author username (optional, helps match from:X operators)">
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="mcagney" className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={diagnoseMutation.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {diagnoseMutation.isPending ? 'Diagnosing…' : 'Diagnose'}
          </button>
        </div>
      </form>

      {result && (
        <div className="bg-surface-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${outcomeStyles[outcome] || 'bg-gray-100 text-gray-700'}`}>
              {outcome?.replace(/_/g, ' ')}
            </span>
            {result.logId && (
              <span className="text-[10px] text-content-faint font-mono">log: {result.logId.slice(-6)}</span>
            )}
          </div>
          <p className="text-sm text-content-secondary mb-3">{result.detail}</p>

          {outcome === 'NO_QUERY_MATCH' && result.classification?.mode === 'EXTEND_ENTITY' && (
            <div className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-900 dark:text-blue-200 mb-2">
                <strong>Extend an existing entity (recommended).</strong>{' '}
                This looks like a variation of{' '}
                <span className="font-semibold">{result.classification.entity.canonicalName}</span>{' '}
                (similarity {Math.round(result.classification.similarity * 100)}%).
                Add <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{result.classification.token}</code> to its <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{result.classification.field}</code> instead of creating a new row.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    onFixGap?.({
                      kind: 'extend-entity',
                      logId: result.logId,
                      entityName: result.classification.entity.canonicalName,
                      addToField: result.classification.field,
                      addToken: result.classification.token,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  → Extend {result.classification.entity.canonicalName}
                </button>
                <button
                  onClick={() =>
                    onFixGap?.({
                      kind: 'fix-gap',
                      logId: result.logId,
                      suggestedName: result.classification.suggestedName || suggestedName,
                      suggestedHandles: result.classification.suggestedHandles || suggestedHandles,
                      suggestedKind: 'BRAND',
                    })
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-secondary text-content-secondary hover:bg-surface-tertiary border border-border"
                >
                  or create a new entity…
                </button>
              </div>
            </div>
          )}

          {outcome === 'NO_QUERY_MATCH' && result.classification?.mode !== 'EXTEND_ENTITY' && (
            <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-900 dark:text-amber-200 mb-2">
                <strong>No existing entity is a close match.</strong> Create a new one — the planner will generate queries to catch this pattern going forward.
              </p>
              <button
                onClick={() =>
                  onFixGap?.({
                    kind: 'fix-gap',
                    logId: result.logId,
                    suggestedName: result.classification?.suggestedName || suggestedName,
                    suggestedHandles: result.classification?.suggestedHandles || suggestedHandles,
                    suggestedKind: 'BRAND',
                  })
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                + Create entity
              </button>
            </div>
          )}

          {outcome === 'BLOCKED_BY_NEGATIVE' && (result.blockers || []).length > 0 && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-900 dark:text-red-200 mb-2">
                <strong>A negative keyword is excluding this post.</strong> Open the owning entity and remove the offending term.
              </p>
              <div className="flex flex-wrap gap-2">
                {result.blockers.map((b) => (
                  <button
                    key={b.queryId}
                    onClick={() =>
                      onFixGap?.({
                        kind: 'fix-negative',
                        logId: result.logId,
                        entityName: b.entity,
                      })
                    }
                    disabled={!b.entity}
                    title={!b.entity ? 'This is a hand-written query — edit it under Listening > Topics' : undefined}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Edit {b.entity || 'hand-written query'} → remove “{b.blockedBy}”
                  </button>
                ))}
              </div>
            </div>
          )}

          {result.matched && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-content-muted mb-1">Matched queries</h4>
              <div className="space-y-1.5">
                {result.matched.map((m) => (
                  <div key={m.queryId} className="text-xs font-mono bg-surface-secondary rounded p-2">
                    <div className="mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold uppercase mr-2">
                        {m.template.replace(/_/g, ' ')}
                      </span>
                      {m.entity && <span className="text-content-primary">{m.entity}</span>}
                      {m.topic && <span className="text-content-faint ml-2">· {m.topic}</span>}
                    </div>
                    <div className="text-content-muted">matched: <code className="text-content-primary">{m.matchedToken}</code></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-content-secondary mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-content-muted mt-0.5">{hint}</p>}
    </div>
  );
}
