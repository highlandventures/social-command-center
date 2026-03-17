/**
 * Intelligence Engine — Task Generation & Weekly Briefing
 *
 * Core logic for:
 * - Priority scoring (0-100)
 * - Signal-to-task conversion
 * - Weekly briefing generation
 * - Auto-task generation from listening hits
 */

import { generateInsight } from './ai';

/**
 * Compute priority score (0-100) for a signal.
 *
 * Factors:
 * - time_sensitivity (0.30): How soon does this expire?
 * - impact (0.30): How much does this matter?
 * - effort_inverse (0.15): Quick wins score higher
 * - signal_strength (0.15): How strong was the original signal?
 * - role_relevance (0.10): How relevant to this user's role?
 */
export function computePriorityScore({ timeSensitivity, impact, effortInverse, signalStrength, roleRelevance }) {
  const score = Math.round(
    timeSensitivity * 30 +
    impact * 30 +
    effortInverse * 15 +
    signalStrength * 15 +
    roleRelevance * 10
  );
  return Math.min(100, Math.max(0, score));
}

export function getPriorityTier(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Convert a listening hit into a task (if actionable).
 * Returns null if the hit shouldn't generate a task.
 */
export function listeningHitToTask(hit, topicName) {
  // FYI hits don't generate tasks
  const actionType = hit.actionType || inferActionType(hit);
  if (actionType === 'FYI') return null;

  // Map action type to task properties
  const taskTemplates = {
    RESPOND: {
      titlePrefix: 'Reply to',
      suggestedAction: 'Draft a response addressing their message',
      timeSensitivity: 0.8, // Replies are time-sensitive
      impact: 0.6,
      effortInverse: 0.8, // Quick action
    },
    CRISIS: {
      titlePrefix: 'Address',
      suggestedAction: 'Assess the situation and prepare a response strategy',
      timeSensitivity: 1.0, // Maximum urgency
      impact: 1.0,
      effortInverse: 0.4, // May require significant effort
    },
    OPPORTUNITY: {
      titlePrefix: 'Explore',
      suggestedAction: 'Evaluate if this is worth engaging with or creating content around',
      timeSensitivity: 0.4,
      impact: 0.5,
      effortInverse: 0.6,
    },
    INTEL: {
      titlePrefix: 'Review',
      suggestedAction: 'Catalog this competitive intelligence and assess strategic implications',
      timeSensitivity: 0.3,
      impact: 0.5,
      effortInverse: 0.7,
    },
  };

  const template = taskTemplates[actionType];
  if (!template) return null;

  const authorHandle = hit.platform === 'X'
    ? `@${hit.authorUsername}`
    : `u/${hit.authorUsername}`;

  const title = `${template.titlePrefix} ${authorHandle} — ${topicName}`;

  const priorityScore = computePriorityScore({
    timeSensitivity: template.timeSensitivity,
    impact: template.impact,
    effortInverse: template.effortInverse,
    signalStrength: Math.min(1, hit.heuristicScore / 0.8),
    roleRelevance: 0.7, // Default — Phase 15-02 adds role-specific scoring
  });

  return {
    title: title.slice(0, 200), // Keep titles reasonable
    description: hit.content?.slice(0, 500),
    sourceType: 'LISTENING',
    sourceId: hit.id,
    sourceUrl: hit.sourceUrl,
    actionType,
    suggestedAction: template.suggestedAction,
    priorityScore,
    priority: getPriorityTier(priorityScore),
    assignedRole: 'GENERAL', // Phase 15-02 adds role routing
    dueDate: actionType === 'CRISIS' ? new Date() : actionType === 'RESPOND' ? addDays(new Date(), 1) : addDays(new Date(), 7),
    context: {
      authorUsername: hit.authorUsername,
      authorFollowers: hit.authorFollowersOrKarma,
      platform: hit.platform,
      engagementCount: hit.engagementCount,
      sentiment: hit.sentiment,
      topicName,
      heuristicScore: hit.heuristicScore,
    },
  };
}

/**
 * Infer action type from hit properties when Phase 15 actionType isn't available yet.
 * This is the fallback for pre-Phase-15 data.
 */
function inferActionType(hit) {
  // Crisis: high-engagement negative sentiment
  if (hit.sentiment === 'NEGATIVE' && hit.engagementCount > 50) return 'CRISIS';
  if (hit.sentiment === 'NEGATIVE' && hit.heuristicScore > 0.6) return 'CRISIS';

  // Respond: questions or mentions with high relevance
  if (hit.content?.includes('?') && hit.aiRelevance === 'HIGH') return 'RESPOND';
  if (hit.isActionable) return 'RESPOND';

  // Opportunity: high-engagement positive mentions
  if (hit.sentiment === 'POSITIVE' && hit.engagementCount > 20) return 'OPPORTUNITY';

  // Intel: competitor topic hits
  // (We'd need topic type for this — default to FYI if unknown)
  if (hit.heuristicScore > 0.5) return 'INTEL';

  return 'FYI';
}

/**
 * Generate the Monday morning briefing.
 * Aggregates signals from the past 7 days and synthesizes with Claude Sonnet.
 */
export async function generateWeeklyBriefing(prisma, role = 'GENERAL') {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // 1. Gather listening signals from the past 7 days
  const recentHits = await prisma.listeningHit.findMany({
    where: {
      detectedAt: { gte: weekAgo },
      dismissed: false,
    },
    orderBy: { heuristicScore: 'desc' },
    take: 100,
    include: { topic: true },
  });

  // 2. Gather existing tasks
  const pendingTasks = await prisma.intelligenceTask.findMany({
    where: { status: 'PENDING' },
    orderBy: { priorityScore: 'desc' },
    take: 20,
  });

  // 3. Aggregate signal counts
  const signalCounts = {
    respond: recentHits.filter(h => (h.actionType || inferActionType(h)) === 'RESPOND').length,
    crisis: recentHits.filter(h => (h.actionType || inferActionType(h)) === 'CRISIS').length,
    opportunity: recentHits.filter(h => (h.actionType || inferActionType(h)) === 'OPPORTUNITY').length,
    intel: recentHits.filter(h => (h.actionType || inferActionType(h)) === 'INTEL').length,
    total: recentHits.length,
  };

  // 4. Get top hits for AI summarization
  const topHits = recentHits.slice(0, 30).map(h => ({
    content: h.content?.slice(0, 200),
    author: h.authorUsername,
    platform: h.platform,
    score: h.heuristicScore,
    sentiment: h.sentiment,
    actionType: h.actionType || inferActionType(h),
    topic: h.topic?.name,
    engagements: h.engagementCount,
  }));

  // 5. Generate AI briefing summary
  const briefingPrompt = `You are generating a Monday morning intelligence briefing for a VP of Marketing at a Nasdaq-listed fintech company (Figure Technology Solutions / FIGR).

Based on the past 7 days of social listening signals, generate a concise briefing with:

1. **Top 3-5 Priorities** — What needs attention this week? Be specific and actionable. Each priority should name the signal, explain why it matters, and suggest a next step.

2. **Signal Summary** — ${signalCounts.respond} items need replies, ${signalCounts.crisis} potential crisis signals, ${signalCounts.opportunity} opportunities, ${signalCounts.intel} competitive intel items.

3. **Key Themes** — What patterns or trends emerged across the signals?

Keep it tight — this person is a VP, not reading a novel. Every sentence should either inform a decision or prompt an action.

Top 30 signals from this week:
${JSON.stringify(topHits, null, 2)}

${pendingTasks.length > 0 ? `\nExisting pending tasks (${pendingTasks.length}): ${pendingTasks.slice(0, 5).map(t => t.title).join(', ')}` : ''}

Return a JSON object with: { summary (string, 2-3 sentences), topPriorities (array of {title, reason, suggestedAction, urgency}), themes (array of strings) }`;

  let briefingData;
  try {
    const result = await generateInsight('intelligence/weekly-briefing', briefingPrompt, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
      systemPrompt: 'You are an executive intelligence briefing assistant. Be concise, specific, and actionable. Return valid JSON.',
    });
    briefingData = JSON.parse(result);
  } catch (e) {
    // Fallback: generate a basic briefing without AI
    briefingData = {
      summary: `This week: ${signalCounts.total} signals detected. ${signalCounts.respond} need replies, ${signalCounts.crisis} crisis alerts, ${signalCounts.opportunity} opportunities.`,
      topPriorities: pendingTasks.slice(0, 5).map(t => ({
        title: t.title,
        reason: t.description,
        suggestedAction: t.suggestedAction,
        urgency: t.priority,
      })),
      themes: [],
    };
  }

  // 6. Store briefing
  const mondayOfWeek = getMonday(now);
  const briefing = await prisma.weeklyBriefing.upsert({
    where: { weekStart_role: { weekStart: mondayOfWeek, role } },
    update: {
      summary: briefingData.summary,
      topPriorities: briefingData.topPriorities,
      signalsSummary: signalCounts,
      generatedAt: now,
    },
    create: {
      weekStart: mondayOfWeek,
      role,
      summary: briefingData.summary,
      topPriorities: briefingData.topPriorities,
      signalsSummary: signalCounts,
    },
  });

  return briefing;
}

/**
 * Process new listening hits and auto-create tasks for actionable ones.
 * Call this at the end of each scan cycle.
 */
export async function processNewSignalsToTasks(prisma, newHits, topics) {
  const topicMap = new Map(topics.map(t => [t.id, t.name]));
  const tasksCreated = [];

  for (const hit of newHits) {
    const taskData = listeningHitToTask(hit, topicMap.get(hit.topicId) || 'Unknown');
    if (!taskData) continue;

    // Dedup: don't create duplicate tasks for the same source
    const existing = await prisma.intelligenceTask.findFirst({
      where: { sourceType: 'LISTENING', sourceId: hit.id },
    });
    if (existing) continue;

    const task = await prisma.intelligenceTask.create({ data: taskData });
    tasksCreated.push(task);
  }

  return tasksCreated;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
