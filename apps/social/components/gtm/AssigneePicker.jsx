'use client';

import { useState, useRef, useEffect } from 'react';

function getInitial(member) {
  return (member?.name?.[0] || member?.email?.[0] || 'U').toUpperCase();
}

export default function AssigneePicker({ currentOwner, members, onSelect, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sizeClasses = size === 'sm'
    ? 'w-5 h-5 text-[8px]'
    : 'w-6 h-6 text-[10px]';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`${sizeClasses} rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${
          currentOwner
            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
            : 'border-2 border-dashed border-content-faint text-content-faint hover:border-blue-400 hover:text-blue-400'
        }`}
        title={currentOwner ? (currentOwner.name || currentOwner.email) : 'Assign'}
      >
        {currentOwner ? getInitial(currentOwner) : (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-surface-card border border-border rounded-lg shadow-lg overflow-hidden">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors ${
                currentOwner?.id === m.id ? 'bg-surface-secondary' : ''
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                {getInitial(m)}
              </div>
              <span className="text-sm text-content-primary truncate">{m.name || m.email}</span>
              {currentOwner?.id === m.id && (
                <svg className="w-3.5 h-3.5 text-blue-500 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
          {members.length === 0 && (
            <div className="px-3 py-2 text-xs text-content-muted">No team members</div>
          )}
        </div>
      )}
    </div>
  );
}
