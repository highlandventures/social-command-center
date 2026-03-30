'use client';

import NotionTasksSection from '@/components/hub/NotionTasksSection';

export default function LCReviewPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-1">L&amp;C Review</h2>
        <p className="text-content-muted">
          File tasks for legal &amp; compliance review and track status updates.
        </p>
      </div>
      <div className="max-w-2xl">
        <NotionTasksSection />
      </div>
    </div>
  );
}
