'use client';

import { useState, useRef, useEffect } from 'react';

function getInitial(person) {
  return (person?.name?.[0] || person?.email?.[0] || 'U').toUpperCase();
}

export default function AssigneePicker({ currentOwner, currentContact, members, contacts = [], onSelect, onSelectContact, onCreateContact, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const current = currentOwner || currentContact;
  const isContact = !!currentContact && !currentOwner;

  const sizeClasses = size === 'sm'
    ? 'w-5 h-5 text-[8px]'
    : 'w-6 h-6 text-[10px]';

  const query = search.toLowerCase();
  const filteredMembers = members.filter(m =>
    (m.name || '').toLowerCase().includes(query) || (m.email || '').toLowerCase().includes(query)
  );
  const filteredContacts = contacts.filter(c =>
    (c.name || '').toLowerCase().includes(query) || (c.email || '').toLowerCase().includes(query)
  );

  function handleCreateContact(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateContact?.({ name: newName.trim(), email: newEmail.trim() || undefined });
    setNewName('');
    setNewEmail('');
    setCreating(false);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`${sizeClasses} rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${
          current
            ? isContact
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
            : 'border-2 border-dashed border-content-faint text-content-faint hover:border-blue-400 hover:text-blue-400'
        }`}
        title={current ? (current.name || current.email) : 'Assign'}
      >
        {current ? getInitial(current) : (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-surface-card border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="px-2 pt-2 pb-1">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full text-xs bg-surface-secondary text-content-primary rounded px-2 py-1.5 border border-border outline-none placeholder:text-content-faint"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {/* Team members */}
            {filteredMembers.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[9px] font-medium uppercase tracking-wider text-content-faint">Team</span>
                </div>
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(m.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-hover transition-colors ${
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
              </>
            )}

            {/* External contacts */}
            {filteredContacts.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[9px] font-medium uppercase tracking-wider text-content-faint">External</span>
                </div>
                {filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectContact?.(c.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-hover transition-colors ${
                      currentContact?.id === c.id ? 'bg-surface-secondary' : ''
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                      {getInitial(c)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-content-primary truncate block">{c.name}</span>
                      {c.email && <span className="text-[10px] text-content-faint truncate block">{c.email}</span>}
                    </div>
                    {currentContact?.id === c.id && (
                      <svg className="w-3.5 h-3.5 text-blue-500 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}

            {filteredMembers.length === 0 && filteredContacts.length === 0 && !creating && (
              <div className="px-3 py-2 text-xs text-content-muted">No matches</div>
            )}
          </div>

          {/* Add new contact */}
          <div className="border-t border-border">
            {!creating ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCreating(true); setNewName(search); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors text-xs text-content-muted hover:text-blue-500"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add external contact
              </button>
            ) : (
              <form onSubmit={handleCreateContact} onClick={(e) => e.stopPropagation()} className="p-2 space-y-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="w-full text-xs bg-surface-secondary text-content-primary rounded px-2 py-1.5 border border-border outline-none"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full text-xs bg-surface-secondary text-content-primary rounded px-2 py-1.5 border border-border outline-none"
                />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setCreating(false)} className="text-[10px] text-content-muted hover:text-content-primary px-2 py-1">Cancel</button>
                  <button type="submit" disabled={!newName.trim()} className="text-[10px] font-medium bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-40">Add</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
