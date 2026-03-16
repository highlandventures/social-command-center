'use client';

import Link from 'next/link';
import { SectionTitle } from '@/components/ui';
import MilestoneManager from '@/components/MilestoneManager';

export default function MilestonesPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/reports"
            className="text-sm text-content-muted hover:text-blue-600 transition-colors"
          >
            Reports
          </Link>
          <span className="text-content-faint">/</span>
          <h1 className="text-lg font-bold text-content-primary">Milestones</h1>
        </div>
        <SectionTitle subtitle="Track product launches, campaigns, and events to benchmark report performance">
          Milestones
        </SectionTitle>
      </div>

      <MilestoneManager />
    </div>
  );
}
