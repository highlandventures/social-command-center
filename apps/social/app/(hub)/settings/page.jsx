'use client';

import AdminPanel from '@/components/admin/AdminPanel';

export default function HubSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-content-primary mb-1">Settings</h2>
        <p className="text-content-muted">
          Manage account connections, team members, API configuration, and platform operations.
        </p>
      </div>
      <AdminPanel />
    </div>
  );
}
