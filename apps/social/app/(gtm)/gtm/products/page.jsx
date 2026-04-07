'use client';

import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';

function InlineEdit({ value, onSave, multiline, placeholder, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Move cursor to end
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value || '').trim()) {
      onSave(trimmed || null);
    }
    setEditing(false);
  };

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input';
    return (
      <Tag
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-surface-page border border-blue-400 rounded-lg text-content-primary outline-none resize-none ${className}`}
        value={draft}
        rows={multiline ? 4 : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
          if (!multiline && e.key === 'Enter') save();
        }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value || ''); setEditing(true); }}
      className="group/edit w-full text-left"
    >
      <div className="flex items-start gap-2">
        <span className={`flex-1 ${value ? 'text-content-primary' : 'text-content-faint italic'} ${className}`}>
          {value ? (multiline ? value.split('\n').map((line, i) => (
            <span key={i}>{line}{i < value.split('\n').length - 1 && <br />}</span>
          )) : value) : (placeholder || 'Click to edit')}
        </span>
        <svg className="w-3.5 h-3.5 mt-0.5 opacity-0 group-hover/edit:opacity-100 transition-opacity text-content-faint shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </div>
    </button>
  );
}

function ProductCard({ product, onUpdate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-content-primary">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-content-muted mt-0.5 line-clamp-2">{product.description}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-content-faint transition-transform mt-1 shrink-0 ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
          <div>
            <label className="block text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Name</label>
            <InlineEdit
              value={product.name}
              onSave={(v) => v && onUpdate({ id: product.id, name: v })}
              className="text-sm font-semibold"
              placeholder="Product name"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Description</label>
            <InlineEdit
              value={product.description}
              onSave={(v) => onUpdate({ id: product.id, description: v || '' })}
              multiline
              className="text-sm"
              placeholder="Add a description"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Positioning Statement</label>
            <InlineEdit
              value={product.positioning}
              onSave={(v) => onUpdate({ id: product.id, positioning: v })}
              multiline
              className="text-sm"
              placeholder="Add positioning statement"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-content-faint uppercase tracking-wider mb-1">Messaging Guidelines</label>
            <InlineEdit
              value={product.messaging}
              onSave={(v) => onUpdate({ id: product.id, messaging: v })}
              multiline
              className="text-sm"
              placeholder="Add messaging guidelines"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateProductModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim() || undefined });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-content-primary">New Product</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-surface-page border border-border rounded-lg text-content-primary placeholder:text-content-faint outline-none focus:border-emerald-500"
                placeholder="e.g. Figure Pay"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm bg-surface-page border border-border rounded-lg text-content-primary placeholder:text-content-faint outline-none focus:border-emerald-500 resize-none"
                placeholder="Brief description of the product"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-content-muted hover:text-content-secondary transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40"
            >
              Create Product
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ProductsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.gtmProducts.list.useQuery();
  const createProduct = trpc.gtmProducts.create.useMutation({
    onSuccess: () => utils.gtmProducts.list.invalidate(),
  });
  const updateProduct = trpc.gtmProducts.update.useMutation({
    onSuccess: () => utils.gtmProducts.list.invalidate(),
  });

  const handleCreate = (data) => {
    createProduct.mutate(data);
  };

  const handleUpdate = (data) => {
    updateProduct.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Product Hub</h2>
          <p className="text-sm text-content-muted mt-0.5">Product positioning and messaging reference</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Product
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-skeleton rounded w-40 mb-3" />
              <div className="h-3 bg-skeleton rounded w-64" />
            </div>
          ))}
        </div>
      ) : (products || []).length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <svg className="w-10 h-10 text-content-faint mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          </svg>
          <p className="text-sm text-content-muted">No products yet</p>
          <p className="text-xs text-content-faint mt-1">Add your first product to build your messaging reference.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProductModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
