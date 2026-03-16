'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import { SectionTitle } from '@/components/ui';

const CADENCE_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const REPORT_TYPE_OPTIONS = [
  { value: 'WEEKLY_PERFORMANCE', label: 'Weekly Performance' },
  { value: 'MONTHLY_SUMMARY', label: 'Monthly Summary' },
  { value: 'COMPETITIVE_ANALYSIS', label: 'Competitive Analysis' },
  { value: 'KOL_REPORT', label: 'KOL Report' },
  { value: 'CUSTOM', label: 'Custom' },
];

const CADENCE_BADGES = {
  WEEKLY: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600',
  MONTHLY: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600',
  QUARTERLY: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600',
  YEARLY: 'bg-green-50 dark:bg-green-900/30 text-green-600',
};

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SchedulesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    cadence: 'WEEKLY',
    reportType: 'WEEKLY_PERFORMANCE',
    recipients: '',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // tRPC queries and mutations
  const schedulesQ = trpc.schedules.list.useQuery(undefined, { staleTime: 15_000 });
  const utils = trpc.useUtils();

  const createMutation = trpc.schedules.create.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate();
      resetForm();
    },
  });

  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate();
      resetForm();
    },
  });

  const toggleMutation = trpc.schedules.toggle.useMutation({
    onMutate: async ({ id }) => {
      await utils.schedules.list.cancel();
      const prev = utils.schedules.list.getData();
      utils.schedules.list.setData(undefined, (old) =>
        old?.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.schedules.list.setData(undefined, context.prev);
    },
    onSettled: () => utils.schedules.list.invalidate(),
  });

  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate();
      setDeleteConfirmId(null);
    },
  });

  const schedules = schedulesQ.data ?? [];

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', cadence: 'WEEKLY', reportType: 'WEEKLY_PERFORMANCE', recipients: '' });
  }

  function startEdit(schedule) {
    setEditingId(schedule.id);
    setFormData({
      name: schedule.name,
      cadence: schedule.cadence,
      reportType: schedule.reportType,
      recipients: Array.isArray(schedule.recipients) ? schedule.recipients.join(', ') : '',
    });
    setShowForm(true);
  }

  function handleSave() {
    const recipientsList = formData.recipients
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formData.name,
        cadence: formData.cadence,
        reportType: formData.reportType,
        recipients: recipientsList,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        cadence: formData.cadence,
        reportType: formData.reportType,
        recipients: recipientsList,
      });
    }
  }

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/reports"
              className="text-sm text-content-muted hover:text-blue-600 transition-colors"
            >
              Reports
            </Link>
            <span className="text-content-faint">/</span>
            <h1 className="text-lg font-bold text-content-primary">Report Schedules</h1>
          </div>
          <p className="text-sm text-content-muted">
            Manage automated report generation and delivery
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Create Schedule
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
          <h3 className="text-sm font-semibold text-content-primary mb-4">
            {editingId ? 'Edit Schedule' : 'New Schedule'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Weekly Team Report"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Cadence</label>
              <select
                value={formData.cadence}
                onChange={(e) => setFormData((f) => ({ ...f, cadence: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CADENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                Report Type
              </label>
              <select
                value={formData.reportType}
                onChange={(e) => setFormData((f) => ({ ...f, reportType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REPORT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                Recipients (comma-separated emails)
              </label>
              <input
                type="text"
                value={formData.recipients}
                onChange={(e) => setFormData((f) => ({ ...f, recipients: e.target.value }))}
                placeholder="team@company.com, lead@company.com"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!formData.name.trim() || isSaving}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                formData.name.trim() && !isSaving
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-surface-secondary text-content-faint cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Schedule' : 'Create Schedule'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-content-muted hover:text-content-secondary rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule List */}
      {schedulesQ.isLoading ? (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-content-muted">Loading schedules...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-content-muted mb-2">No schedules yet.</p>
          <p className="text-xs text-content-faint">
            Create one to automate your reports.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-page">
                {['Name', 'Cadence', 'Enabled', 'Next Run', 'Last Run', 'Latest Report', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-xs font-medium text-content-muted uppercase"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr
                  key={schedule.id}
                  className="border-b border-border-secondary hover:bg-surface-hover transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-content-primary">{schedule.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        CADENCE_BADGES[schedule.cadence] || 'bg-surface-secondary text-content-secondary'
                      }`}
                    >
                      {schedule.cadence}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleMutation.mutate({ id: schedule.id })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        schedule.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          schedule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="py-3 px-4 text-xs text-content-muted">
                    {formatDate(schedule.nextRunAt)}
                  </td>
                  <td className="py-3 px-4 text-xs text-content-muted">
                    {formatDate(schedule.lastRunAt)}
                  </td>
                  <td className="py-3 px-4">
                    {schedule.lastReportId ? (
                      <Link
                        href={`/reports/${schedule.lastReportId}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Report
                      </Link>
                    ) : (
                      <span className="text-xs text-content-faint">--</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(schedule)}
                        className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover"
                      >
                        Edit
                      </button>
                      {deleteConfirmId === schedule.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate({ id: schedule.id })}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-content-muted px-2 py-1 rounded hover:bg-surface-hover"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(schedule.id)}
                          className="text-xs text-content-muted hover:text-red-600 px-2 py-1 rounded hover:bg-surface-hover"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
