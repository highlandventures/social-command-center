'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';

const STORAGE_KEY = 'defaultReportRecipients';

/**
 * Modal for sending a report via email.
 * Pre-fills recipients from localStorage defaults, saves on successful send.
 */
export default function EmailReportModal({ isOpen, onClose, reportId, reportTitle }) {
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState(`Report: ${reportTitle || ''}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saveDefaults, setSaveDefaults] = useState(true);

  // Pre-fill recipients from localStorage
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const emails = JSON.parse(saved);
          if (Array.isArray(emails) && emails.length > 0) {
            setRecipients(emails.join(', '));
          }
        }
      } catch {
        // Ignore localStorage errors
      }
      // Reset state on open
      setSubject(`Report: ${reportTitle || ''}`);
      setSending(false);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, reportTitle]);

  const emailMutation = trpc.reports.emailReport.useMutation();

  async function handleSend() {
    setError(null);

    // Parse recipients
    const parsed = recipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    // Basic validation
    if (parsed.length === 0) {
      setError('Please enter at least one email address.');
      return;
    }

    const invalid = parsed.filter((e) => !e.includes('@'));
    if (invalid.length > 0) {
      setError(`Invalid email: ${invalid.join(', ')}`);
      return;
    }

    setSending(true);
    try {
      const result = await emailMutation.mutateAsync({
        reportId,
        recipients: parsed,
      });

      if (result.success) {
        // Save recipients as defaults
        if (saveDefaults) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          } catch {
            // Ignore
          }
        }
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError('Email delivery failed. Check SMTP configuration and try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-surface-card rounded-xl shadow-xl max-w-md w-full p-6">
        {success ? (
          <div className="text-center py-8">
            <div className="text-green-500 text-4xl mb-3">&#10003;</div>
            <p className="text-lg font-semibold text-gray-900 dark:text-content-primary">Email sent!</p>
            <p className="text-sm text-gray-500 dark:text-content-muted mt-1">The report has been delivered to your recipients.</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900 dark:text-content-primary mb-4">Email Report</h2>

            {/* Recipients */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-content-secondary mb-1">
                Recipients
              </label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email@example.com, email2@example.com"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5B56F5] dark:bg-surface-base dark:text-content-primary"
              />
            </div>

            {/* Subject */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-content-secondary mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5B56F5] dark:bg-surface-base dark:text-content-primary"
              />
            </div>

            {/* Save as defaults checkbox */}
            <div className="mb-4 flex items-center gap-2">
              <input
                id="save-defaults"
                type="checkbox"
                checked={saveDefaults}
                onChange={(e) => setSaveDefaults(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="save-defaults" className="text-xs text-gray-500 dark:text-content-muted">
                Save recipients as defaults
              </label>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-[#5B56F5] text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-[#4a47d4] disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              disabled={sending}
              className="w-full mt-2 text-sm text-gray-500 dark:text-content-muted hover:text-gray-700 dark:hover:text-content-secondary py-1"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
