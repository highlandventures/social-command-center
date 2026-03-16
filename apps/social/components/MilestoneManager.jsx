'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { useToast } from '@/components/ui';

const EMPTY_FORM = { name: '', description: '', startDate: '', endDate: '' };

export default function MilestoneManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const toast = useToast();

  // tRPC queries and mutations
  const milestonesQ = trpc.milestones.list.useQuery(undefined, { staleTime: 15_000 });
  const utils = trpc.useUtils();

  const createMutation = trpc.milestones.create.useMutation({
    onSuccess: () => {
      utils.milestones.list.invalidate();
      toast.success('Milestone created');
      resetForm();
    },
    onError: (err) => toast.error(err.message || 'Failed to create milestone'),
  });

  const updateMutation = trpc.milestones.update.useMutation({
    onSuccess: () => {
      utils.milestones.list.invalidate();
      toast.success('Milestone updated');
      resetForm();
    },
    onError: (err) => toast.error(err.message || 'Failed to update milestone'),
  });

  const deleteMutation = trpc.milestones.delete.useMutation({
    onSuccess: () => {
      utils.milestones.list.invalidate();
      toast.success('Milestone deleted');
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(err.message || 'Failed to delete milestone'),
  });

  const milestones = milestonesQ.data ?? [];

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError('');
  }

  function startEdit(milestone) {
    setEditingId(milestone.id);
    setFormData({
      name: milestone.name,
      description: milestone.description || '',
      startDate: formatDateForInput(milestone.startDate),
      endDate: formatDateForInput(milestone.endDate),
    });
    setFormError('');
    setShowForm(true);
  }

  function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  }

  function handleSave() {
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setFormError('Start date and end date are required');
      return;
    }
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setFormError('End date must be after start date');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
    } else {
      createMutation.mutate({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
    }
  }

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      {/* Header with create button */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Create Milestone
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-surface-card rounded-xl border border-border p-5 mb-6">
          <h3 className="text-sm font-semibold text-content-primary mb-4">
            {editingId ? 'Edit Milestone' : 'New Milestone'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Q1 Product Launch"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description (max 500 chars)"
                maxLength={500}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-card focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs text-red-500 mb-3">{formError}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                !isSaving
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-surface-secondary text-content-faint cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Milestone' : 'Create Milestone'}
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

      {/* Milestone List */}
      {milestonesQ.isLoading ? (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-content-muted">Loading milestones...</p>
        </div>
      ) : milestones.length === 0 ? (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-content-muted mb-2">No milestones yet.</p>
          <p className="text-xs text-content-faint">
            Create one to benchmark reports against product launches, campaigns, or events.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-page">
                {['Name', 'Description', 'Start Date', 'End Date', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-4 text-xs font-medium text-content-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => (
                <tr
                  key={milestone.id}
                  className="border-b border-border-secondary hover:bg-surface-hover transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="font-medium text-content-primary">{milestone.name}</span>
                  </td>
                  <td className="py-3 px-4 text-content-muted text-xs max-w-[200px] truncate">
                    {milestone.description || '--'}
                  </td>
                  <td className="py-3 px-4 text-content-muted text-xs whitespace-nowrap">
                    {new Date(milestone.startDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-content-muted text-xs whitespace-nowrap">
                    {new Date(milestone.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(milestone)}
                        className="text-xs text-content-muted hover:text-content-secondary px-2 py-1 rounded hover:bg-surface-hover"
                      >
                        Edit
                      </button>
                      {deleteConfirmId === milestone.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate({ id: milestone.id })}
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
                          onClick={() => setDeleteConfirmId(milestone.id)}
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
