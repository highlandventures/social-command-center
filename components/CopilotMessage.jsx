'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { detectDraftContent } from '@/lib/copilot/draft-detector';
import PredictionCard from '@/components/PredictionCard';

function extractDraftContent(text) {
  // Check for ---DRAFT--- markers
  const markerMatch = text.match(/---DRAFT---\s*([\s\S]*?)\s*---DRAFT---/);
  if (markerMatch) return markerMatch[1].trim();

  // Check for ```draft code blocks
  const codeBlockMatch = text.match(/```(?:draft|post|thread|tweet)\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Return full content as draft
  return text.trim();
}

export default function CopilotMessage({ message, onInsertDraft }) {
  const isUser = message.role === 'user';
  const isStreaming = message.role === 'assistant' && !message.content;
  const hasDraft = !isUser && message.content && detectDraftContent(message.content);
  const prediction = message.metadata?.prediction || message.data?.prediction || null;

  // User message
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-brand-primary/10 text-sm text-content-primary">
          {message.content}
        </div>
      </div>
    );
  }

  // Streaming indicator
  if (isStreaming) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-surface-card border border-border">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="px-3 py-2 rounded-lg bg-surface-card border border-border">
          <div className="prose prose-sm max-w-none text-content-primary text-[11px] leading-relaxed [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-0.5 [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:pl-4 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-[10px] [&_code]:bg-surface-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-surface-secondary [&_pre]:p-2 [&_pre]:rounded-md [&_pre]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-content-muted [&_p]:my-1 [&_table]:text-[10px] [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Prediction card */}
        {prediction && (
          <div className="mt-1.5">
            <PredictionCard prediction={prediction} />
          </div>
        )}

        {/* Insert into Composer button */}
        {hasDraft && onInsertDraft && (
          <button
            onClick={() => {
              const draftText = extractDraftContent(message.content);
              onInsertDraft(draftText);
            }}
            className="mt-1.5 text-xs bg-brand-primary text-white rounded-full px-3 py-1 hover:bg-brand-primary/90 transition-colors"
          >
            Insert into Composer
          </button>
        )}
      </div>
    </div>
  );
}
