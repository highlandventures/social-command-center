'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge, Skeleton } from '@/components/ui';

export default function ComposerPage() {
  const [selectedPlatform, setSelectedPlatform] = useState('x');
  const [postMode, setPostMode] = useState('thread');
  const [selectedAccount, setSelectedAccount] = useState('@highland_vc');
  const [articleTitle, setArticleTitle] = useState(
    'Why Pattern Matching is Broken: 7 Signals We Look For Instead'
  );
  const [articleBody, setArticleBody] = useState(
    "Most VCs evaluate founders on pattern matching. Here's why that's broken — and what we've learned works better after 200+ deals.\n\n## Signal 1: Founder-Market Obsession\n\nWe don't ask \"do you know this space?\" We ask \"what's the thing about this problem that keeps you up at night that nobody else sees?\"\n\nThe best founders have an almost irrational depth of insight into their specific wedge. They've lived this problem. They can tell you the 12 things that everyone gets wrong about the market — off the top of their head, with receipts.\n\n## Signal 2: Speed of Learning\n\nWe track how quickly a founder iterates on feedback between our conversations. If they've meaningfully evolved their pitch/product between meeting 1 and meeting 2 (usually 1-2 weeks), that's a stronger signal than 10 years in industry.\n\nThis matters because the startup journey is fundamentally a learning speed competition. The market is going to throw curveballs. The founders who adapt fastest win.\n\n## Signal 3: Customer Conversations > TAM Slides\n\nShow us 5 real customer conversations with quotes. That's worth more than any McKinsey market sizing.\n\nThe founders who close us fastest always lead with customer evidence, not market size. They know their customers by name."
  );
  const [tweets, setTweets] = useState([
    "Most VCs evaluate founders on pattern matching. Here's why that's broken — and 7 signals we look for instead.\n\nA thread \uD83E\uDDF5",
    "Signal 1: Founder-market obsession, not just fit.\n\nWe don't ask \"do you know this space?\" We ask \"what's the thing about this problem that keeps you up at night that nobody else sees?\"\n\nThe best founders have an almost irrational depth of insight into their specific wedge.",
    "Signal 2: Speed of learning, not years of experience.\n\nWe track how quickly a founder iterates on feedback between our conversations. If they've meaningfully evolved their pitch/product between meeting 1 and meeting 2 (usually 1-2 weeks), that's a stronger signal than 10 years in industry.",
    "Signal 3: Customer conversations > TAM slides.\n\nShow us 5 real customer conversations with quotes. That's worth more than any McKinsey market sizing.\n\nThe founders who close us fastest always lead with customer evidence, not market size.",
    "Signal 4: Hiring taste.\n\nWho are the first 3-5 people they'd hire? How specific can they get? Do they know these people by name?\n\nGreat founders have been mentally building their team for months before they even start fundraising.",
  ]);
  const [scheduleDate, setScheduleDate] = useState('2026-03-05');
  const [scheduleTime, setScheduleTime] = useState('09:15');
  const [sidebarTab, setSidebarTab] = useState('drafts');

  // ── tRPC queries ──────────────────────────────────────────
  const accountsQ = trpc.accounts.list.useQuery(undefined, { staleTime: 60_000 });
  const draftsQ = trpc.posts.list.useQuery({ status: 'DRAFT' }, { staleTime: 15_000 });
  const queueQ = trpc.posts.list.useQuery({ status: 'SCHEDULED' }, { staleTime: 15_000 });

  const utils = trpc.useUtils();

  const createMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
    },
  });

  const publishMutation = trpc.posts.publish.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
    },
  });

  // ── Derived ───────────────────────────────────────────────
  const accounts = accountsQ.data ?? [];
  const drafts = draftsQ.data?.items ?? [];
  const scheduledPosts = queueQ.data?.items ?? [];

  const activeTweets = tweets.filter((t) => (t || '').trim());
  const isThread = postMode === 'thread';

  const handleSaveDraft = () => {
    createMutation.mutate({
      content: isThread ? tweets.join('\n---\n') : tweets[0],
      platform: selectedPlatform,
      account: selectedAccount,
      type: postMode,
      status: 'DRAFT',
    });
  };

  const handleSchedule = () => {
    createMutation.mutate({
      content: isThread ? tweets.join('\n---\n') : tweets[0],
      platform: selectedPlatform,
      account: selectedAccount,
      type: postMode,
      status: 'SCHEDULED',
      scheduledFor: `${scheduleDate}T${scheduleTime}`,
    });
  };

  const handlePublishNow = () => {
    publishMutation.mutate({
      content: isThread ? tweets.join('\n---\n') : tweets[0],
      platform: selectedPlatform,
      account: selectedAccount,
      type: postMode,
    });
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)', minHeight: '600px' }}>
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mr-auto flex-wrap">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {[
              { key: 'x', label: '\u{1D54F}' },
              { key: 'reddit', label: 'Reddit' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setSelectedPlatform(p.key);
                  if (p.key === 'reddit') setPostMode('single');
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  selectedPlatform === p.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            {accounts
              .filter((a) => a.platform === selectedPlatform)
              .map((a) => (
                <option key={a.id} value={a.handle}>
                  {a.handle}
                </option>
              ))}
          </select>
          {selectedPlatform === 'x' && (
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {[
                { key: 'single', label: 'Post' },
                { key: 'thread', label: `Thread (${activeTweets.length})` },
                { key: 'article', label: 'Article' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPostMode(m.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    postMode === m.key
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m.key === 'thread' ? '\uD83E\uDDF5 ' : m.key === 'article' ? '\uD83D\uDCDD ' : ''}
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {postMode === 'article' && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
              Premium+ required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveDraft}
            disabled={createMutation.isLoading}
            className="px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {createMutation.isLoading ? 'Saving...' : 'Save Draft'}
          </button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2.5 py-1.5">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="text-xs bg-transparent border-none outline-none w-[110px]"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="text-xs bg-transparent border-none outline-none w-[65px]"
            />
          </div>
          <button
            onClick={handleSchedule}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium"
          >
            Schedule
          </button>
          <button
            onClick={handlePublishNow}
            disabled={publishMutation.isLoading}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 font-medium"
          >
            {publishMutation.isLoading ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </div>

      {/* Main content: editor | preview | sidebar */}
      <div
        className="flex-1 min-h-0 grid gap-4"
        style={{ gridTemplateColumns: 'minmax(300px, 1fr) minmax(320px, 1fr) minmax(200px, 260px)' }}
      >
        {/* COLUMN 1: Editor */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Compose</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {/* Thread editor */}
            {postMode === 'thread' && selectedPlatform === 'x' && (
              <div className="space-y-2.5">
                {tweets.map((tweet, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-medium">
                          {i + 1}/{tweets.length}
                        </span>
                        {i === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                            Hook
                          </span>
                        )}
                        {i === tweets.length - 1 && tweets.length > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">
                            CTA
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium tabular-nums ${
                          tweet.length > 280
                            ? 'text-red-500'
                            : tweet.length > 252
                            ? 'text-amber-500'
                            : 'text-gray-300'
                        }`}
                      >
                        {tweet.length}/280
                      </span>
                    </div>
                    <textarea
                      value={tweet}
                      onChange={(e) => {
                        const t = [...tweets];
                        t[i] = e.target.value;
                        setTweets(t);
                      }}
                      className="w-full text-[13px] text-gray-800 border-none outline-none resize-none leading-relaxed"
                      style={{ minHeight: Math.max(60, Math.min(140, tweet.length / 2)) + 'px' }}
                      placeholder={
                        i === 0
                          ? 'Hook — grab attention...'
                          : i === tweets.length - 1
                          ? 'CTA — what should they do?'
                          : 'Continue the thread...'
                      }
                    />
                    {tweet.length > 280 && (
                      <div className="mt-1 text-[10px] text-red-500 bg-red-50 rounded px-2 py-0.5 inline-block">
                        +{tweet.length - 280} over limit
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
                      <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
                        {'\uD83D\uDCF7'}
                      </button>
                      <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
                        {'\uD83D\uDD17'}
                      </button>
                      <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
                        {'\u2728'} AI
                      </button>
                      <div className="flex-1" />
                      {tweets.length > 1 && (
                        <button
                          onClick={() => setTweets(tweets.filter((_, j) => j !== i))}
                          className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setTweets([...tweets, ''])}
                  className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                >
                  + Add tweet
                </button>
              </div>
            )}

            {/* Article editor */}
            {postMode === 'article' && selectedPlatform === 'x' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-full">
                <input
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  className="w-full text-lg font-bold text-gray-900 border-none outline-none mb-1 placeholder-gray-300"
                  placeholder="Article title..."
                />
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <span className="text-[10px] text-gray-400">
                    {articleBody.length.toLocaleString()}/25,000
                  </span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-[10px] text-gray-400">
                    ~{Math.ceil(articleBody.split(/\s+/).length / 200)} min read
                  </span>
                  <div className="flex-1" />
                  <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
                    {'\uD83D\uDCF7'} Cover image
                  </button>
                  <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
                    B I H1 H2
                  </button>
                </div>
                <textarea
                  value={articleBody}
                  onChange={(e) => setArticleBody(e.target.value)}
                  className="w-full flex-1 text-[13px] text-gray-800 border-none outline-none resize-none leading-relaxed min-h-[300px]"
                  placeholder="Write your article... Markdown supported (## headings, **bold**, *italic*, lists)"
                />
              </div>
            )}

            {/* Single post (X or Reddit) */}
            {(postMode === 'single' || selectedPlatform === 'reddit') && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 font-medium">
                    {selectedPlatform === 'reddit' ? 'Post body (Markdown)' : 'Post'}
                  </span>
                  {selectedPlatform === 'x' && (
                    <span className="text-[10px] text-gray-400">{tweets[0]?.length || 0}/280</span>
                  )}
                </div>
                {selectedPlatform === 'reddit' && (
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                      <option>r/venturecapital</option>
                      <option>r/startups</option>
                      <option>r/artificial</option>
                    </select>
                    <input
                      placeholder="Post title..."
                      className="flex-1 min-w-[100px] text-xs border border-gray-200 rounded-lg px-2 py-1"
                    />
                    <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                      <option>Text</option>
                      <option>Link</option>
                      <option>Image</option>
                      <option>Poll</option>
                    </select>
                  </div>
                )}
                <textarea
                  value={tweets[0]}
                  onChange={(e) => setTweets([e.target.value])}
                  className="w-full flex-1 text-[13px] text-gray-800 border-none outline-none resize-none leading-relaxed min-h-[200px]"
                  placeholder={selectedPlatform === 'reddit' ? 'Write your post (Markdown)...' : "What's happening?"}
                />
              </div>
            )}

            {/* AI + Performance row */}
            <div className="mt-3 space-y-2">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 mt-0.5">
                    AI
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-blue-900 mb-0.5">Content Suggestion</p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      {postMode === 'article'
                        ? `Articles with 800-1,500 words get the most engagement. You're at ~${articleBody.split(/\s+/).length} words. Add a compelling hook in the first paragraph — articles that open with a bold claim get 3x more reads. Consider adding subheadings every 200-300 words.`
                        : `Your educational threads average 7.4% engagement — 2.3x higher than single posts. This thread has ${activeTweets.length} tweets (optimal: 5-7). Threads with CTAs get 40% more replies.`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-2.5">
                <p className="text-[11px] text-green-800">
                  <strong>Best slot:</strong> Tue 9:15am (8.2% eng). You're set for Wed (5.1%).{' '}
                  <button className="text-green-700 underline font-medium">Switch?</button>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Live Preview */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Preview</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {selectedPlatform === 'x' && postMode === 'article' ? (
              /* X Article preview */
              <div
                className="rounded-2xl border border-gray-200 overflow-hidden"
                style={{
                  background: '#000',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="text-white text-[10px] font-medium">Article</span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    ~{Math.ceil(articleBody.split(/\s+/).length / 200)} min read
                  </span>
                </div>
                <div className="h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border-b border-gray-800">
                  <span className="text-gray-600 text-xs">Cover image (optional)</span>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">HV</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-bold text-white">Highland Ventures</span>
                        <svg viewBox="0 0 22 22" className="w-[14px] h-[14px]" style={{ fill: '#1d9bf0' }}>
                          <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.223 1.261.272 1.894.14.633-.132 1.217-.438 1.684-.883.447-.468.752-1.054.883-1.69.132-.634.085-1.294-.138-1.9.586-.272 1.084-.703 1.438-1.241.355-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                        </svg>
                      </div>
                      <span className="text-[11px] text-gray-500">{selectedAccount} &middot; now</span>
                    </div>
                  </div>
                  <h1 className="text-xl font-bold text-white leading-tight mb-4">
                    {articleTitle || 'Untitled Article'}
                  </h1>
                  <div className="text-[13px] text-gray-300 leading-[1.7] whitespace-pre-wrap break-words">
                    {articleBody.split('\n').map((line, li) => {
                      if (line.startsWith('## '))
                        return (
                          <h2 key={li} className="text-base font-bold text-white mt-4 mb-2">
                            {line.slice(3)}
                          </h2>
                        );
                      if (line.startsWith('# '))
                        return (
                          <h1 key={li} className="text-lg font-bold text-white mt-4 mb-2">
                            {line.slice(2)}
                          </h1>
                        );
                      if (line.trim() === '') return <br key={li} />;
                      return (
                        <p key={li} className="mb-2">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-gray-500">
                  {['\uD83D\uDCAC', '\uD83D\uDD01', '\u2764\uFE0F', '\uD83D\uDCCA', '\u2197'].map((e, j) => (
                    <span key={j} className="text-sm cursor-pointer hover:text-gray-300">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ) : selectedPlatform === 'x' ? (
              /* X Post / Thread preview */
              <div
                className="rounded-2xl border border-gray-200 overflow-hidden"
                style={{
                  background: '#000',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="text-white text-[10px] font-medium">{isThread ? 'Thread' : 'Post'}</span>
                  </div>
                  {isThread && <span className="text-[10px] text-gray-500">{activeTweets.length} posts</span>}
                </div>
                <div>
                  {(isThread ? tweets : [tweets[0] || ''])
                    .filter((t) => t !== undefined)
                    .map((tweet, i, arr) => {
                      const isLast = i === arr.filter((t) => (t || '').trim()).length - 1;
                      const tweetText = tweet || '';
                      return (
                        <div
                          key={i}
                          className={`px-3 pt-2.5 ${isLast ? 'pb-1' : 'pb-0'} ${i > 0 ? 'border-t border-gray-800/50' : ''}`}
                        >
                          <div className="flex gap-2.5">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">HV</span>
                              </div>
                              {isThread && !isLast && tweetText.trim() && (
                                <div className="w-0.5 flex-1 bg-gray-700 mt-1 min-h-[6px]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pb-2.5">
                              <div className="flex items-center gap-1 leading-tight flex-wrap">
                                <span className="text-[13px] font-bold text-white">Highland Ventures</span>
                                <svg viewBox="0 0 22 22" className="w-[14px] h-[14px] flex-shrink-0" style={{ fill: '#1d9bf0' }}>
                                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.223 1.261.272 1.894.14.633-.132 1.217-.438 1.684-.883.447-.468.752-1.054.883-1.69.132-.634.085-1.294-.138-1.9.586-.272 1.084-.703 1.438-1.241.355-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                                </svg>
                                <span className="text-[13px] text-gray-500">{selectedAccount} &middot; now</span>
                              </div>
                              <div className="mt-0.5">
                                {tweetText.trim() ? (
                                  <p className="text-[13px] text-white leading-[1.4] whitespace-pre-wrap break-words">
                                    {tweetText}
                                  </p>
                                ) : (
                                  <p className="text-[13px] text-gray-600 italic">Start typing...</p>
                                )}
                              </div>
                              {tweetText.length > 280 && (
                                <div className="mt-1 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5 inline-block">
                                  <span className="text-[10px] text-red-400 font-medium">
                                    +{tweetText.length - 280} over limit
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-5 mt-2 text-gray-600">
                                {['\uD83D\uDCAC', '\uD83D\uDD01', '\u2764\uFE0F', '\uD83D\uDCCA'].map((e, j) => (
                                  <span key={j} className="text-[11px] cursor-pointer hover:text-gray-400">
                                    {e}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {isThread && activeTweets.length > 1 && (
                    <div className="px-3 py-2 border-t border-gray-800">
                      <span className="text-[13px] text-blue-400 font-medium">Show this thread</span>
                    </div>
                  )}
                </div>
                {/* Predicted performance */}
                <div className="px-3 py-2.5 border-t border-gray-800 bg-gray-900/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-blue-400">
                      <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21v-5.5h2V21H4z" />
                    </svg>
                    <span className="text-[10px] text-gray-400 font-medium">Predicted</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Impressions', value: isThread ? '~18-24K' : '~5-8K', good: true },
                      { label: 'Engagements', value: isThread ? '~850-1.2K' : '~200-400', good: true },
                      { label: 'Eng. Rate', value: isThread ? '~6.2-7.8%' : '~3.5-4.5%', good: true },
                      { label: 'Clicks', value: isThread ? '~120-200' : '~40-80', good: false },
                    ].map((p, k) => (
                      <div key={k} className="text-center">
                        <div className={`text-[11px] font-semibold ${p.good ? 'text-green-400' : 'text-gray-400'}`}>
                          {p.value}
                        </div>
                        <div className="text-[9px] text-gray-600">{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Reddit preview */
              <div
                className="rounded-2xl border border-gray-200 overflow-hidden"
                style={{
                  background: '#1a1a1b',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[#343536]" style={{ background: '#1a1a1b' }}>
                  <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#FF4500]">
                    <path d="M16.5 8c-.02-1.13-.94-2.04-2.07-2.02-.55.01-1.07.24-1.46.63-.97-.67-2.14-1.06-3.37-1.12l.61-2.84 1.98.42c.02.78.66 1.4 1.44 1.38.79-.02 1.42-.67 1.4-1.46-.02-.78-.67-1.4-1.46-1.38-.53.01-1.01.3-1.24.76L10.2 2l-.73 3.47c-1.28.04-2.5.44-3.51 1.13-.89-.88-2.33-.87-3.21.02-.88.89-.87 2.33.02 3.21-.16.47-.24.96-.24 1.46 0 3.36 3.38 6.08 7.54 6.08s7.54-2.72 7.54-6.08c0-.48-.08-.96-.23-1.42.47-.43.75-1.04.74-1.68H16.5z" />
                  </svg>
                  <span className="text-[#D7DADC] text-xs font-medium">Reddit Preview</span>
                </div>
                <div className="flex" style={{ background: '#1a1a1b' }}>
                  <div className="flex flex-col items-center gap-0.5 px-2.5 py-3" style={{ background: '#161617' }}>
                    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#818384] hover:fill-[#FF4500] cursor-pointer">
                      <path d="M12.877 19H7.123A1.125 1.125 0 016 17.877V11H2.126a1.114 1.114 0 01-1.007-.7 1.249 1.249 0 01.171-1.343L9.166.368a1.128 1.128 0 011.668.004l7.872 8.581a1.252 1.252 0 01.176 1.348 1.114 1.114 0 01-1.005.7H14v6.877A1.125 1.125 0 0112.877 19z" />
                    </svg>
                    <span className="text-xs font-bold text-[#D7DADC]">1</span>
                    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#818384] hover:fill-[#7193FF] cursor-pointer">
                      <path d="M7.123 1h5.754A1.125 1.125 0 0114 2.123V9h3.874a1.114 1.114 0 011.007.7 1.249 1.249 0 01-.171 1.343l-7.872 8.589a1.128 1.128 0 01-1.668-.004L1.29 11.04a1.252 1.252 0 01-.176-1.348A1.114 1.114 0 012.126 9H6V2.123A1.125 1.125 0 017.123 1z" />
                    </svg>
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2 text-[11px]">
                      <div className="w-5 h-5 rounded-full bg-[#FF4500] flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">r/</span>
                      </div>
                      <span className="font-bold text-[#D7DADC]">r/venturecapital</span>
                      <span className="text-[#818384]">&middot; Posted by u/highland_ventures &middot; now</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#D7DADC] mb-2 leading-snug">
                      {tweets[0]?.split('\n')[0]?.slice(0, 80) || 'Post title here'}
                    </h3>
                    <div className="text-[13px] text-[#D7DADC]/80 leading-relaxed whitespace-pre-wrap break-words">
                      {tweets[0] || <span className="text-[#818384] italic">Start typing...</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-2 border-t border-[#343536] text-[11px] text-[#818384] font-bold">
                      <span className="flex items-center gap-1 hover:bg-[#343536] px-2 py-1 rounded cursor-pointer">
                        0 Comments
                      </span>
                      <span className="flex items-center gap-1 hover:bg-[#343536] px-2 py-1 rounded cursor-pointer">
                        Share
                      </span>
                      <span className="flex items-center gap-1 hover:bg-[#343536] px-2 py-1 rounded cursor-pointer">
                        Save
                      </span>
                    </div>
                  </div>
                </div>
                {/* Predicted performance - Reddit */}
                <div className="px-3 py-2.5 border-t border-[#343536]" style={{ background: '#161617' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-[#818384] font-medium">{'\uD83D\uDCCA'} Predicted Performance</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Upvotes', value: '~15-40', good: true },
                      { label: 'Comments', value: '~5-12', good: true },
                      { label: 'Upvote Ratio', value: '~85-92%', good: true },
                      { label: 'Cross-posts', value: '~1-3', good: false },
                    ].map((p, k) => (
                      <div key={k} className="text-center">
                        <div className={`text-[11px] font-semibold ${p.good ? 'text-[#FF4500]' : 'text-[#818384]'}`}>
                          {p.value}
                        </div>
                        <div className="text-[9px] text-[#818384]">{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: Sidebar - Drafts & Queue */}
        <div className="flex flex-col min-h-0 border-l border-gray-200 pl-4">
          <div className="flex items-center gap-0.5 mb-2 bg-gray-100 rounded-lg p-0.5">
            {[
              { key: 'drafts', label: 'Drafts', count: drafts.length },
              { key: 'queue', label: 'Queue', count: scheduledPosts.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setSidebarTab(t.key)}
                className={`flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  sidebarTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {draftsQ.isLoading || queueQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : sidebarTab === 'drafts' ? (
              <div className="space-y-1.5">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-2.5 bg-white rounded-lg border border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformBadge platform={d.platform} />
                      {d.type === 'thread' && (
                        <span className="text-[10px] text-blue-600 font-medium">{d.tweets} tweets</span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto">{d.created}</span>
                    </div>
                    <p
                      className="text-[11px] text-gray-700 leading-snug line-clamp-2"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {d.content}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-[10px] text-blue-600 font-medium">Edit</button>
                      <span className="text-gray-300">&middot;</span>
                      <button className="text-[10px] text-red-500 font-medium">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {scheduledPosts.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 bg-white rounded-lg border border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformBadge platform={p.platform} />
                      {p.type === 'thread' && (
                        <span className="text-[10px] text-blue-600 font-medium">{p.tweets} tweets</span>
                      )}
                    </div>
                    <p
                      className="text-[11px] text-gray-700 leading-snug line-clamp-2"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.content}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span>{'\uD83D\uDD50'}</span> {p.scheduledFor}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-[10px] text-blue-600 font-medium">Edit</button>
                        <button className="text-[10px] text-amber-600 font-medium">Reschedule</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
