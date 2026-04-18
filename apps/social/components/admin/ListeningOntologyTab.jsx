'use client';

import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';
import { SectionTitle } from '@/components/ui';

const KIND_OPTIONS = ['BRAND', 'PRODUCT', 'PERSON', 'SUBSIDIARY', 'TOKEN'];
const KIND_STYLES = {
  BRAND: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  PRODUCT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PERSON: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SUBSIDIARY: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  TOKEN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

/** Comma/space-separated list → string[] for the editor form. */
function parseList(raw) {
  return String(raw || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ListeningOntologyTab() {
  // Diagnose now lives on /listening → "Diagnose" sub-tab. This admin tab is
  // dedicated to ontology management: Brand Entities list + Gaps tile + Recurring
  // Patterns panel. When Diagnose on /listening triggers a Fix action, it stashes
  // the gap payload into sessionStorage and routes here — we pick it up on mount.
  const [editing, setEditing] = useState(null);

  const entitiesQ = trpc.listening.entities.list.useQuery(undefined, { staleTime: 10_000 });
  const gapSummaryQ = trpc.listening.diagnoseLogs.summary.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  const upsertMutation = trpc.listening.entities.upsert.useMutation({
    onSuccess: async (data, variables) => {
      utils.listening.entities.list.invalidate();
      utils.listening.diagnoseLogs.summary.invalidate();
      utils.listening.diagnoseLogs.list.invalidate();
      // If this upsert originated from a diagnose gap, mark the log resolved.
      const logId = editing?.origin?.logId;
      if (logId && data?.entity?.id) {
        try {
          await resolveLogMutation.mutateAsync({
            id: logId,
            entityId: data.entity.id,
            note: `Created/updated "${data.entity.canonicalName}" from diagnose gap`,
          });
        } catch {
          // Non-fatal — the entity saved; the log link is a nice-to-have.
        }
      }
      setEditing(null);
    },
  });
  const deleteMutation = trpc.listening.entities.delete.useMutation({
    onSuccess: () => utils.listening.entities.list.invalidate(),
  });
  const syncMutation = trpc.listening.syncQueries.useMutation({
    onSuccess: () => utils.listening.entities.list.invalidate(),
  });
  const resolveLogMutation = trpc.listening.diagnoseLogs.resolve.useMutation({
    onSuccess: () => {
      utils.listening.diagnoseLogs.summary.invalidate();
      utils.listening.diagnoseLogs.list.invalidate();
    },
  });
  const promoteMutation = trpc.listening.algoTerms.promote.useMutation({
    onSuccess: () => {
      utils.listening.diagnoseLogs.patterns.invalidate();
      utils.listening.diagnoseLogs.summary.invalidate();
      utils.listening.algoTerms.list.invalidate();
    },
  });

  /**
   * Open the entity editor prefilled from a diagnose result. Handles:
   *  - NO_QUERY_MATCH: seed canonical name + handle from the tweet, so the user
   *    only has to pick a topic and adjust.
   *  - BLOCKED_BY_NEGATIVE: open the owning entity of the blocker so the user
   *    can remove the offending negative term.
   */
  const openEntityEditorFromGap = (gap) => {
    if (gap.kind === 'extend-entity') {
      // Open the existing entity with the target field pre-appended. The editor
      // commits when the user clicks Save, and the onSuccess marks the log resolved.
      const target = (entitiesQ.data || []).find((e) => e.canonicalName === gap.entityName);
      if (!target) return;
      const rawToken = String(gap.addToken || '').replace(/^[@#$]/, '');
      const existingList = target[gap.addToField] || [];
      const alreadyPresent = existingList.some((x) =>
        String(x).toLowerCase().replace(/^[@#$]/, '') === rawToken.toLowerCase()
      );
      const nextList = alreadyPresent ? existingList : [...existingList, rawToken];
      setEditing({
        ...target,
        [gap.addToField]: nextList,
        origin: { logId: gap.logId, scrollTo: gap.addToField },
      });
      return;
    }

    if (gap.kind === 'fix-negative') {
      const target = (entitiesQ.data || []).find((e) => e.canonicalName === gap.entityName);
      if (target) {
        setEditing({ ...target, origin: { logId: gap.logId, scrollTo: 'negativeTerms' } });
      }
      return;
    }
    // fix-gap: prefill a new entity
    setEditing({
      __prefill: true,
      kind: gap.suggestedKind || 'BRAND',
      canonicalName: gap.suggestedName || '',
      xHandles: gap.suggestedHandles || [],
      aliases: [],
      tickers: [],
      hashtags: [],
      redditUsers: [],
      isAmbiguous: false,
      qualifiers: [],
      negativeTerms: [],
      enabled: true,
      origin: { logId: gap.logId },
    });
  };

  // Cross-page handoff: when Diagnose on /listening clicks a Fix action, it stashes
  // the gap payload in sessionStorage and routes here. Pick it up on mount and open
  // the editor. Small TTL so we don't stale-leak across sessions.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('pendingOntologyFix');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.gap && Date.now() - (parsed.at || 0) < 5 * 60 * 1000) {
        // Only open once we have the entities list — otherwise extend-entity can't resolve.
        if (parsed.gap.kind !== 'extend-entity' || entitiesQ.data) {
          openEntityEditorFromGap(parsed.gap);
          window.sessionStorage.removeItem('pendingOntologyFix');
        }
      } else {
        window.sessionStorage.removeItem('pendingOntologyFix');
      }
    } catch {
      window.sessionStorage.removeItem('pendingOntologyFix');
    }
    // `entitiesQ.data` is a dependency so a pending extend-entity fix waits for
    // the list to load, then fires automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitiesQ.data]);

  return (
    <div>
      <div>
        <OntologyGapsTile
          summary={gapSummaryQ.data}
          onReviewGaps={() => {
            if (typeof window !== 'undefined') window.location.href = '/listening?tab=diagnose';
          }}
        />

        <RecurringPatternsPanel
          onPromote={(token, logId) =>
            promoteMutation.mutate({ term: token.replace(/^[@#$]/, ''), kind: 'HIGH_CONFIDENCE', addedFromLogId: logId })
          }
          promoting={promoteMutation.isPending}
        />

          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Structured brand/product/person descriptions. The query planner generates listening queries from these — edit an entity to rewrite its queries.">
              Brand Entities
            </SectionTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => syncMutation.mutate(undefined)}
                disabled={syncMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-surface-secondary text-content-secondary hover:bg-surface-tertiary border border-border"
              >
                {syncMutation.isPending ? 'Syncing…' : 'Sync all topics'}
              </button>
              <button
                onClick={() => setEditing('new')}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                + New entity
              </button>
            </div>
          </div>

          {syncMutation.data && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300">
              Sync complete:{' '}
              {syncMutation.data.topics
                .map(
                  (t) =>
                    `${t.topic ?? t.topicName ?? t.topicId} — inserted ${t.inserted}, updated ${t.updated}, disabled ${t.disabled}`
                )
                .join(' · ')}
            </div>
          )}

          {entitiesQ.isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-surface-secondary rounded-lg" />
              ))}
            </div>
          ) : !(entitiesQ.data || []).length ? (
            <div className="bg-surface-card rounded-xl border border-border p-8 text-center text-content-muted">
              No brand entities yet. Add one to start generating listening queries algorithmically.
            </div>
          ) : (
            <div className="space-y-2">
              {(entitiesQ.data || []).map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEditing(e)}
                  className="w-full text-left bg-surface-card rounded-xl border border-border p-4 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${KIND_STYLES[e.kind]}`}>
                        {e.kind}
                      </span>
                      <span className="text-sm font-medium text-content-primary truncate">{e.canonicalName}</span>
                      {!e.enabled && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600">DISABLED</span>
                      )}
                      {e.isAmbiguous && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700" title="Queries for this entity require qualifier terms">
                          AMBIGUOUS
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-content-muted shrink-0">
                      {e.topic?.name && <span>{e.topic.name}</span>}
                      {e.xHandles?.length > 0 && <span>{e.xHandles.map((h) => `@${h}`).join(', ')}</span>}
                      {e.tickers?.length > 0 && <span>{e.tickers.join(', ')}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {editing && (
            <EntityEditor
              entity={editing === 'new' ? null : editing}
              onSave={(payload) => upsertMutation.mutate(payload)}
              onDelete={
                editing === 'new' || editing?.__prefill
                  ? null
                  : () => {
                      if (!window.confirm(`Delete "${editing.canonicalName}" and all its generated queries?`)) return;
                      deleteMutation.mutate({ id: editing.id });
                      setEditing(null);
                    }
              }
              onCancel={() => setEditing(null)}
              submitting={upsertMutation.isPending}
              error={upsertMutation.error?.message}
            />
          )}
      </div>
    </div>
  );
}

// ─── Ontology gaps tile ──────────────────────────────────────
// Summary card on the Brand Entities view showing how many diagnose calls this
// week hit NO_QUERY_MATCH / BLOCKED_BY_NEGATIVE and how many are still unresolved.
function OntologyGapsTile({ summary, onReviewGaps }) {
  if (!summary) return null;
  const total = Object.values(summary.counts || {}).reduce((a, b) => a + b, 0);
  if (total === 0) return null; // Nothing to show yet — avoid dead real estate.

  const noMatch = summary.counts?.NO_QUERY_MATCH || 0;
  const blocked = summary.counts?.BLOCKED_BY_NEGATIVE || 0;
  const captured =
    (summary.counts?.CAPTURED_AS_HIT || 0) +
    (summary.counts?.CAPTURED_AS_MENTION || 0) +
    (summary.counts?.WOULD_BE_CAPTURED || 0);
  const unresolved = summary.unresolvedGaps || 0;

  return (
    <div className="mb-5 bg-surface-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-content-primary">Ontology gaps — last 7 days</h3>
        {unresolved > 0 && (
          <button
            onClick={onReviewGaps}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Review {unresolved} unresolved →
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-content-muted mb-0.5">Diagnoses</div>
          <div className="text-lg font-bold text-content-primary">{total}</div>
        </div>
        <div>
          <div className="text-content-muted mb-0.5">Captured ✓</div>
          <div className="text-lg font-bold text-green-600">{captured}</div>
        </div>
        <div>
          <div className="text-content-muted mb-0.5">No match</div>
          <div className="text-lg font-bold text-amber-600">{noMatch}</div>
        </div>
        <div>
          <div className="text-content-muted mb-0.5">Blocked</div>
          <div className="text-lg font-bold text-red-600">{blocked}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Recurring Gap Patterns ──────────────────────────────────
// Rolls up unresolved NO_QUERY_MATCH logs over a 14-day window by recurring token.
// Each pattern offers three fixes in ascending coercion cost:
//   1. Promote to HIGH_CONFIDENCE (single DB row, no code change)
//   2. Copy planner-change suggestion (markdown for a GitHub issue / PR)
// Create-entity / extend-entity for any single log is available via the one-off
// diagnose flow above; this panel is for the batched-fix case.
function RecurringPatternsPanel({ onPromote, promoting }) {
  const patternsQ = trpc.listening.diagnoseLogs.patterns.useQuery(
    { windowDays: 14, minFrequency: 2 },
    { staleTime: 30_000 }
  );
  if (patternsQ.isLoading) return null;
  const patterns = patternsQ.data?.patterns || [];
  if (!patterns.length) return null;

  const copyPlannerSuggestion = async (p) => {
    const lines = [
      `## Listening planner: pattern "${p.token}" not covered by any template`,
      '',
      `This token appears in **${p.frequency} unresolved** diagnose logs over the last ${patternsQ.data?.windowDays || 14} days.`,
      '',
      'Sample posts:',
      ...p.samples.map((s) => `- ${s.content || '(no content)'}${s.author ? ` — @${s.author}` : ''}${s.url ? ` (${s.url})` : ''}`),
      '',
      '### Considered fixes',
      '- [ ] Promote `' + p.token + '` to `HIGH_CONFIDENCE_TERMS` (cheap, done via admin UI).',
      '- [ ] Extend an existing `BrandEntity` — add to aliases / xHandles / tickers / hashtags.',
      '- [ ] Create a new `BrandEntity` (only if genuinely new product/person/subsidiary).',
      '- [ ] Add a new planner template in `lib/listening/query-planner.js` if no existing template shape applies.',
      '',
      `_Source: admin → Listening Ontology → Recurring Gap Patterns. Log ids: ${p.sampleLogIds.join(', ')}_`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      window.alert('Markdown copied — paste into a GitHub issue or PR description.');
    } catch {
      window.prompt('Copy this manually:', lines.join('\n'));
    }
  };

  return (
    <div className="mb-5 bg-surface-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-content-primary">Recurring gap patterns (last {patternsQ.data?.windowDays || 14} days)</h3>
          <p className="text-xs text-content-muted">Tokens showing up in ≥2 unresolved diagnose logs. Fix once, close many gaps.</p>
        </div>
      </div>
      <div className="space-y-2">
        {patterns.slice(0, 8).map((p) => (
          <div key={p.token} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-surface-secondary/60 border border-border-secondary">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-content-primary">{p.token}</code>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700">
                  {p.frequency}× unresolved
                </span>
              </div>
              {p.samples[0]?.content && (
                <p className="text-xs text-content-muted mt-1 line-clamp-1">“{p.samples[0].content}”</p>
              )}
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
              <button
                onClick={() => onPromote(p.token, p.sampleLogIds[0])}
                disabled={promoting}
                title="Add this token to HIGH_CONFIDENCE_TERMS globally — applies to the next scan."
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                ⬆ Promote to HIGH_CONFIDENCE
              </button>
              <button
                onClick={() => copyPlannerSuggestion(p)}
                title="Copy a markdown snippet describing this pattern, for pasting into a GitHub issue or PR."
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-secondary text-content-secondary hover:bg-surface-tertiary border border-border"
              >
                ⧉ Copy planner-change suggestion
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityEditor({ entity, onSave, onDelete, onCancel, submitting, error }) {
  // `entity` can be: null (new blank), an existing row, or a prefill object from a
  // "Fix this gap" diagnose action. Prefill has no id so we treat it as a new entity.
  const isNew = !entity || !entity.id;
  const isPrefill = !!entity?.__prefill;
  const topicsQ = trpc.listening.topics.list.useQuery();
  const [form, setForm] = useState(() => ({
    id: entity?.id,
    topicId: entity?.topicId || '',
    kind: entity?.kind || 'BRAND',
    canonicalName: entity?.canonicalName || '',
    aliases: (entity?.aliases || []).join(', '),
    tickers: (entity?.tickers || []).join(', '),
    xHandles: (entity?.xHandles || []).join(', '),
    redditUsers: (entity?.redditUsers || []).join(', '),
    hashtags: (entity?.hashtags || []).join(', '),
    isAmbiguous: entity?.isAmbiguous || false,
    qualifiers: (entity?.qualifiers || []).join(', '),
    negativeTerms: (entity?.negativeTerms || []).join(', '),
    minFaves: entity?.minFaves ?? '',
    enabled: entity?.enabled !== false,
  }));

  // Live preview of the queries the planner will emit for this entity.
  const previewInput = useMemo(
    () => ({
      kind: form.kind,
      canonicalName: form.canonicalName || 'Preview Entity',
      aliases: parseList(form.aliases),
      tickers: parseList(form.tickers),
      xHandles: parseList(form.xHandles),
      redditUsers: parseList(form.redditUsers),
      hashtags: parseList(form.hashtags),
      isAmbiguous: form.isAmbiguous,
      qualifiers: parseList(form.qualifiers),
      negativeTerms: parseList(form.negativeTerms),
      minFaves: form.minFaves ? Number(form.minFaves) : null,
      enabled: form.enabled,
    }),
    [form]
  );
  const previewQ = trpc.listening.entities.preview.useQuery(previewInput, {
    enabled: Boolean(form.canonicalName),
    keepPreviousData: true,
    staleTime: 200,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.topicId) return;
    onSave({
      ...(form.id ? { id: form.id } : {}),
      topicId: form.topicId,
      kind: form.kind,
      canonicalName: form.canonicalName.trim(),
      aliases: parseList(form.aliases),
      tickers: parseList(form.tickers),
      xHandles: parseList(form.xHandles),
      redditUsers: parseList(form.redditUsers),
      hashtags: parseList(form.hashtags),
      isAmbiguous: form.isAmbiguous,
      qualifiers: parseList(form.qualifiers),
      negativeTerms: parseList(form.negativeTerms),
      minFaves: form.minFaves ? Number(form.minFaves) : null,
      enabled: form.enabled,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-surface-card rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {isPrefill
                  ? 'New brand entity (from diagnose gap)'
                  : isNew
                  ? 'New brand entity'
                  : `Edit: ${entity?.canonicalName}`}
              </h2>
              {isPrefill && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Pre-filled from a diagnose log. Pick a topic, adjust as needed, and save — the log will be marked resolved automatically.
                </p>
              )}
              {entity?.origin?.scrollTo === 'negativeTerms' && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Opened from a blocked diagnose — edit the <strong>Negative terms</strong> field below to remove the blocker.
                </p>
              )}
            </div>
            <button type="button" onClick={onCancel} className="text-content-muted hover:text-content-primary text-xl leading-none">×</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Topic *">
              <select
                value={form.topicId}
                onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border"
                required
              >
                <option value="">— select topic —</option>
                {(topicsQ.data || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Kind">
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border"
              >
                {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Canonical name *">
            <input
              type="text"
              value={form.canonicalName}
              onChange={(e) => setForm({ ...form, canonicalName: e.target.value })}
              className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Aliases (comma-separated)" hint="Alt spellings / variants of the name">
              <input type="text" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
            <Field label="Tickers" hint="$-prefixed optional; planner normalizes">
              <input type="text" value={form.tickers} onChange={(e) => setForm({ ...form, tickers: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
            <Field label="X handles" hint="Without @; planner adds it">
              <input type="text" value={form.xHandles} onChange={(e) => setForm({ ...form, xHandles: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
            <Field label="Reddit users">
              <input type="text" value={form.redditUsers} onChange={(e) => setForm({ ...form, redditUsers: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
            <Field label="Hashtags">
              <input type="text" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
            <Field label="min_faves" hint="Optional X engagement gate">
              <input type="number" min="0" value={form.minFaves} onChange={(e) => setForm({ ...form, minFaves: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-border-secondary">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAmbiguous}
                onChange={(e) => setForm({ ...form, isAmbiguous: e.target.checked })}
              />
              Ambiguous (requires qualifiers)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>

          {form.isAmbiguous && (
            <Field label="Qualifiers *" hint="At least one; planner AND-s these to every ambiguous query">
              <input type="text" value={form.qualifiers} onChange={(e) => setForm({ ...form, qualifiers: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
            </Field>
          )}

          <Field label="Negative terms" hint="Comma-separated; applied as `-term` on every query for this entity">
            <input type="text" value={form.negativeTerms} onChange={(e) => setForm({ ...form, negativeTerms: e.target.value })} className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-secondary border border-border" />
          </Field>

          <div className="border-t border-border-secondary pt-3">
            <h3 className="text-sm font-semibold mb-2">Planner preview <span className="text-xs text-content-muted font-normal">({(previewQ.data || []).length} queries)</span></h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {(previewQ.data || []).length === 0 ? (
                <p className="text-sm text-content-muted italic">Fill in canonical name + at least one handle/ticker/hashtag/alias to preview.</p>
              ) : (
                (previewQ.data || []).map((q, i) => (
                  <div key={i} className="text-xs font-mono bg-surface-secondary rounded p-2">
                    <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold uppercase">{q.template.replace(/_/g, ' ')}</span>
                    {q.queryString}
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex items-center justify-between pt-2 border-t border-border-secondary">
            <div>
              {onDelete && (
                <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:underline">Delete entity</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg bg-surface-secondary hover:bg-surface-tertiary">Cancel</button>
              <button type="submit" disabled={submitting || !form.canonicalName || !form.topicId} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Saving…' : (isNew ? 'Create + sync' : 'Save + sync')}
              </button>
            </div>
          </div>
        </form>
      </div>
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

