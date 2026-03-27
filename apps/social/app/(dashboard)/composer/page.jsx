'use client';

import { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PlatformBadge, Skeleton } from '@/components/ui';
import { useToast } from '@/components/ui';
import PerformanceIntelPanel from '@/components/PerformanceIntelPanel';
import CompetitorIntelPanel from '@/components/CompetitorIntelPanel';
import AudienceQuestionsPanel from '@/components/AudienceQuestionsPanel';
import CopilotPanel from '@/components/CopilotPanel';

export default function ComposerPage() {
  const [selectedPlatform, setSelectedPlatform] = useState('X');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [redditSubreddit, setRedditSubreddit] = useState('');
  const [redditTitle, setRedditTitle] = useState('');
  const [redditPostType, setRedditPostType] = useState('Text');
  const [tweets, setTweets] = useState([
    "Most VCs evaluate founders on pattern matching. Here's why that's broken — and 7 signals we look for instead.\n\nA thread 🧵",
    "Signal 1: Founder-market obsession, not just fit.\n\nWe don't ask \"do you know this space?\" We ask \"what's the thing about this problem that keeps you up at night that nobody else sees?\"\n\nThe best founders have an almost irrational depth of insight into their specific wedge.",
    "Signal 2: Speed of learning, not years of experience.\n\nWe track how quickly a founder iterates on feedback between our conversations. If they've meaningfully evolved their pitch/product between meeting 1 and meeting 2 (usually 1-2 weeks), that's a stronger signal than 10 years in industry.",
    "Signal 3: Customer conversations > TAM slides.\n\nShow us 5 real customer conversations with quotes. That's worth more than any McKinsey market sizing.\n\nThe founders who close us fastest always lead with customer evidence, not market size.",
    "Signal 4: Hiring taste.\n\nWho are the first 3-5 people they'd hire? How specific can they get? Do they know these people by name?\n\nGreat founders have been mentally building their team for months before they even start fundraising.",
  ]);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [scheduleTime, setScheduleTime] = useState('09:15');
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingPostStatus, setEditingPostStatus] = useState(null);
  const [requestLcReview, setRequestLcReview] = useState(false);

  // ── New layout state ──────────────────────────────────────
  const [centerTab, setCenterTab] = useState('preview'); // 'preview' | 'copilot'
  const [sidebarTab, setSidebarTab] = useState('drafts'); // 'drafts' | 'intel'
  const [activeTweetIndex, setActiveTweetIndex] = useState(0);

  // ── tRPC queries ──────────────────────────────────────────
  const accountsQ = trpc.accounts.list.useQuery(undefined, { staleTime: 60_000 });
  const draftsQ = trpc.posts.list.useQuery({ status: 'DRAFT' }, { staleTime: 15_000 });
  const pendingReviewQ = trpc.posts.list.useQuery({ status: 'PENDING_APPROVAL' }, { staleTime: 15_000 });

  const utils = trpc.useUtils();
  const toast = useToast();

  // ── Derived (hoisted above callbacks to avoid TDZ) ──────
  const accounts = accountsQ.data ?? [];
  const drafts = draftsQ.data?.items ?? [];
  const pendingReviewPosts = pendingReviewQ.data?.items ?? [];
  const activeTweets = tweets.filter((t) => (t || '').trim());
  const isThread = activeTweets.length > 1;
  const platformAccounts = accounts.filter((a) => a.platform === selectedPlatform);
  const selectedAccountObj = accounts.find((a) => a.username === selectedAccount);
  const selectedAccountId = selectedAccountObj?.id;

  // ── Tier-aware limits ───────────────────────────────────
  const accountTier = selectedAccountObj?.subscriptionTier || 'free';
  const isPremium = accountTier === 'premium' || accountTier === 'premium_plus';
  const isPremiumPlus = accountTier === 'premium_plus';
  const charLimit = selectedPlatform === 'X'
    ? (isPremium ? 25000 : 280)
    : 40000;
  const tierLabel = {
    free: 'Free',
    basic: 'Basic',
    premium: 'Premium',
    premium_plus: 'Premium+',
  }[accountTier] || 'Free';

  // ── Content type helpers ────────────────────────────────
  const contentType = isThread ? 'THREAD' : 'POST';
  const getRedditFields = () =>
    selectedPlatform === 'REDDIT'
      ? { subreddit: redditSubreddit || undefined, articleTitle: redditTitle || undefined }
      : {};

  const isPublishingRef = { current: false };
  const createMutation = trpc.posts.create.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
      // Only show toast for explicit save (not for publish-via-create)
      if (!isPublishingRef.current) {
        toast.success('Draft saved!');
      }
    },
    onError: (err) => {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    },
  });

  const publishMutation = trpc.posts.publish.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
      toast.success('Published successfully!');
      // Reset editor state
      setTweets(['']);
      setEditingPostId(null);
      setEditingPostStatus(null);
      setActiveTweetIndex(0);
      setCenterTab('preview');
    },
    onError: (err) => {
      toast.error('Publish failed: ' + (err.message || 'Unknown error'));
    },
  });

  const deleteMutation = trpc.posts.delete.useMutation({
    onSuccess: () => utils.posts.list.invalidate(),
  });

  const approvalCreateMutation = trpc.approvals.create.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
      toast.success('Submitted for L&C review');
      setRequestLcReview(false);
    },
    onError: (err) => {
      toast.error('Failed to submit for review: ' + (err.message || 'Unknown error'));
    },
  });

  const updateMutation = trpc.posts.update.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
      setEditingPostId(null);
      setEditingPostStatus(null);
      toast.success('Post updated!');
    },
  });

  // ── AI mutations ──────────────────────────────────────────
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const optimizeMutation = trpc.ai.optimizeThread.useMutation({
    onSuccess: (data) => {
      setAiSuggestion(data);
      setAiLoading(false);
    },
    onError: (err) => {
      toast.error('AI optimization failed: ' + (err.message || 'Unknown error'));
      setAiLoading(false);
    },
  });

  const handleAiOptimize = useCallback(() => {
    const content = tweets.filter((t) => (t || '').trim());
    if (content.length === 0) {
      toast.info('Write some content first before optimizing.');
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    optimizeMutation.mutate({ tweets: content, charLimit, accountTier });
  }, [tweets, optimizeMutation, toast, charLimit, accountTier]);

  const handleApplyAiSuggestions = useCallback(() => {
    if (!aiSuggestion?.optimizedTweets?.length) return;
    setTweets(aiSuggestion.optimizedTweets);
    toast.success('AI suggestions applied!');
    setAiSuggestion(null);
  }, [aiSuggestion, toast]);

  // ── Predict Performance ───────────────────────────────────
  const [prediction, setPrediction] = useState(null);
  const predictMutation = trpc.ai.predictPerformance.useMutation({
    onSuccess: (data) => setPrediction(data),
    onError: (err) => toast.error('Prediction failed: ' + (err.message || 'Unknown error')),
  });

  // ── Draft insertion helper ────────────────────────────────
  function parseDraftToTweets(draftText) {
    const numbered = draftText.split(/\n(?=\d+[.)]\s|Tweet \d|Post \d)/);
    if (numbered.length > 1) return numbered.map(t => t.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
    const paragraphs = draftText.split(/\n\n+/).filter(Boolean);
    if (paragraphs.length > 1) return paragraphs;
    return [draftText.trim()];
  }

  useEffect(() => {
    if (platformAccounts.length > 0 && !platformAccounts.find((a) => a.username === selectedAccount)) {
      setSelectedAccount(platformAccounts[0].username);
    }
  }, [selectedPlatform, platformAccounts.length]);

  const loadPostIntoEditor = useCallback((post) => {
    if (post.contentType === 'THREAD' && post.content?.includes('\n---\n')) {
      setTweets(post.content.split('\n---\n'));
    } else {
      setTweets([post.content || '']);
    }
    const postPlatform = post.platform || post.account?.platform || 'X';
    setSelectedPlatform(postPlatform);
    const acct = accounts.find((a) => a.id === (post.accountId || post.account?.id));
    if (acct) setSelectedAccount(acct.username);
    if (post.scheduledFor) {
      const d = new Date(post.scheduledFor);
      setScheduleDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setScheduleTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
    if (post.subreddit) setRedditSubreddit(post.subreddit);
    if (post.articleTitle && postPlatform === 'REDDIT') setRedditTitle(post.articleTitle);
    setEditingPostId(post.id);
    setEditingPostStatus(post.status);
    setSidebarTab('drafts');
    toast.info(post.status === 'SCHEDULED' ? 'Scheduled post loaded into editor' : 'Draft loaded into editor');
  }, [accounts, toast]);

  const cancelEditing = useCallback(() => {
    setEditingPostId(null);
    setEditingPostStatus(null);
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  const handleSaveDraft = () => {
    if (!selectedAccountId) return;
    const content = isThread ? tweets.join('\n---\n') : tweets[0];
    if (editingPostId) {
      updateMutation.mutate({
        id: editingPostId,
        data: { content, contentType, ...getRedditFields() },
      });
    } else {
      createMutation.mutate({
        content,
        platform: selectedPlatform,
        accountId: selectedAccountId,
        contentType,
        ...getRedditFields(),
      });
    }
  };

  const handleSchedule = async () => {
    if (!selectedAccountId) return;
    const content = isThread ? tweets.join('\n---\n') : tweets[0];
    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`);

    if (requestLcReview) {
      let postId = editingPostId;
      if (editingPostId) {
        await updateMutation.mutateAsync({
          id: editingPostId,
          data: { content, contentType, scheduledFor, ...getRedditFields() },
        });
      } else {
        const post = await createMutation.mutateAsync({
          content,
          platform: selectedPlatform,
          accountId: selectedAccountId,
          contentType,
          scheduledFor,
          ...getRedditFields(),
        });
        postId = post?.id;
      }
      if (postId) {
        approvalCreateMutation.mutate({ postId });
      }
    } else {
      if (editingPostId) {
        updateMutation.mutate({
          id: editingPostId,
          data: { content, contentType, status: 'SCHEDULED', scheduledFor, ...getRedditFields() },
        });
      } else {
        createMutation.mutate({
          content,
          platform: selectedPlatform,
          accountId: selectedAccountId,
          contentType,
          scheduledFor,
          ...getRedditFields(),
        });
      }
    }
  };

  const handlePublishNow = async () => {
    if (!selectedAccountId) return;
    isPublishingRef.current = true;
    try {
      const post = await createMutation.mutateAsync({
        content: isThread ? tweets.join('\n---\n') : tweets[0],
        platform: selectedPlatform,
        accountId: selectedAccountId,
        contentType,
        ...getRedditFields(),
      });
      if (post?.id) {
        publishMutation.mutate({ id: post.id });
      }
    } finally {
      isPublishingRef.current = false;
    }
  };

  // ── Keyboard shortcut: ⌘K → Co-Pilot ─────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCenterTab('copilot');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Copilot draft insertion ───────────────────────────────
  const handleCopilotInsertDraft = useCallback((draftText) => {
    if (isThread) {
      const draftTweets = parseDraftToTweets(draftText);
      if (tweets.some(t => t.trim())) {
        if (window.confirm('Replace current thread draft? (Cancel to append)')) {
          setTweets(draftTweets);
        } else {
          setTweets([...tweets, ...draftTweets]);
        }
      } else {
        setTweets(draftTweets);
      }
    } else {
      const draftTweets = parseDraftToTweets(draftText);
      setTweets(draftTweets.length > 0 ? [draftTweets[0]] : [draftText]);
    }
  }, [tweets, isThread]);

  // ── Helpers ───────────────────────────────────────────────
  const avatarUrl = selectedAccountObj?.avatarUrl;
  const displayName = selectedAccountObj?.displayName || selectedAccount || 'Account';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col bg-composer-canvas" style={{ height: 'calc(100vh - 64px)', minHeight: '600px' }}>
      {/* ═══════════ TOOLBAR ═══════════ */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/[0.05]">
        {/* Left: Platform + Account + Tier */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Platform toggle */}
          <div className="flex items-center gap-0.5 bg-composer-s1 rounded-lg p-0.5">
            {[
              { key: 'X', label: '𝕏' },
              { key: 'REDDIT', label: 'Reddit' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPlatform(p.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  selectedPlatform === p.key
                    ? 'bg-composer-s2 shadow-sm text-composer-ink'
                    : 'text-composer-ink3 hover:text-composer-ink2'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Account selector */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="text-sm border border-white/[0.09] rounded-lg px-2.5 py-1.5 bg-composer-s1 text-composer-ink"
          >
            {platformAccounts.map((a) => (
              <option key={a.id} value={a.username}>
                @{a.username}
              </option>
            ))}
          </select>
          {/* Tier badge */}
          {selectedPlatform === 'X' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium font-mono ${
              isPremiumPlus ? 'bg-copilot/10 text-copilot' :
              isPremium ? 'bg-accent/10 text-accent' :
              'bg-composer-s2 text-composer-ink3'
            }`}>
              {tierLabel}{isPremium ? ` · ${(charLimit / 1000).toFixed(0)}K chars` : ' · 280 chars'}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {editingPostId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-copilot/10 border border-copilot/20 rounded-lg">
              <span className="text-xs font-medium text-copilot">
                Editing {editingPostStatus === 'SCHEDULED' ? 'scheduled post' : 'draft'}
              </span>
              <button onClick={cancelEditing} className="text-xs text-copilot hover:text-copilot/80 font-bold ml-0.5">
                ✕
              </button>
            </div>
          )}
          <button
            onClick={handleSaveDraft}
            disabled={createMutation.isLoading || updateMutation.isLoading}
            className="px-3 py-1.5 text-xs text-composer-ink2 border border-white/[0.09] rounded-lg hover:bg-composer-s2 transition-colors"
          >
            {(createMutation.isLoading || updateMutation.isLoading) ? 'Saving...' : editingPostId ? 'Update Draft' : 'Save Draft'}
          </button>
          <div className="flex items-center gap-1.5 bg-composer-s1 rounded-lg px-2.5 py-1.5">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="text-xs bg-transparent border-none outline-none w-[120px] cursor-pointer text-composer-ink font-mono"
            />
            <span className="text-composer-ink-muted text-xs">|</span>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="text-xs bg-transparent border-none outline-none w-[80px] cursor-pointer text-composer-ink font-mono"
            />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requestLcReview}
              onChange={(e) => setRequestLcReview(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/[0.09] accent-copilot"
            />
            <span className="text-xs text-composer-ink2 whitespace-nowrap">L&C Review</span>
          </label>
          <button
            onClick={handleSchedule}
            disabled={approvalCreateMutation.isLoading}
            className={`px-4 py-1.5 text-white text-xs rounded-lg font-medium transition-colors ${
              requestLcReview
                ? 'bg-copilot/80 hover:bg-copilot'
                : 'bg-accent hover:bg-accent/90'
            }`}
          >
            {approvalCreateMutation.isLoading ? 'Submitting...' : requestLcReview ? 'Submit for Review' : 'Schedule'}
          </button>
          <button
            onClick={handlePublishNow}
            disabled={publishMutation.isLoading}
            className="px-4 py-1.5 bg-composer-ink text-composer-canvas text-xs rounded-lg hover:opacity-90 font-medium transition-opacity"
          >
            {publishMutation.isLoading ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </div>

      {/* ═══════════ MAIN 3-COLUMN GRID ═══════════ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1fr_240px] gap-0">

        {/* ─── COLUMN 1: COMPOSE ─── */}
        <div className="flex flex-col min-h-0 border-r border-white/[0.05] p-4">
          <h3 className="text-xs font-semibold text-composer-ink3 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-accent flex items-center justify-center text-white text-[9px] font-bold">1</span>
            Compose
          </h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
            {selectedPlatform === 'REDDIT' ? (
              /* Reddit compose */
              <div className="bg-composer-s0 rounded-lg border border-white/[0.09] p-3 flex flex-col">
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <select
                    value={redditSubreddit}
                    onChange={(e) => setRedditSubreddit(e.target.value)}
                    className="text-xs border border-white/[0.09] rounded-lg px-2 py-1 bg-composer-s1 text-composer-ink"
                  >
                    <option value="">Select subreddit...</option>
                    <option value="r/FigureTech">r/FigureTech</option>
                    <option value="r/FigureMarkets">r/FigureMarkets</option>
                    <option value="r/FIGR">r/FIGR</option>
                    <option value="r/defi">r/defi</option>
                    <option value="r/cryptocurrency">r/cryptocurrency</option>
                    <option value="r/RealEstate">r/RealEstate</option>
                    <option value="r/fintech">r/fintech</option>
                  </select>
                  <input
                    value={redditTitle}
                    onChange={(e) => setRedditTitle(e.target.value)}
                    placeholder="Post title..."
                    className="flex-1 min-w-[100px] text-xs border border-white/[0.09] rounded-lg px-2 py-1 bg-composer-s1 text-composer-ink placeholder-composer-ink-muted"
                  />
                  <select
                    value={redditPostType}
                    onChange={(e) => setRedditPostType(e.target.value)}
                    className="text-xs border border-white/[0.09] rounded-lg px-2 py-1 bg-composer-s1 text-composer-ink"
                  >
                    <option>Text</option>
                    <option>Link</option>
                    <option>Image</option>
                    <option>Poll</option>
                  </select>
                </div>
                <textarea
                  value={tweets[0]}
                  onChange={(e) => setTweets([e.target.value])}
                  className="w-full flex-1 text-[13px] text-composer-ink bg-transparent border-none outline-none resize-none leading-relaxed min-h-[200px] placeholder-composer-ink-muted"
                  placeholder="Write your post (Markdown)..."
                />
              </div>
            ) : (
              /* X tweet/thread compose */
              <div className="space-y-2.5">
                {tweets.map((tweet, i) => (
                  <div
                    key={i}
                    className={`bg-composer-s0 rounded-lg border transition-colors group ${
                      activeTweetIndex === i ? 'border-white/[0.15]' : 'border-white/[0.09]'
                    }`}
                    onClick={() => setActiveTweetIndex(i)}
                  >
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-composer-s1 rounded-t-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-composer-ink-muted font-mono">
                          {i + 1}/{tweets.length}
                        </span>
                        {i === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium">
                            HOOK
                          </span>
                        )}
                        {i === tweets.length - 1 && tweets.length > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded font-medium">
                            CTA
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium font-mono ${
                          tweet.length > charLimit
                            ? 'text-red-400'
                            : tweet.length > charLimit * 0.9
                            ? 'text-copilot'
                            : 'text-composer-ink-muted'
                        }`}
                      >
                        {tweet.length.toLocaleString()}/{charLimit > 1000 ? `${(charLimit / 1000).toFixed(0)}K` : charLimit}
                      </span>
                    </div>
                    {/* Body */}
                    <div className="px-3 py-2">
                      <textarea
                        value={tweet}
                        onChange={(e) => {
                          const t = [...tweets];
                          t[i] = e.target.value;
                          setTweets(t);
                        }}
                        className="w-full text-[13px] text-composer-ink bg-transparent border-none outline-none resize-none leading-relaxed placeholder-composer-ink-muted"
                        style={{ minHeight: Math.max(60, Math.min(140, tweet.length / 2)) + 'px' }}
                        placeholder={
                          i === 0
                            ? 'Hook — grab attention...'
                            : i === tweets.length - 1
                            ? 'CTA — what should they do?'
                            : 'Continue the thread...'
                        }
                      />
                      {tweet.length > charLimit && (
                        <div className="mt-1 text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-0.5 inline-block font-mono">
                          +{(tweet.length - charLimit).toLocaleString()} over limit
                        </div>
                      )}
                    </div>
                    {/* Bottom bar */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/[0.05]">
                      <button className="text-[10px] text-composer-ink-muted hover:text-composer-ink2 px-1.5 py-0.5 rounded hover:bg-composer-s2 transition-colors">
                        IMG
                      </button>
                      <button className="text-[10px] text-composer-ink-muted hover:text-composer-ink2 px-1.5 py-0.5 rounded hover:bg-composer-s2 transition-colors">
                        LINK
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCenterTab('copilot');
                          setActiveTweetIndex(i);
                        }}
                        className="text-[10px] text-copilot hover:text-copilot/80 px-1.5 py-0.5 rounded hover:bg-copilot/10 transition-colors font-medium"
                      >
                        ✨ AI
                      </button>
                      <div className="flex-1" />
                      {tweets.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTweets(tweets.filter((_, j) => j !== i));
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setTweets([...tweets, ''])}
                  className="w-full py-2 border-2 border-dashed border-white/[0.09] rounded-lg text-xs text-composer-ink-muted hover:border-accent/50 hover:text-accent transition-colors"
                >
                  + Add tweet
                </button>
              </div>
            )}

            {/* Performance tip */}
            <div className="mt-3">
              <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-2.5">
                <p className="text-[11px] text-green-400">
                  <strong>Best slot:</strong> Tue 9:15am (8.2% eng). You're set for Wed (5.1%).{' '}
                  <button className="text-green-300 underline font-medium">Switch?</button>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── COLUMN 2: CENTER PANEL (TABBED) ─── */}
        <div className="flex flex-col min-h-0 border-r border-white/[0.05] p-4">
          {/* Tab header */}
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={() => setCenterTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                centerTab === 'preview'
                  ? 'bg-composer-s2 text-composer-ink'
                  : 'text-composer-ink3 hover:text-composer-ink2'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${centerTab === 'preview' ? 'bg-green-400' : 'bg-composer-ink-muted'}`} />
              Live Preview
            </button>
            <button
              onClick={() => setCenterTab('copilot')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                centerTab === 'copilot'
                  ? 'bg-copilot/10 text-copilot'
                  : 'text-composer-ink3 hover:text-composer-ink2'
              }`}
            >
              Co-Pilot
              <kbd className="text-[9px] px-1 py-0.5 rounded bg-composer-s1 text-composer-ink-muted font-mono">⌘K</kbd>
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {/* ── LIVE PREVIEW TAB ── */}
            {centerTab === 'preview' && (
              <>
                {selectedPlatform === 'X' ? (
                  /* X Post / Thread preview */
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: '#000', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    <div>
                      {tweets
                        .filter((t) => t !== undefined)
                        .map((tweet, i, arr) => {
                          const nonEmpty = arr.filter((t) => (t || '').trim());
                          const isLast = i === nonEmpty.length - 1;
                          const tweetText = tweet || '';
                          return (
                            <div key={i} className="px-4 pt-3 pb-0">
                              <div className="flex gap-3">
                                <div className="flex flex-col items-center flex-shrink-0">
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-[#333639] flex items-center justify-center">
                                      <span className="text-[#e7e9ea] text-xs font-bold">{initials}</span>
                                    </div>
                                  )}
                                  {isThread && !isLast && tweetText.trim() && (
                                    <div className="w-[2px] flex-1 bg-[#333639] mt-1 min-h-[8px]" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 pb-3">
                                  <div className="flex items-center gap-1 leading-none">
                                    <span className="text-[15px] font-bold text-[#e7e9ea]">{displayName}</span>
                                    <svg viewBox="0 0 22 22" className="w-[18px] h-[18px] flex-shrink-0" aria-label="Verified">
                                      <path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.223 1.261.272 1.894.14.633-.132 1.217-.438 1.684-.883.447-.468.752-1.054.883-1.69.132-.634.085-1.294-.138-1.9.586-.272 1.084-.703 1.438-1.241.355-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                                    </svg>
                                    <span className="text-[15px] text-[#71767b]">@{selectedAccount}</span>
                                    <span className="text-[15px] text-[#71767b]">&middot;</span>
                                    <span className="text-[15px] text-[#71767b]">now</span>
                                  </div>
                                  <div className="mt-1">
                                    {tweetText.trim() ? (
                                      <p className="text-[15px] text-[#e7e9ea] leading-[1.3125] whitespace-pre-wrap break-words">
                                        {tweetText}
                                      </p>
                                    ) : (
                                      <p className="text-[15px] text-[#71767b] italic">Start typing...</p>
                                    )}
                                  </div>
                                  {tweetText.length > charLimit && (
                                    <div className="mt-1.5 bg-[#67000d]/30 border border-[#f4212e]/30 rounded-lg px-2.5 py-1 inline-block">
                                      <span className="text-[13px] text-[#f4212e] font-medium">
                                        {(tweetText.length - charLimit).toLocaleString()} characters over limit
                                      </span>
                                    </div>
                                  )}
                                  {/* Engagement bar */}
                                  <div className="flex items-center justify-between mt-3 max-w-[425px]">
                                    <div className="flex items-center gap-1 group/btn cursor-pointer">
                                      <div className="p-2 rounded-full group-hover/btn:bg-[#1d9bf0]/10 transition-colors">
                                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#71767b] group-hover/btn:fill-[#1d9bf0] transition-colors">
                                          <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 group/btn cursor-pointer">
                                      <div className="p-2 rounded-full group-hover/btn:bg-[#00ba7c]/10 transition-colors">
                                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#71767b] group-hover/btn:fill-[#00ba7c] transition-colors">
                                          <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 group/btn cursor-pointer">
                                      <div className="p-2 rounded-full group-hover/btn:bg-[#f91880]/10 transition-colors">
                                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#71767b] group-hover/btn:fill-[#f91880] transition-colors">
                                          <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 group/btn cursor-pointer">
                                      <div className="p-2 rounded-full group-hover/btn:bg-[#1d9bf0]/10 transition-colors">
                                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#71767b] group-hover/btn:fill-[#1d9bf0] transition-colors">
                                          <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21v-5.5h2V21H4z" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0">
                                      <div className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors cursor-pointer">
                                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#71767b] hover:fill-[#1d9bf0] transition-colors">
                                          <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" />
                                        </svg>
                                      </div>
                                      <div className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors cursor-pointer">
                                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#71767b] hover:fill-[#1d9bf0] transition-colors">
                                          <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {isThread && (
                        <div className="px-4 py-3 border-t border-[#2f3336]">
                          <span className="text-[15px] text-[#1d9bf0] hover:underline cursor-pointer">Show this thread</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Reddit preview */
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: '#0e1113', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    <div className="rounded-xl m-2" style={{ background: '#1a1a1b', border: '1px solid #343536' }}>
                      <div className="flex">
                        <div className="flex flex-col items-center gap-1 px-3 py-3 rounded-l-xl" style={{ background: '#161617' }}>
                          <svg viewBox="0 0 20 20" className="w-6 h-6 fill-[#818384] hover:fill-[#FF4500] cursor-pointer transition-colors">
                            <path d="M12.877 19H7.123A1.125 1.125 0 016 17.877V11H2.126a1.114 1.114 0 01-1.007-.7 1.249 1.249 0 01.171-1.343L9.166.368a1.128 1.128 0 011.668.004l7.872 8.581a1.252 1.252 0 01.176 1.348 1.114 1.114 0 01-1.005.7H14v6.877A1.125 1.125 0 0112.877 19z" />
                          </svg>
                          <span className="text-[12px] font-bold text-[#D7DADC]">1</span>
                          <svg viewBox="0 0 20 20" className="w-6 h-6 fill-[#818384] hover:fill-[#7193FF] cursor-pointer transition-colors">
                            <path d="M7.123 1h5.754A1.125 1.125 0 0114 2.123V9h3.874a1.114 1.114 0 011.007.7 1.249 1.249 0 01-.171 1.343l-7.872 8.589a1.128 1.128 0 01-1.668-.004L1.29 11.04a1.252 1.252 0 01-.176-1.348A1.114 1.114 0 012.126 9H6V2.123A1.125 1.125 0 017.123 1z" />
                          </svg>
                        </div>
                        <div className="flex-1 p-3 min-w-0">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-5 h-5 rounded-full bg-[#FF4500] flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[8px] font-bold">r/</span>
                            </div>
                            <span className="text-[12px] font-bold text-[#D7DADC] hover:underline cursor-pointer">{redditSubreddit || 'r/subreddit'}</span>
                            <span className="text-[12px] text-[#818384]">&middot;</span>
                            <span className="text-[12px] text-[#818384]">Posted by u/{selectedAccount || 'username'}</span>
                            <span className="text-[12px] text-[#818384]">&middot; just now</span>
                          </div>
                          <h3 className="text-[18px] font-semibold text-[#D7DADC] mb-2 leading-snug">
                            {redditTitle || tweets[0]?.split('\n')[0]?.slice(0, 80) || 'Post title here'}
                          </h3>
                          <div className="text-[14px] text-[#D7DADC]/90 leading-relaxed whitespace-pre-wrap break-words mb-3">
                            {tweets[0] || <span className="text-[#818384] italic">Start typing...</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[12px] text-[#818384] font-bold">
                            <button className="flex items-center gap-1.5 hover:bg-[#343536] px-2 py-1.5 rounded transition-colors">
                              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                <path d="M7.725 19.872a.718.718 0 01-.633-.372.735.735 0 01-.031-.727l1.89-3.768H4.383A1.63 1.63 0 012.77 13.38L4.53 6.27a1.656 1.656 0 011.596-1.22h4.1l.18-.8c.183-.816.897-1.393 1.733-1.393h3.24c.476 0 .93.193 1.26.537.333.344.51.806.493 1.28l-.555 15.592a.724.724 0 01-.722.688H7.725z" />
                              </svg>
                              0 Comments
                            </button>
                            <button className="flex items-center gap-1.5 hover:bg-[#343536] px-2 py-1.5 rounded transition-colors">
                              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                <path d="M18.942 7.058L12.8.912a1.5 1.5 0 00-2.562 1.06v2.756c-4.678.394-7.903 2.922-8.877 6.988-.33 1.378.243 2.27.838 2.27.415 0 .7-.25.962-.622 1.328-1.887 3.396-3.062 6.252-3.422l.825-.104v3.188a1.5 1.5 0 002.562 1.06l6.143-6.168a1.5 1.5 0 000-2.12z" />
                              </svg>
                              Share
                            </button>
                            <button className="flex items-center gap-1.5 hover:bg-[#343536] px-2 py-1.5 rounded transition-colors">
                              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h7C14.881 2 16 3.12 16 4.5v13.94l-6-4.29-6 4.29V4.5z" />
                              </svg>
                              Save
                            </button>
                            <button className="flex items-center gap-1.5 hover:bg-[#343536] px-2 py-1.5 rounded transition-colors">
                              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                <path d="M10 20c-.264 0-.528-.101-.729-.302a15.089 15.089 0 01-1.69-2.036C5.712 15.178 3 11.322 3 8.5a7 7 0 1114 0c0 2.822-2.712 6.678-4.581 9.162a15.088 15.088 0 01-1.69 2.036.992.992 0 01-.729.302z" />
                              </svg>
                              Hide
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── CO-PILOT TAB ── */}
            {centerTab === 'copilot' && (
              <div className="flex flex-col h-full">
                {/* Context badge */}
                <div className="mb-3 px-3 py-2 bg-copilot/[0.06] border border-copilot/10 rounded-lg">
                  <span className="text-[11px] text-copilot font-medium">
                    Focused on Tweet {activeTweetIndex + 1}
                    {activeTweetIndex === 0 ? ' — HOOK' : activeTweetIndex === tweets.length - 1 && tweets.length > 1 ? ' — CTA' : ''}
                  </span>
                </div>

                {/* AI suggestions (moved from column 1) */}
                {(aiLoading || aiSuggestion) && (
                  <div className="mb-3 bg-copilot/[0.06] border border-copilot/10 rounded-lg p-3">
                    {aiLoading ? (
                      <>
                        <p className="text-[11px] font-semibold text-copilot mb-1">Analyzing your content...</p>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-copilot/20 rounded-full overflow-hidden">
                            <div className="h-full bg-copilot rounded-full animate-pulse" style={{ width: '60%' }} />
                          </div>
                        </div>
                      </>
                    ) : aiSuggestion ? (
                      <>
                        <p className="text-[11px] font-semibold text-copilot mb-1">
                          AI Optimization Ready
                          {aiSuggestion.estimatedImprovement && (
                            <span className="ml-1 text-green-400">({aiSuggestion.estimatedImprovement})</span>
                          )}
                        </p>
                        {aiSuggestion.suggestions?.slice(0, 3).map((s, i) => (
                          <p key={i} className="text-[11px] text-composer-ink2 leading-relaxed mt-0.5">
                            <strong className="text-copilot">Tweet {s.tweetIndex + 1}:</strong> {s.suggestion}
                          </p>
                        ))}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={handleApplyAiSuggestions}
                            className="px-2.5 py-1 bg-copilot text-composer-canvas text-[10px] rounded-md font-medium hover:bg-copilot/90"
                          >
                            Apply All
                          </button>
                          <button
                            onClick={() => setAiSuggestion(null)}
                            className="px-2.5 py-1 text-copilot text-[10px] rounded-md font-medium hover:bg-copilot/10"
                          >
                            Dismiss
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Optimize button when no suggestion active */}
                {!aiLoading && !aiSuggestion && (
                  <div className="mb-3">
                    <button
                      onClick={handleAiOptimize}
                      className="w-full py-2 bg-copilot/10 border border-copilot/20 rounded-lg text-xs text-copilot font-medium hover:bg-copilot/15 transition-colors"
                    >
                      ✨ Optimize Thread with AI
                    </button>
                  </div>
                )}

                {/* CopilotPanel chat */}
                <div className="flex-1 min-h-0">
                  <CopilotPanel
                    accountId={selectedAccountId}
                    postMode={isThread ? 'thread' : 'single'}
                    platform={selectedPlatform}
                    onInsertDraft={handleCopilotInsertDraft}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── COLUMN 3: SIDEBAR ─── */}
        <div className="flex flex-col min-h-0 p-4">
          {/* Tab header */}
          <div className="flex items-center gap-0.5 mb-3 bg-composer-s1 rounded-lg p-0.5">
            {[
              { key: 'drafts', label: 'Drafts', count: drafts.length },
              { key: 'intel', label: 'Intel' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setSidebarTab(t.key)}
                className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors ${
                  sidebarTab === t.key
                    ? 'bg-composer-s2 shadow-sm text-composer-ink'
                    : 'text-composer-ink3 hover:text-composer-ink2'
                }`}
              >
                {t.label}{t.count != null ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {draftsQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : sidebarTab === 'intel' ? (
              <div className="space-y-4">
                <PerformanceIntelPanel />
                <div className="border-t border-white/[0.05] pt-3" />
                <CompetitorIntelPanel />
                <div className="border-t border-white/[0.05] pt-3" />
                <AudienceQuestionsPanel />
              </div>
            ) : (
              /* Drafts tab */
              <div className="space-y-1.5">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => loadPostIntoEditor(d)}
                    className={`p-2.5 bg-composer-s0 rounded-lg border hover:bg-composer-s1 cursor-pointer transition-colors group ${
                      editingPostId === d.id ? 'border-accent ring-1 ring-accent/30' : 'border-white/[0.09]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformBadge platform={d.platform} />
                      {d.contentType === 'THREAD' && (
                        <span className="text-[10px] text-accent font-medium">Thread</span>
                      )}
                      <span className="text-[10px] text-composer-ink-muted ml-auto font-mono">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p
                      className="text-[11px] text-composer-ink2 leading-snug"
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
                      <button
                        className="text-[10px] text-accent font-medium"
                        onClick={(e) => { e.stopPropagation(); loadPostIntoEditor(d); }}
                      >
                        Edit
                      </button>
                      <span className="text-composer-ink-muted">&middot;</span>
                      <button
                        className="text-[10px] text-red-400 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this draft?')) {
                            deleteMutation.mutate({ id: d.id });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pending L&C Review */}
                {pendingReviewPosts.length > 0 && (
                  <>
                    <div className="text-[10px] text-copilot font-semibold uppercase tracking-wider mt-3 mb-1.5">
                      Pending L&C Review ({pendingReviewPosts.length})
                    </div>
                    {pendingReviewPosts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => loadPostIntoEditor(p)}
                        className="p-2.5 bg-copilot/[0.06] rounded-lg border border-copilot/10 hover:bg-copilot/10 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <PlatformBadge platform={p.platform} />
                          <span className="text-[10px] text-copilot font-medium">L&C Review</span>
                        </div>
                        <p
                          className="text-[11px] text-composer-ink2 leading-snug"
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
                          <span className="text-[10px] text-composer-ink3 flex items-center gap-1 font-mono">
                            {p.scheduledFor ? new Date(p.scheduledFor).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
