'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from 'ai/react';
import { trpc } from '@/lib/trpc-client';
import CopilotMessage from '@/components/CopilotMessage';
import CopilotInput from '@/components/CopilotInput';
import CopilotSuggestionChips from '@/components/CopilotSuggestionChips';

export default function CopilotPanel({ accountId, postMode, platform, onInsertDraft }) {
  const [threadId, setThreadId] = useState(null);
  const messagesEndRef = useRef(null);
  const prevAccountId = useRef(accountId);

  // ── tRPC queries ────────────────────────────────────────
  const recentThread = trpc.copilot.getRecentThread.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const dailyUsage = trpc.copilot.getDailyUsage.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  const suggestionChips = trpc.copilot.getSuggestionChips.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const createThreadMutation = trpc.copilot.createThread.useMutation();

  // ── useChat integration ─────────────────────────────────
  const {
    messages,
    setMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    append,
  } = useChat({
    api: '/api/copilot/chat',
    body: { accountId, postMode, platform, threadId },
    onError: () => {
      // Error state handled via `error` from useChat
    },
  });

  // ── Load recent thread on mount ─────────────────────────
  useEffect(() => {
    if (recentThread.data?.id && !threadId) {
      setThreadId(recentThread.data.id);
      if (recentThread.data.messages?.length > 0) {
        setMessages(
          recentThread.data.messages.map((m) => ({
            id: m.id || String(Math.random()),
            role: m.role,
            content: m.content,
          }))
        );
      }
    }
  }, [recentThread.data, threadId, setMessages]);

  // ── Auto-scroll to bottom on new messages ───────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Reset on accountId change ───────────────────────────
  useEffect(() => {
    if (prevAccountId.current !== accountId && accountId) {
      prevAccountId.current = accountId;
      setMessages([]);
      setThreadId(null);
    }
  }, [accountId, setMessages]);

  // ── New Thread handler ──────────────────────────────────
  const handleNewThread = useCallback(() => {
    setMessages([]);
    setThreadId(null);
    createThreadMutation.mutate(
      { accountId: accountId || undefined },
      {
        onSuccess: (data) => {
          if (data?.id) setThreadId(data.id);
        },
      }
    );
  }, [accountId, setMessages, createThreadMutation]);

  // ── Suggestion chip click ───────────────────────────────
  const handleChipClick = useCallback(
    (prompt) => {
      append({ role: 'user', content: prompt });
    },
    [append]
  );

  const usageData = dailyUsage.data;
  const showUsageWarning = usageData?.warning;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
            CP
          </div>
          <span className="text-[10px] font-semibold text-content-secondary">Co-Pilot</span>
        </div>
        <button
          onClick={handleNewThread}
          className="text-[10px] px-2 py-0.5 rounded-md bg-surface-secondary hover:bg-surface-card border border-border text-content-muted hover:text-content-primary transition-colors"
        >
          New Thread
        </button>
      </div>

      {/* Usage warning */}
      {showUsageWarning && (
        <div className="mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex-shrink-0">
          <p className="text-[10px] text-amber-700">
            You've been productive today! {usageData.count}/{usageData.limit} messages
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mb-2" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 ? (
          <CopilotSuggestionChips
            chips={suggestionChips.data || []}
            onChipClick={handleChipClick}
            isLoading={suggestionChips.isLoading}
          />
        ) : (
          <>
            {messages.map((message) => (
              <CopilotMessage
                key={message.id}
                message={message}
                onInsertDraft={onInsertDraft}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-red-600">Something went wrong. Please try again.</p>
            <button
              onClick={() => reload()}
              className="text-[10px] px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0">
        <CopilotInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
