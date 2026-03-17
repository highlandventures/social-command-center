'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

const STEPS = [
  { num: 1, label: 'Select List' },
  { num: 2, label: 'Choose Template' },
  { num: 3, label: 'Edit Content' },
  { num: 4, label: 'Preview' },
  { num: 5, label: 'Schedule' },
];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, i) => (
        <div key={step.num} className="flex items-center flex-1">
          <div className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step.num < currentStep
                  ? 'bg-green-500 text-white'
                  : step.num === currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-secondary text-content-faint border border-border'
              }`}
            >
              {step.num < currentStep ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step.num
              )}
            </div>
            <span
              className={`text-xs font-medium hidden sm:block ${
                step.num === currentStep ? 'text-content-primary' : 'text-content-faint'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-0.5 flex-1 mx-2 rounded transition-colors ${
                step.num < currentStep ? 'bg-green-500' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CampaignBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';

  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState(isNew ? null : params.id);
  const [listId, setListId] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [scheduleOption, setScheduleOption] = useState('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [templateName, setTemplateName] = useState('');

  const utils = trpc.useUtils();

  // Load existing campaign
  const { data: existingCampaign, isLoading: campaignLoading } = trpc.emailCampaigns.getById.useQuery(
    { id: params.id },
    { enabled: !isNew }
  );

  // List and template queries
  const { data: lists, isLoading: listsLoading } = trpc.emailLists.list.useQuery();
  const { data: templates, isLoading: templatesLoading } = trpc.emailTemplates.list.useQuery();

  // Mutations
  const createMutation = trpc.emailCampaigns.create.useMutation();
  const updateMutation = trpc.emailCampaigns.update.useMutation();
  const scheduleMutation = trpc.emailCampaigns.schedule.useMutation();
  const suggestMutation = trpc.emailCampaigns.suggestContent.useMutation();

  // Populate from existing campaign
  useEffect(() => {
    if (existingCampaign) {
      setName(existingCampaign.name || '');
      setSubject(existingCampaign.subject || '');
      setFromName(existingCampaign.fromName || '');
      setFromEmail(existingCampaign.fromEmail || '');
      setReplyTo(existingCampaign.replyTo || '');
      setHtmlContent(existingCampaign.htmlContent || '');
      setListId(existingCampaign.listId || null);
      setTemplateId(existingCampaign.templateId || null);
      setCampaignId(existingCampaign.id);
    }
  }, [existingCampaign]);

  // Debounced preview for step 3
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewHtml(htmlContent);
    }, 500);
    return () => clearTimeout(timer);
  }, [htmlContent]);

  // Auto-save when changing steps (if campaign exists)
  const autoSave = useCallback(async () => {
    if (!campaignId) return;
    try {
      await updateMutation.mutateAsync({
        id: campaignId,
        name: name.trim() || undefined,
        subject: subject.trim() || undefined,
        fromName: fromName.trim() || undefined,
        fromEmail: fromEmail.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
        listId: listId || undefined,
        templateId: templateId || undefined,
        htmlContent: htmlContent || undefined,
      });
    } catch (e) {
      // Auto-save is best-effort
      console.error('Auto-save failed:', e);
    }
  }, [campaignId, name, subject, fromName, fromEmail, replyTo, listId, templateId, htmlContent]);

  const handleNext = async () => {
    // On step 3 forward, create campaign if not yet created
    if (step === 3 && !campaignId && name.trim() && subject.trim()) {
      try {
        const created = await createMutation.mutateAsync({
          name: name.trim(),
          subject: subject.trim(),
          fromName: fromName.trim() || undefined,
          fromEmail: fromEmail.trim() || undefined,
          replyTo: replyTo.trim() || undefined,
          listId,
          templateId: templateId || undefined,
          htmlContent: htmlContent || undefined,
        });
        setCampaignId(created.id);
      } catch (e) {
        console.error('Failed to create campaign:', e);
        return;
      }
    } else if (campaignId) {
      await autoSave();
    }
    setStep((s) => Math.min(s + 1, 5));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleTemplateSelect = (tpl) => {
    if (tpl) {
      setTemplateId(tpl.id);
      setTemplateName(tpl.name);
      if (tpl.htmlBody) setHtmlContent(tpl.htmlBody);
      if (tpl.subject) setSubject(tpl.subject);
    } else {
      setTemplateId(null);
      setTemplateName('');
    }
  };

  const handleSuggest = () => {
    suggestMutation.mutate({
      campaignName: name || undefined,
      templateName: templateName || undefined,
      htmlContent: htmlContent || undefined,
    });
  };

  const handleSchedule = async () => {
    // Ensure campaign exists
    let cId = campaignId;
    if (!cId) {
      try {
        const created = await createMutation.mutateAsync({
          name: name.trim(),
          subject: subject.trim(),
          fromName: fromName.trim() || undefined,
          fromEmail: fromEmail.trim() || undefined,
          replyTo: replyTo.trim() || undefined,
          listId,
          templateId: templateId || undefined,
          htmlContent: htmlContent || undefined,
        });
        cId = created.id;
        setCampaignId(cId);
      } catch (e) {
        console.error('Failed to create campaign:', e);
        return;
      }
    } else {
      await autoSave();
    }

    try {
      await scheduleMutation.mutateAsync({
        id: cId,
        scheduledFor: scheduleOption === 'later' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
      });
      utils.emailCampaigns.list.invalidate();
      setSuccessMsg(scheduleOption === 'now' ? 'Campaign is sending!' : 'Campaign scheduled successfully!');
      setTimeout(() => router.push('/email/campaigns'), 1500);
    } catch (e) {
      if (e.message?.includes('CONFLICT')) {
        setSuccessMsg('Campaign has already been scheduled.');
      } else {
        console.error('Schedule failed:', e);
      }
    }
  };

  const selectedList = lists?.find((l) => l.id === listId);

  // Can advance checks
  const canNext = () => {
    switch (step) {
      case 1: return !!listId;
      case 2: return true; // template is optional
      case 3: return name.trim() && subject.trim();
      case 4: return true;
      default: return false;
    }
  };

  if (!isNew && campaignLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-skeleton rounded animate-pulse" />
        <div className="h-10 w-full bg-skeleton rounded animate-pulse" />
        <div className="h-64 bg-skeleton rounded animate-pulse" />
      </div>
    );
  }

  // Generate iframe key for preview
  const iframeKey = `preview-${previewHtml.length}-${previewHtml.slice(0, 20)}`;

  return (
    <div>
      {/* Back link */}
      <Link
        href="/email/campaigns"
        className="inline-flex items-center gap-1.5 text-xs text-content-faint hover:text-content-secondary transition-colors mb-4"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Campaigns
      </Link>

      <h2 className="text-xl font-bold text-content-primary mb-4">
        {isNew ? 'New Campaign' : `Edit: ${name || 'Campaign'}`}
      </h2>

      <StepIndicator currentStep={step} />

      {/* Success banner */}
      {successMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4 text-sm font-medium text-green-700 dark:text-green-300">
          {successMsg}
        </div>
      )}

      {/* Step content */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm p-6 mb-4">

        {/* Step 1: Select List */}
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-1">Select an Email List</h3>
            <p className="text-sm text-content-muted mb-4">Choose which subscribers will receive this campaign.</p>
            {listsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-skeleton rounded-xl animate-pulse" />
                ))}
              </div>
            ) : lists?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-content-muted mb-3">No email lists found. Create a list first.</p>
                <Link href="/email/lists" className="text-sm text-blue-600 hover:underline">
                  Go to Lists
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setListId(list.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-colors ${
                      listId === list.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <p className="text-sm font-semibold text-content-primary">{list.name}</p>
                    {list.description && (
                      <p className="text-xs text-content-muted mt-0.5 truncate">{list.description}</p>
                    )}
                    <p className="text-xs text-content-faint mt-1">
                      {list._count.subscribers} subscriber{list._count.subscribers !== 1 ? 's' : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Choose Template */}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-1">Choose a Template</h3>
            <p className="text-sm text-content-muted mb-4">Select a starter template or start from scratch.</p>

            {/* Start from scratch option */}
            <button
              onClick={() => handleTemplateSelect(null)}
              className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors ${
                !templateId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
              }`}
            >
              <p className="text-sm font-semibold text-content-primary">Start from Scratch</p>
              <p className="text-xs text-content-muted mt-0.5">Write your own HTML email content</p>
            </button>

            {templatesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 bg-skeleton rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates?.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateSelect(tpl)}
                    className={`text-left p-4 rounded-xl border-2 transition-colors ${
                      templateId === tpl.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-content-primary">{tpl.name}</p>
                      {tpl.isStarter && (
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-medium">
                          Starter
                        </span>
                      )}
                    </div>
                    {tpl.subject && (
                      <p className="text-xs text-content-muted truncate">{tpl.subject}</p>
                    )}
                    <p className="text-xs text-content-faint mt-1 capitalize">
                      {(tpl.category || 'custom').replace(/_/g, ' ')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Edit Content */}
        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-4">Edit Campaign Content</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. March Newsletter"
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">
                  Subject Line <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSuggest}
                    disabled={suggestMutation.isPending}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    {suggestMutation.isPending ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        AI...
                      </span>
                    ) : (
                      'Suggest with AI'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            {suggestMutation.data && (
              <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">AI Subject Line Suggestions</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestMutation.data.subjectLines?.map((line, i) => (
                    <button
                      key={i}
                      onClick={() => setSubject(line)}
                      className="px-3 py-1.5 bg-white dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-full text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      {line}
                    </button>
                  ))}
                </div>
                {suggestMutation.data.bodySuggestion && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">Body Suggestion</p>
                    <div className="bg-white dark:bg-surface-card border border-purple-200 dark:border-purple-700 rounded-lg p-3 text-xs text-content-secondary mb-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {suggestMutation.data.bodySuggestion}
                    </div>
                    <button
                      onClick={() => setHtmlContent(suggestMutation.data.bodySuggestion)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Use This
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">From Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your Company"
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">From Email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="noreply@yourcompany.com"
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">Reply-To</label>
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="support@yourcompany.com"
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Split-pane editor */}
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Email Content</label>
              <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 500px)', minHeight: '300px' }}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-content-faint mb-1 uppercase tracking-wider">HTML</span>
                  <textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    spellCheck={false}
                    className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-lg font-mono text-sm text-content-primary placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="<html>&#10;  <body>&#10;    <h1>Your email here</h1>&#10;  </body>&#10;</html>"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-content-faint mb-1 uppercase tracking-wider">Preview</span>
                  <div className="flex-1 border border-border rounded-lg overflow-hidden bg-white">
                    {previewHtml ? (
                      <iframe
                        key={iframeKey}
                        srcDoc={previewHtml}
                        sandbox="allow-same-origin"
                        className="w-full h-full border-0"
                        title="Campaign preview"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-gray-400">
                        Preview will appear here
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-4">Preview Your Campaign</h3>

            {/* Summary card */}
            <div className="bg-surface-secondary rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-content-faint">Campaign Name</p>
                  <p className="font-medium text-content-primary">{name || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-content-faint">Subject</p>
                  <p className="font-medium text-content-primary">{subject || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-content-faint">From</p>
                  <p className="font-medium text-content-primary">
                    {fromName || 'Not set'} {fromEmail ? `<${fromEmail}>` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-content-faint">Reply-To</p>
                  <p className="font-medium text-content-primary">{replyTo || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-content-faint">Target List</p>
                  <p className="font-medium text-content-primary">
                    {selectedList?.name || '--'}
                    {selectedList && (
                      <span className="text-xs text-content-faint ml-1">
                        ({selectedList._count.subscribers} subscriber{selectedList._count.subscribers !== 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Full preview iframe */}
            <div className="flex justify-center">
              <div className="w-full max-w-[600px] border border-border rounded-xl overflow-hidden bg-white" style={{ minHeight: '400px' }}>
                {htmlContent ? (
                  <iframe
                    key={`full-preview-${htmlContent.length}`}
                    srcDoc={htmlContent}
                    sandbox="allow-same-origin"
                    className="w-full border-0"
                    style={{ height: '500px' }}
                    title="Full campaign preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-400 py-20">
                    No content to preview
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Schedule */}
        {step === 5 && (
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-1">Schedule Your Campaign</h3>
            <p className="text-sm text-content-muted mb-4">
              Choose when to send to {selectedList?._count?.subscribers || 0} subscriber{(selectedList?._count?.subscribers || 0) !== 1 ? 's' : ''}.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Send Now */}
              <button
                onClick={() => setScheduleOption('now')}
                className={`text-left p-5 rounded-xl border-2 transition-colors ${
                  scheduleOption === 'now'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <p className="text-base font-semibold text-content-primary mb-1">Send Now</p>
                <p className="text-xs text-content-muted">
                  Campaign will begin sending to {selectedList?._count?.subscribers || 0} subscriber{(selectedList?._count?.subscribers || 0) !== 1 ? 's' : ''} immediately.
                </p>
              </button>

              {/* Schedule for Later */}
              <button
                onClick={() => setScheduleOption('later')}
                className={`text-left p-5 rounded-xl border-2 transition-colors ${
                  scheduleOption === 'later'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <p className="text-base font-semibold text-content-primary mb-1">Schedule for Later</p>
                <p className="text-xs text-content-muted">Choose a specific date and time to send.</p>
              </button>
            </div>

            {/* Date/time picker for scheduled option */}
            {scheduleOption === 'later' && (
              <div className="mb-6">
                <label className="block text-xs font-medium text-content-muted mb-1">Send Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <button
              onClick={handleSchedule}
              disabled={scheduleMutation.isPending || createMutation.isPending || (scheduleOption === 'later' && !scheduledFor)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {scheduleMutation.isPending || createMutation.isPending
                ? 'Processing...'
                : scheduleOption === 'now'
                ? 'Send Now'
                : 'Schedule Campaign'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content-primary bg-surface-secondary border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canNext() || createMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Next'}
          </button>
        </div>
      )}
      {step === 5 && (
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content-primary bg-surface-secondary border border-border rounded-lg transition-colors"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
