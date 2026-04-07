'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';

function progressColor(pct) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function progressTextColor(pct) {
  if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatValue(val, unit) {
  if (unit === 'percent') return `${val}%`;
  if (unit === 'dollars') return `$${val.toLocaleString()}`;
  return val.toLocaleString();
}

function QuarterSelector({ quarter, onChange }) {
  const match = quarter.match(/^Q(\d)\s+(\d{4})$/);
  const q = match ? parseInt(match[1]) : 2;
  const year = match ? parseInt(match[2]) : 2026;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(q === 1 ? `Q4 ${year - 1}` : `Q${q - 1} ${year}`)}
        className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-content-muted"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div className="flex gap-1 bg-surface-secondary rounded-lg p-1">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => onChange(`Q${n} ${year}`)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              n === q
                ? 'bg-surface-card text-content-primary shadow-sm'
                : 'text-content-muted hover:text-content-secondary'
            }`}
          >
            Q{n}
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-content-secondary ml-1">{year}</span>
      <button
        onClick={() => onChange(q === 4 ? `Q1 ${year + 1}` : `Q${q + 1} ${year}`)}
        className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-content-muted"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

function InlineNumberEdit({ value, onSave, unit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = () => {
    const num = parseFloat(draft);
    if (!isNaN(num) && num >= 0) {
      onSave(num);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="any"
        min="0"
        className="w-20 px-1.5 py-0.5 text-xs bg-surface-page border border-blue-400 rounded text-content-primary outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="group/edit inline-flex items-center gap-1 text-xs text-content-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      {formatValue(value, unit)}
      <svg className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 transition-opacity text-content-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

function KeyResultRow({ kr, onUpdate }) {
  const pct = kr.target > 0 ? Math.round(Math.min((kr.current / kr.target) * 100, 100)) : 0;

  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-content-secondary truncate">{kr.title}</p>
      </div>
      <div className="w-32 shrink-0">
        <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-40 shrink-0 text-right text-xs text-content-muted flex items-center justify-end gap-1">
        <InlineNumberEdit value={kr.current} unit={kr.unit} onSave={(val) => onUpdate(kr.id, val)} />
        <span className="text-content-faint">/</span>
        <span>{formatValue(kr.target, kr.unit)}</span>
      </div>
    </div>
  );
}

function OkrCard({ okr, onUpdateKeyResult, onAddKeyResult }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddKR, setShowAddKR] = useState(false);
  const [krTitle, setKrTitle] = useState('');
  const [krTarget, setKrTarget] = useState('');
  const [krUnit, setKrUnit] = useState('count');

  const handleAddKR = () => {
    if (!krTitle.trim() || !krTarget) return;
    onAddKeyResult(okr.id, krTitle.trim(), parseFloat(krTarget), krUnit);
    setKrTitle('');
    setKrTarget('');
    setKrUnit('count');
    setShowAddKR(false);
  };

  return (
    <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-surface-hover transition-colors"
      >
        <svg
          className={`w-4 h-4 text-content-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-content-primary truncate">{okr.title}</p>
          {okr.description && (
            <p className="text-xs text-content-muted mt-0.5 truncate">{okr.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-24 h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${progressColor(okr.progress)}`} style={{ width: `${okr.progress}%` }} />
          </div>
          <span className={`text-sm font-bold min-w-[3ch] text-right ${progressTextColor(okr.progress)}`}>
            {okr.progress}%
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-border">
          <div className="pl-8 divide-y divide-border-secondary">
            {(okr.keyResults || []).map((kr) => (
              <KeyResultRow key={kr.id} kr={kr} onUpdate={onUpdateKeyResult} />
            ))}
          </div>

          {showAddKR ? (
            <div className="pl-8 mt-3 space-y-2">
              <input
                type="text"
                placeholder="Key result title"
                className="w-full px-3 py-1.5 text-sm bg-surface-page border border-border rounded-lg text-content-primary placeholder:text-content-faint outline-none focus:border-emerald-500"
                value={krTitle}
                onChange={(e) => setKrTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Target"
                  step="any"
                  min="0"
                  className="w-28 px-3 py-1.5 text-sm bg-surface-page border border-border rounded-lg text-content-primary placeholder:text-content-faint outline-none focus:border-emerald-500"
                  value={krTarget}
                  onChange={(e) => setKrTarget(e.target.value)}
                />
                <select
                  className="px-3 py-1.5 text-sm bg-surface-page border border-border rounded-lg text-content-primary outline-none focus:border-emerald-500"
                  value={krUnit}
                  onChange={(e) => setKrUnit(e.target.value)}
                >
                  <option value="count">Count</option>
                  <option value="percent">Percent</option>
                  <option value="dollars">Dollars</option>
                </select>
                <button
                  onClick={handleAddKR}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddKR(false)}
                  className="px-3 py-1.5 text-xs font-medium text-content-muted hover:text-content-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddKR(true)}
              className="ml-8 mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Key Result
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateOkrModal({ quarter, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim() || undefined, quarter });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-content-primary">New Objective</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Title</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-surface-page border border-border rounded-lg text-content-primary placeholder:text-content-faint outline-none focus:border-emerald-500"
                placeholder="e.g. Increase brand awareness"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm bg-surface-page border border-border rounded-lg text-content-primary placeholder:text-content-faint outline-none focus:border-emerald-500 resize-none"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <p className="text-xs text-content-faint">Quarter: {quarter}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-content-muted hover:text-content-secondary transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40"
            >
              Create Objective
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function OkrsPage() {
  const now = new Date();
  const defaultQ = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
  const [quarter, setQuarter] = useState(defaultQ);
  const [showCreate, setShowCreate] = useState(false);

  const utils = trpc.useUtils();
  const { data: okrs, isLoading } = trpc.gtmOkrs.list.useQuery({ quarter });
  const createOkr = trpc.gtmOkrs.create.useMutation({
    onSuccess: () => utils.gtmOkrs.list.invalidate(),
  });
  const createKR = trpc.gtmOkrs.createKeyResult.useMutation({
    onSuccess: () => utils.gtmOkrs.list.invalidate(),
  });
  const updateKR = trpc.gtmOkrs.updateKeyResult.useMutation({
    onSuccess: () => utils.gtmOkrs.list.invalidate(),
  });

  const handleUpdateKR = (id, current) => {
    updateKR.mutate({ id, current });
  };

  const handleAddKR = (okrId, title, target, unit) => {
    createKR.mutate({ okrId, title, target, unit });
  };

  const handleCreateOkr = (data) => {
    createOkr.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-content-primary">OKRs</h2>
          <p className="text-sm text-content-muted mt-0.5">Objectives and Key Results</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Objective
        </button>
      </div>

      <QuarterSelector quarter={quarter} onChange={setQuarter} />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-skeleton rounded w-64 mb-3" />
              <div className="h-2 bg-skeleton rounded w-32" />
            </div>
          ))}
        </div>
      ) : (okrs || []).length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <svg className="w-10 h-10 text-content-faint mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          <p className="text-sm text-content-muted">No objectives for {quarter}</p>
          <p className="text-xs text-content-faint mt-1">Create your first objective to start tracking key results.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {okrs.map((okr) => (
            <OkrCard
              key={okr.id}
              okr={okr}
              onUpdateKeyResult={handleUpdateKR}
              onAddKeyResult={handleAddKR}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateOkrModal
          quarter={quarter}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateOkr}
        />
      )}
    </div>
  );
}
