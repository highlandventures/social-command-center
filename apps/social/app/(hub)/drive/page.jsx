'use client';

import DriveSection from '@/components/hub/DriveSection';

export default function DrivePage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-1">
          Google Drive
        </h2>
        <p className="text-content-muted">
          Browse, search, and edit your Drive files without leaving the hub.
        </p>
      </div>

      <div className="max-w-2xl">
        <DriveSection />
      </div>
    </div>
  );
}
