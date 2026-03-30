'use client';

import NotionTasksSection from '@/components/hub/NotionTasksSection';

export default function NotionTasksPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-1">Marketing Tasks</h2>
        <p className="text-content-muted">
          File new tasks and track updates from the Notion Marketing Tasks database.
        </p>
      </div>
      <div className="max-w-2xl">
        <NotionTasksSection />
      </div>
    </div>
  );
}
