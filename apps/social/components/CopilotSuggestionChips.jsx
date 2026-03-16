'use client';

import { Skeleton } from '@/components/ui';

export default function CopilotSuggestionChips({ chips, onChipClick, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="h-4 w-48 rounded bg-surface-secondary animate-pulse" />
        <div className="flex flex-wrap gap-2 justify-center">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-32 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!chips || chips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <p className="text-sm font-medium text-content-secondary">What would you like to create?</p>
        <p className="text-xs text-content-muted">Start typing or wait for suggestions to load.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <p className="text-sm font-medium text-content-secondary">What would you like to create?</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => onChipClick(chip.prompt)}
            className="bg-surface-secondary hover:bg-surface-card border border-border rounded-full px-3 py-1.5 text-xs text-content-primary cursor-pointer transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
