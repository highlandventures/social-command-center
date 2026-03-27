'use client';

import { useRef, useCallback, useEffect } from 'react';

export default function CopilotInput({ input: rawInput, handleInputChange, handleSubmit, isLoading }) {
  const input = rawInput ?? '';
  const textareaRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const maxHeight = 4 * 20; // ~4 rows at ~20px line height
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && input.trim()) {
          handleSubmit(e);
        }
      }
    },
    [isLoading, input, handleSubmit]
  );

  const hasContent = input.trim().length > 0;

  return (
    <div className="border-t border-border pt-2">
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask the co-pilot..."
          disabled={isLoading}
          rows={1}
          className={`flex-1 text-sm bg-surface-secondary rounded-lg px-3 py-2 resize-none border border-border focus:outline-none focus:ring-1 focus:ring-brand-primary/50 placeholder:text-content-muted ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ maxHeight: '80px' }}
        />
        <button
          type="submit"
          disabled={isLoading || !hasContent}
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            hasContent && !isLoading
              ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </form>
    </div>
  );
}
