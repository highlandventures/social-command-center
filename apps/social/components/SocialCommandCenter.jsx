'use client';
import { useState, useMemo } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ============================================================
// MOCK DATA
// ============================================================

const accounts = [
  { id: 1, handle: "@highland_vc", platform: "x", followers: 12400, followerDelta: 112, deltaPct: 8, impressions: 18200, engRate: 4.8, posts: 8, mentions: 54, avatar: "HV" },
  { id: 2, handle: "@highland_official", platform: "x", followers: 3100, followerDelta: 43, deltaPct: 3, impressions: 4100, engRate: 3.1, posts: 4, mentions: 12, avatar: "HO" },
  { id: 3, handle: "u/highland_ventures", platform: "reddit", followers: 890, followerDelta: 32, deltaPct: 15, impressions: 2000, engRate: 6.2, posts: 2, mentions: 23, avatar: "HV" },
];

const engagementData = Array.from({ length: 30 }, (_, i) => ({
  date: `Feb ${i + 1}`,
  engRate: +(2.5 + Math.random() * 4).toFixed(1),
  impressions: Math.floor(400 + Math.random() * 1200),
  engagements: Math.floor(20 + Math.random() * 80),
}));

const followerData = Array.from({ length: 30 }, (_, i) => ({
  date: `Feb ${i + 1}`,
  net: Math.floor(-5 + Math.random() * 25),
  total: 15500 + i * 6 + Math.floor(Math.random() * 10),
}));

const postScatterData = [
  { impressions: 2400, engRate: 6.2, engagements: 149, content: "Thread on AI deal sourcing tools...", type: "thread" },
  { impressions: 1800, engRate: 4.1, engagements: 74, content: "Hot take: most VCs are sleeping on...", type: "post" },
  { impressions: 3200, engRate: 7.8, engagements: 250, content: "Our portfolio company just raised...", type: "post" },
  { impressions: 900, engRate: 2.1, engagements: 19, content: "Interesting article on fintech trends", type: "link" },
  { impressions: 5100, engRate: 8.4, engagements: 428, content: "10 lessons from 50 failed pitches...", type: "thread" },
  { impressions: 1200, engRate: 3.5, engagements: 42, content: "Great conversation at TechCrunch...", type: "post" },
  { impressions: 400, engRate: 1.8, engagements: 7, content: "Check out this new report on...", type: "link" },
  { impressions: 2800, engRate: 5.9, engagements: 165, content: "Why we invested in [Company X]...", type: "thread" },
  { impressions: 600, engRate: 9.2, engagements: 55, content: "Unpopular opinion: seed stage...", type: "post" },
  { impressions: 1500, engRate: 4.8, engagements: 72, content: "AMA recap from r/venturecapital...", type: "reddit" },
];

const postPerformanceTable = [
  { content: "10 lessons from 50 failed pitches — a thread", platform: "x", type: "Thread", published: "Feb 28", impressions: 5100, engagements: 428, engRate: 8.4, clicks: 312, ctr: 6.1 },
  { content: "Our portfolio company just raised Series A", platform: "x", type: "Post", published: "Feb 25", impressions: 3200, engagements: 250, engRate: 7.8, clicks: 189, ctr: 5.9 },
  { content: "Why we invested in autonomous agents", platform: "x", type: "Thread", published: "Feb 22", impressions: 2800, engagements: 165, engRate: 5.9, clicks: 134, ctr: 4.8 },
  { content: "Thread on AI deal sourcing tools", platform: "x", type: "Thread", published: "Feb 20", impressions: 2400, engagements: 149, engRate: 6.2, clicks: 98, ctr: 4.1 },
  { content: "Hot take: most VCs are sleeping on AI", platform: "x", type: "Post", published: "Feb 18", impressions: 1800, engagements: 74, engRate: 4.1, clicks: 45, ctr: 2.5 },
  { content: "AMA recap from r/venturecapital", platform: "reddit", type: "Post", published: "Feb 15", impressions: 1500, engagements: 72, engRate: 4.8, clicks: 67, ctr: 4.5 },
  { content: "Fintech trends to watch in 2026", platform: "x", type: "Link", published: "Feb 12", impressions: 900, engagements: 19, engRate: 2.1, clicks: 88, ctr: 9.8 },
];

const heatmapData = (() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data = [];
  days.forEach((day, di) => {
    for (let h = 6; h <= 22; h++) {
      const peak = (h >= 8 && h <= 10) || (h >= 13 && h <= 15);
      const weekday = di < 5;
      const base = weekday ? (peak ? 5.5 : 2.5) : 1.5;
      data.push({ day, hour: h, engRate: +(base + Math.random() * 3).toFixed(1) });
    }
  });
  return data;
})();

// Listening data
const listeningTopics = [
  { id: 1, name: "AI Deal Sourcing", queries: 4, hits24h: 47, sentiment: 72, tier: "Hot" },
  { id: 2, name: "VC Portfolio Tools", queries: 3, hits24h: 18, sentiment: 65, tier: "Warm" },
  { id: 3, name: "Seed Stage Investing", queries: 2, hits24h: 8, sentiment: 58, tier: "Cool" },
];

const listeningFeed = [
  { id: 1, author: "@ai_startup_kate", followers: "23.4K", platform: "x", content: "Just tested 5 different AI deal sourcing tools for our fund. The accuracy gap between them is wild — some are genuinely useful, others are glorified search engines. Thread incoming.", relevance: "HIGH", sentiment: "positive", heuristic: 0.92, time: "12m ago", engagements: 89 },
  { id: 2, author: "u/vcpartner_anon", followers: "15.2K karma", platform: "reddit", subreddit: "r/venturecapital", content: "What AI tools are you all using for deal flow? We've been manually sourcing and it's killing us. Looking for something that actually integrates with our CRM.", relevance: "HIGH", sentiment: "neutral", heuristic: 0.88, time: "34m ago", engagements: 45 },
  { id: 3, author: "@techfund_daily", followers: "67.1K", platform: "x", content: "The future of VC is automated. AI agents will handle sourcing, diligence, and even initial outreach within 2 years. Hot take or reality?", relevance: "HIGH", sentiment: "positive", heuristic: 0.85, time: "1h ago", engagements: 234 },
  { id: 4, author: "@random_dev", followers: "1.2K", platform: "x", content: "Built a small AI agent that scrapes AngelList and generates deal memos. It's rough but saving us 10hrs/week.", relevance: "MEDIUM", sentiment: "positive", heuristic: 0.71, time: "2h ago", engagements: 12 },
  { id: 5, author: "u/ml_engineer_2025", followers: "8.1K karma", platform: "reddit", subreddit: "r/startups", content: "Honestly the 'AI for VC' space is overhyped. Most of these tools are just fancy wrappers around GPT with a CRM integration.", relevance: "MEDIUM", sentiment: "negative", heuristic: 0.65, time: "3h ago", engagements: 67 },
  { id: 6, author: "@crypto_vc_bro", followers: "45K", platform: "x", content: "AI deal sourcing is the new hot thing but I'm not seeing real ROI yet. Anyone have actual numbers?", relevance: "MEDIUM", sentiment: "neutral", heuristic: 0.62, time: "4h ago", engagements: 156 },
];

const sovData = [
  { name: "Highland Ventures", value: 34, color: "#3b82f6", mentions: 312, sentiment: 72, avgEng: 4.8, growth: 187 },
  { name: "Competitor A", value: 28, color: "#ef4444", mentions: 256, sentiment: 61, avgEng: 3.2, growth: 94 },
  { name: "Competitor B", value: 22, color: "#f59e0b", mentions: 201, sentiment: 58, avgEng: 2.9, growth: 63 },
  { name: "Unattributed", value: 16, color: "#6b7280", mentions: 146, sentiment: null, avgEng: null, growth: null },
];

const sovTimeData = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  Highland: 28 + Math.floor(Math.random() * 12),
  "Competitor A": 22 + Math.floor(Math.random() * 12),
  "Competitor B": 16 + Math.floor(Math.random() * 10),
}));

const sentimentTrendData = Array.from({ length: 14 }, (_, i) => ({
  date: `Feb ${i * 2 + 1}`,
  positive: 55 + Math.floor(Math.random() * 25),
  neutral: 15 + Math.floor(Math.random() * 15),
  negative: 5 + Math.floor(Math.random() * 12),
}));

// Brand sentiment data
const brandSentimentOverTime = Array.from({ length: 30 }, (_, i) => ({
  date: `${i < 28 ? "Feb" : "Mar"} ${i < 28 ? i + 1 : i - 27}`,
  positive: 58 + Math.floor(Math.sin(i / 5) * 12 + Math.random() * 8),
  neutral: 22 + Math.floor(Math.random() * 8),
  negative: 8 + Math.floor(Math.cos(i / 3) * 5 + Math.random() * 4),
  score: +(68 + Math.sin(i / 5) * 8 + Math.random() * 4).toFixed(1),
}));

const brandSentimentByPlatform = [
  { platform: "x", positive: 64, neutral: 24, negative: 12, score: 72.4, change: 3.2 },
  { platform: "reddit", positive: 51, neutral: 30, negative: 19, score: 61.8, change: -1.4 },
];

const brandSentimentDrivers = [
  { theme: "Product Innovation", sentiment: 82, volume: 89, trend: "up", topKeyword: "AI-powered", impact: "high" },
  { theme: "Customer Support", sentiment: 45, volume: 34, trend: "down", topKeyword: "response time", impact: "high" },
  { theme: "Thought Leadership", sentiment: 78, volume: 67, trend: "up", topKeyword: "VC insights", impact: "medium" },
  { theme: "Brand Voice & Tone", sentiment: 71, volume: 23, trend: "stable", topKeyword: "authentic", impact: "low" },
  { theme: "Deal Flow Quality", sentiment: 68, volume: 45, trend: "up", topKeyword: "portfolio wins", impact: "medium" },
];

const sentimentAlerts = [
  { type: "spike", message: "Negative sentiment spike on Reddit (r/startups) — 3 posts criticizing response times", time: "2h ago", severity: "warning" },
  { type: "milestone", message: "Brand sentiment score crossed 70+ for 7 consecutive days on X", time: "1d ago", severity: "positive" },
];

// KOL data
const kols = [
  { id: 1, name: "Sarah Chen", handle: "@techVC_sarah", platform: "x", followers: "45.2K", type: "Paid Partner", cohort: "Q1 2026 Campaign", comp: "$2,000/mo", activations: 8, avgEng: 6.2, impressions: "22.4K", sentiment: 89, score: "A", scoreLabel: "High Value", trend: "up", correlation: 0.72, avatar: "SC" },
  { id: 2, name: "Mike Rodriguez", handle: "@founder_mike", platform: "x", followers: "12.1K", type: "Portfolio Founder", cohort: "Always-On Advocates", comp: "—", activations: 3, avgEng: 4.1, impressions: "3.7K", sentiment: 72, score: "B", scoreLabel: "Moderate", trend: "stable", correlation: 0.41, avatar: "MR" },
  { id: 3, name: "Dan Crypto", handle: "u/crypto_dan", platform: "reddit", followers: "8.4K karma", type: "Organic Advocate", cohort: "Always-On Advocates", comp: "—", activations: 5, avgEng: 12, impressions: "1.8K", sentiment: 65, score: "C", scoreLabel: "Under Review", trend: "down", correlation: 0.28, avatar: "DC" },
  { id: 4, name: "AI Influencer Pro", handle: "@ai_influencer", platform: "x", followers: "120K", type: "Paid Partner", cohort: "Q1 2026 Campaign", comp: "$5,000/mo", activations: 1, avgEng: 0.8, impressions: "960", sentiment: 50, score: "D", scoreLabel: "Not Worth It", trend: "down", correlation: 0.05, avatar: "AI" },
  { id: 5, name: "Jenny Kapoor", handle: "@jenny_vc", platform: "x", followers: "28.7K", type: "Advisor", cohort: "Always-On Advocates", comp: "—", activations: 6, avgEng: 5.4, impressions: "14.2K", sentiment: 82, score: "A", scoreLabel: "High Value", trend: "up", correlation: 0.65, avatar: "JK" },
];

const kolActivations = [
  { kol: "@techVC_sarah", content: "Just had an incredible session with the @highland_vc team on AI-native deal sourcing. The future of VC is here.", type: "Direct mention", time: "2h ago", engagements: 342, impressions: "4.8K" },
  { kol: "@techVC_sarah", content: "Thread: Why I think AI will reshape venture capital in 3 fundamental ways...", type: "Thread (brand topic)", time: "2d ago", engagements: 891, impressions: "12.1K" },
  { kol: "@jenny_vc", content: "RT @highland_vc: 10 lessons from 50 failed pitches — a thread", type: "Retweet", time: "3d ago", engagements: 156, impressions: "3.2K" },
  { kol: "@founder_mike", content: "Grateful for @highland_vc backing us early. Their AI sourcing found us before anyone else.", type: "Direct mention", time: "5d ago", engagements: 89, impressions: "1.4K" },
  { kol: "u/crypto_dan", content: "Posted a deep dive in r/venturecapital about AI tools for deal flow — mentioned Highland's approach", type: "Subreddit post", time: "1w ago", engagements: 34, impressions: "890" },
];

const kolPerformanceData = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  activations: Math.floor(1 + Math.random() * 5),
  avgEng: +(2 + Math.random() * 6).toFixed(1),
  impressions: Math.floor(2000 + Math.random() * 8000),
}));

const kolDiscoverySuggestions = [
  { handle: "u/data_scientist_jane", platform: "reddit", followers: "12.8K karma", hits: 6, avgUpvotes: 45, sentiment: 78, topic: "AI-driven VC tools" },
  { handle: "@vc_techie_tom", platform: "x", followers: "34.5K", hits: 4, avgEng: "5.2%", sentiment: 81, topic: "Deal sourcing automation" },
];

// ============================================================
// UTILITY COMPONENTS
// ============================================================

const COLORS = { blue: "#3b82f6", green: "#22c55e", red: "#ef4444", amber: "#f59e0b", gray: "#6b7280", purple: "#8b5cf6", cyan: "#06b6d4", indigo: "#6366f1" };

const PlatformBadge = ({ platform }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${platform === "x" ? "bg-gray-900 text-white" : "bg-orange-100 text-orange-800"}`}>
    {platform === "x" ? "𝕏" : "Reddit"}
  </span>
);

const RelevanceBadge = ({ level }) => {
  const styles = { HIGH: "bg-green-100 text-green-800", MEDIUM: "bg-yellow-100 text-yellow-800", LOW: "bg-gray-100 text-gray-600" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[level] || styles.LOW}`}>{level}</span>;
};

const SentimentDot = ({ sentiment }) => {
  const color = sentiment === "positive" ? "bg-green-400" : sentiment === "negative" ? "bg-red-400" : "bg-gray-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
};

const ScoreBadge = ({ score }) => {
  const styles = { A: "bg-green-100 text-green-800 border-green-300", B: "bg-blue-100 text-blue-800 border-blue-300", C: "bg-yellow-100 text-yellow-800 border-yellow-300", D: "bg-red-100 text-red-800 border-red-300", F: "bg-red-200 text-red-900 border-red-400" };
  return <span className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${styles[score] || styles.C}`}>{score}</span>;
};

const TrendArrow = ({ trend, direction }) => {
  const d = trend || direction;
  if (d === "up") return <span className="text-green-500 text-sm">↑</span>;
  if (d === "down") return <span className="text-red-500 text-sm">↓</span>;
  return <span className="text-gray-400 text-sm">→</span>;
};

const DeltaBadge = ({ value, pct, invert = false }) => {
  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span className={`text-sm font-medium ${isGood ? "text-green-600" : "text-red-500"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
};

const MetricCard = ({ label, value, delta, deltaLabel }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {delta !== undefined && (
      <p className="mt-1.5">
        <span className={`text-sm font-medium ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% {deltaLabel || "WoW"}
        </span>
      </p>
    )}
  </div>
);

const SectionTitle = ({ children, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-gray-900">{children}</h3>
    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

const TabButton = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
  >
    {children}
    {badge && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>}
  </button>
);

const Avatar = ({ initials, platform, size = "md" }) => {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white ${platform === "reddit" ? "bg-orange-500" : "bg-gray-800"}`}>
      {initials}
    </div>
  );
};

const Sparkline = ({ data, color = "#3b82f6", height = 24 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={w} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

// ============================================================
// COMPOSER + CALENDAR TABS
// ============================================================

const drafts = [
  { id: 1, content: "Why most AI sourcing tools fail at founder quality assessment...", status: "draft", platform: "x", account: "@highland_vc", type: "thread", tweets: 5, created: "2h ago" },
  { id: 2, content: "Excited to announce our latest portfolio addition", status: "draft", platform: "x", account: "@highland_official", type: "post", tweets: 1, created: "1d ago" },
];

const scheduledPosts = [
  { id: 1, content: "Thread: 7 signals we look for in seed-stage founders that most VCs miss", platform: "x", account: "@highland_vc", type: "thread", tweets: 7, scheduledFor: "Mar 5, 9:15am EST", status: "scheduled" },
  { id: 2, content: "Our take on the latest AI regulation proposals and what it means for startups", platform: "x", account: "@highland_vc", type: "post", tweets: 1, scheduledFor: "Mar 6, 1:00pm EST", status: "scheduled" },
  { id: 3, content: "Deep dive: How we use AI internally for deal flow — an honest review", platform: "reddit", account: "u/highland_ventures", type: "post", subreddit: "r/venturecapital", scheduledFor: "Mar 7, 10:00am EST", status: "scheduled" },
  { id: 4, content: "Portfolio spotlight: How [Company] grew 10x in 12 months", platform: "x", account: "@highland_official", type: "thread", tweets: 4, scheduledFor: "Mar 8, 11:30am EST", status: "scheduled" },
];

const calendarDays = (() => {
  const days = [];
  const postMap = {
    5: [{ type: "thread", platform: "x", label: "7 signals in founders", time: "9:15am", status: "scheduled" }],
    6: [{ type: "post", platform: "x", label: "AI regulation take", time: "1:00pm", status: "scheduled" }],
    7: [{ type: "post", platform: "reddit", label: "AI for deal flow", time: "10:00am", status: "scheduled" }],
    8: [{ type: "thread", platform: "x", label: "Portfolio spotlight", time: "11:30am", status: "scheduled" }],
    1: [{ type: "thread", platform: "x", label: "10 lessons from pitches", time: "9:00am", status: "published" }],
    2: [{ type: "post", platform: "x", label: "Hot take: seed stage", time: "2:00pm", status: "published" }],
    10: [{ type: "ghost", platform: "x", label: "AI suggestion: LP reporting thread", time: "9:15am" }],
    12: [{ type: "ghost", platform: "reddit", label: "AI suggestion: Founder story", time: "10:00am" }],
  };
  for (let d = 1; d <= 31; d++) {
    days.push({ day: d, posts: postMap[d] || [], isToday: d === 4 });
  }
  return days;
})();

const ComposerTab = () => {
  const [selectedPlatform, setSelectedPlatform] = useState("x");
  const [postMode, setPostMode] = useState("thread"); // "single" | "thread" | "article"
  const [selectedAccount, setSelectedAccount] = useState("@highland_vc");
  const [articleTitle, setArticleTitle] = useState("Why Pattern Matching is Broken: 7 Signals We Look For Instead");
  const [articleBody, setArticleBody] = useState("Most VCs evaluate founders on pattern matching. Here's why that's broken — and what we've learned works better after 200+ deals.\n\n## Signal 1: Founder-Market Obsession\n\nWe don't ask \"do you know this space?\" We ask \"what's the thing about this problem that keeps you up at night that nobody else sees?\"\n\nThe best founders have an almost irrational depth of insight into their specific wedge. They've lived this problem. They can tell you the 12 things that everyone gets wrong about the market — off the top of their head, with receipts.\n\n## Signal 2: Speed of Learning\n\nWe track how quickly a founder iterates on feedback between our conversations. If they've meaningfully evolved their pitch/product between meeting 1 and meeting 2 (usually 1-2 weeks), that's a stronger signal than 10 years in industry.\n\nThis matters because the startup journey is fundamentally a learning speed competition. The market is going to throw curveballs. The founders who adapt fastest win.\n\n## Signal 3: Customer Conversations > TAM Slides\n\nShow us 5 real customer conversations with quotes. That's worth more than any McKinsey market sizing.\n\nThe founders who close us fastest always lead with customer evidence, not market size. They know their customers by name.");
  const [tweets, setTweets] = useState([
    "Most VCs evaluate founders on pattern matching. Here's why that's broken — and 7 signals we look for instead.\n\nA thread 🧵",
    "Signal 1: Founder-market obsession, not just fit.\n\nWe don't ask \"do you know this space?\" We ask \"what's the thing about this problem that keeps you up at night that nobody else sees?\"\n\nThe best founders have an almost irrational depth of insight into their specific wedge.",
    "Signal 2: Speed of learning, not years of experience.\n\nWe track how quickly a founder iterates on feedback between our conversations. If they've meaningfully evolved their pitch/product between meeting 1 and meeting 2 (usually 1-2 weeks), that's a stronger signal than 10 years in industry.",
    "Signal 3: Customer conversations > TAM slides.\n\nShow us 5 real customer conversations with quotes. That's worth more than any McKinsey market sizing.\n\nThe founders who close us fastest always lead with customer evidence, not market size.",
    "Signal 4: Hiring taste.\n\nWho are the first 3-5 people they'd hire? How specific can they get? Do they know these people by name?\n\nGreat founders have been mentally building their team for months before they even start fundraising.",
  ]);
  const [scheduleDate, setScheduleDate] = useState("2026-03-05");
  const [scheduleTime, setScheduleTime] = useState("09:15");
  const [sidebarTab, setSidebarTab] = useState("drafts");

  const charLimit = postMode === "article" ? 25000 : 280;
  const activeTweets = tweets.filter(t => (t || "").trim());
  const isThread = postMode === "thread";

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 160px)", minHeight: "600px" }}>
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mr-auto flex-wrap">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {[{ key: "x", label: "𝕏" }, { key: "reddit", label: "Reddit" }].map(p => (
              <button key={p.key} onClick={() => { setSelectedPlatform(p.key); if (p.key === "reddit") setPostMode("single"); }} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedPlatform === p.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>{p.label}</button>
            ))}
          </div>
          <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
            {accounts.filter(a => a.platform === selectedPlatform).map(a => <option key={a.id} value={a.handle}>{a.handle}</option>)}
          </select>
          {selectedPlatform === "x" && (
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {[
                { key: "single", label: "Post" },
                { key: "thread", label: `Thread (${activeTweets.length})` },
                { key: "article", label: "Article" },
              ].map(m => (
                <button key={m.key} onClick={() => setPostMode(m.key)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${postMode === m.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  {m.key === "thread" ? "🧵 " : m.key === "article" ? "📝 " : ""}{m.label}
                </button>
              ))}
            </div>
          )}
          {postMode === "article" && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">Premium+ required</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Save Draft</button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2.5 py-1.5">
            <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="text-xs bg-transparent border-none outline-none w-[110px]" />
            <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="text-xs bg-transparent border-none outline-none w-[65px]" />
          </div>
          <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">Schedule</button>
          <button className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 font-medium">Publish Now</button>
        </div>
      </div>

      {/* Main content: editor | preview | sidebar */}
      <div className="flex-1 min-h-0 grid gap-4" style={{ gridTemplateColumns: "minmax(300px, 1fr) minmax(320px, 1fr) minmax(200px, 260px)" }}>

        {/* COLUMN 1: Editor */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Compose</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
            {/* Thread editor */}
            {postMode === "thread" && selectedPlatform === "x" && (
              <div className="space-y-2.5">
                {tweets.map((tweet, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-medium">{i + 1}/{tweets.length}</span>
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Hook</span>}
                        {i === tweets.length - 1 && tweets.length > 1 && <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">CTA</span>}
                      </div>
                      <span className={`text-[10px] font-medium tabular-nums ${tweet.length > 280 ? "text-red-500" : tweet.length > 252 ? "text-amber-500" : "text-gray-300"}`}>{tweet.length}/280</span>
                    </div>
                    <textarea
                      value={tweet}
                      onChange={e => { const t = [...tweets]; t[i] = e.target.value; setTweets(t); }}
                      className="w-full text-[13px] text-gray-800 border-none outline-none resize-none leading-relaxed"
                      style={{ minHeight: Math.max(60, Math.min(140, tweet.length / 2)) + "px" }}
                      placeholder={i === 0 ? "Hook — grab attention..." : i === tweets.length - 1 ? "CTA — what should they do?" : "Continue the thread..."}
                    />
                    {tweet.length > 280 && <div className="mt-1 text-[10px] text-red-500 bg-red-50 rounded px-2 py-0.5 inline-block">+{tweet.length - 280} over limit</div>}
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
                      <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">📷</button>
                      <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">🔗</button>
                      <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">✨ AI</button>
                      <div className="flex-1" />
                      {tweets.length > 1 && <button onClick={() => setTweets(tweets.filter((_, j) => j !== i))} className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>}
                    </div>
                  </div>
                ))}
                <button onClick={() => setTweets([...tweets, ""])} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">+ Add tweet</button>
              </div>
            )}

            {/* Article editor */}
            {postMode === "article" && selectedPlatform === "x" && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col h-full">
                <input
                  value={articleTitle}
                  onChange={e => setArticleTitle(e.target.value)}
                  className="w-full text-lg font-bold text-gray-900 border-none outline-none mb-1 placeholder-gray-300"
                  placeholder="Article title..."
                />
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <span className="text-[10px] text-gray-400">{articleBody.length.toLocaleString()}/25,000</span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-[10px] text-gray-400">~{Math.ceil(articleBody.split(/\s+/).length / 200)} min read</span>
                  <div className="flex-1" />
                  <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">📷 Cover image</button>
                  <button className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">B I H1 H2</button>
                </div>
                <textarea
                  value={articleBody}
                  onChange={e => setArticleBody(e.target.value)}
                  className="w-full flex-1 text-[13px] text-gray-800 border-none outline-none resize-none leading-relaxed min-h-[300px]"
                  placeholder="Write your article... Markdown supported (## headings, **bold**, *italic*, lists)"
                />
              </div>
            )}

            {/* Single post (X or Reddit) */}
            {(postMode === "single" || selectedPlatform === "reddit") && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 font-medium">{selectedPlatform === "reddit" ? "Post body (Markdown)" : "Post"}</span>
                  {selectedPlatform === "x" && <span className="text-[10px] text-gray-400">{tweets[0]?.length || 0}/280</span>}
                </div>
                {selectedPlatform === "reddit" && (
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"><option>r/venturecapital</option><option>r/startups</option><option>r/artificial</option></select>
                    <input placeholder="Post title..." className="flex-1 min-w-[100px] text-xs border border-gray-200 rounded-lg px-2 py-1" />
                    <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"><option>Text</option><option>Link</option><option>Image</option><option>Poll</option></select>
                  </div>
                )}
                <textarea
                  value={tweets[0]}
                  onChange={e => setTweets([e.target.value])}
                  className="w-full flex-1 text-[13px] text-gray-800 border-none outline-none resize-none leading-relaxed min-h-[200px]"
                  placeholder={selectedPlatform === "reddit" ? "Write your post (Markdown)..." : "What's happening?"}
                />
              </div>
            )}

            {/* AI + Performance row */}
            <div className="mt-3 space-y-2">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 mt-0.5">AI</div>
                  <div>
                    <p className="text-[10px] font-semibold text-blue-900 mb-0.5">Content Suggestion</p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      {postMode === "article"
                        ? `Articles with 800-1,500 words get the most engagement. You're at ~${articleBody.split(/\s+/).length} words. Add a compelling hook in the first paragraph — articles that open with a bold claim get 3x more reads. Consider adding subheadings every 200-300 words.`
                        : `Your educational threads average 7.4% engagement — 2.3x higher than single posts. This thread has ${activeTweets.length} tweets (optimal: 5-7). Threads with CTAs get 40% more replies.`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-2.5">
                <p className="text-[11px] text-green-800">
                  <strong>Best slot:</strong> Tue 9:15am (8.2% eng). You're set for Wed (5.1%). <button className="text-green-700 underline font-medium">Switch?</button>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Single unified preview */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Preview</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
            {selectedPlatform === "x" && postMode === "article" ? (
              /* X Article preview */
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: "#000", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    <span className="text-white text-[10px] font-medium">Article</span>
                  </div>
                  <span className="text-[10px] text-gray-500">~{Math.ceil(articleBody.split(/\s+/).length / 200)} min read</span>
                </div>
                {/* Cover image placeholder */}
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
                        <svg viewBox="0 0 22 22" className="w-[14px] h-[14px]" style={{ fill: "#1d9bf0" }}><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.223 1.261.272 1.894.14.633-.132 1.217-.438 1.684-.883.447-.468.752-1.054.883-1.69.132-.634.085-1.294-.138-1.9.586-.272 1.084-.703 1.438-1.241.355-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" /></svg>
                      </div>
                      <span className="text-[11px] text-gray-500">{selectedAccount} · now</span>
                    </div>
                  </div>
                  <h1 className="text-xl font-bold text-white leading-tight mb-4">{articleTitle || "Untitled Article"}</h1>
                  <div className="text-[13px] text-gray-300 leading-[1.7] whitespace-pre-wrap break-words">
                    {articleBody.split("\n").map((line, li) => {
                      if (line.startsWith("## ")) return <h2 key={li} className="text-base font-bold text-white mt-4 mb-2">{line.slice(3)}</h2>;
                      if (line.startsWith("# ")) return <h1 key={li} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>;
                      if (line.trim() === "") return <br key={li} />;
                      return <p key={li} className="mb-2">{line}</p>;
                    })}
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-gray-500">
                  {["💬", "🔁", "❤️", "📊", "↗"].map((e, j) => <span key={j} className="text-sm cursor-pointer hover:text-gray-300">{e}</span>)}
                </div>
              </div>
            ) : selectedPlatform === "x" ? (
              /* X Post / Thread preview — single unified view */
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: "#000", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    <span className="text-white text-[10px] font-medium">{isThread ? "Thread" : "Post"}</span>
                  </div>
                  {isThread && <span className="text-[10px] text-gray-500">{activeTweets.length} posts</span>}
                </div>
                <div>
                  {(isThread ? tweets : [tweets[0] || ""]).filter(t => t !== undefined).map((tweet, i, arr) => {
                    const isLast = i === arr.filter(t => (t || "").trim()).length - 1;
                    const tweetText = tweet || "";
                    return (
                      <div key={i} className={`px-3 pt-2.5 ${isLast ? "pb-1" : "pb-0"} ${i > 0 ? "border-t border-gray-800/50" : ""}`}>
                        <div className="flex gap-2.5">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                              <span className="text-white text-[10px] font-bold">HV</span>
                            </div>
                            {isThread && !isLast && tweetText.trim() && <div className="w-0.5 flex-1 bg-gray-700 mt-1 min-h-[6px]" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-2.5">
                            <div className="flex items-center gap-1 leading-tight flex-wrap">
                              <span className="text-[13px] font-bold text-white">Highland Ventures</span>
                              <svg viewBox="0 0 22 22" className="w-[14px] h-[14px] flex-shrink-0" style={{ fill: "#1d9bf0" }}><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.141.27.587.7 1.086 1.24 1.44.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.223 1.261.272 1.894.14.633-.132 1.217-.438 1.684-.883.447-.468.752-1.054.883-1.69.132-.634.085-1.294-.138-1.9.586-.272 1.084-.703 1.438-1.241.355-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" /></svg>
                              <span className="text-[13px] text-gray-500">{selectedAccount} · now</span>
                            </div>
                            <div className="mt-0.5">
                              {tweetText.trim() ? <p className="text-[13px] text-white leading-[1.4] whitespace-pre-wrap break-words">{tweetText}</p> : <p className="text-[13px] text-gray-600 italic">Start typing...</p>}
                            </div>
                            {tweetText.length > 280 && (
                              <div className="mt-1 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5 inline-block">
                                <span className="text-[10px] text-red-400 font-medium">+{tweetText.length - 280} over limit</span>
                              </div>
                            )}
                            <div className="flex items-center gap-5 mt-2 text-gray-600">
                              {["💬", "🔁", "❤️", "📊"].map((e, j) => <span key={j} className="text-[11px] cursor-pointer hover:text-gray-400">{e}</span>)}
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
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-blue-400"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21v-5.5h2V21H4z"/></svg>
                    <span className="text-[10px] text-gray-400 font-medium">Predicted</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: "Impressions", value: isThread ? "~18-24K" : "~5-8K", good: true },
                      { label: "Engagements", value: isThread ? "~850-1.2K" : "~200-400", good: true },
                      { label: "Eng. Rate", value: isThread ? "~6.2-7.8%" : "~3.5-4.5%", good: true },
                      { label: "Clicks", value: isThread ? "~120-200" : "~40-80", good: false },
                    ].map((p, k) => (
                      <div key={k} className="text-center">
                        <div className={`text-[11px] font-semibold ${p.good ? "text-green-400" : "text-gray-400"}`}>{p.value}</div>
                        <div className="text-[9px] text-gray-600">{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Reddit preview */
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: "#1a1a1b", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[#343536]" style={{ background: "#1a1a1b" }}>
                  <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#FF4500]"><path d="M16.5 8c-.02-1.13-.94-2.04-2.07-2.02-.55.01-1.07.24-1.46.63-.97-.67-2.14-1.06-3.37-1.12l.61-2.84 1.98.42c.02.78.66 1.4 1.44 1.38.79-.02 1.42-.67 1.4-1.46-.02-.78-.67-1.4-1.46-1.38-.53.01-1.01.3-1.24.76L10.2 2l-.73 3.47c-1.28.04-2.5.44-3.51 1.13-.89-.88-2.33-.87-3.21.02-.88.89-.87 2.33.02 3.21-.16.47-.24.96-.24 1.46 0 3.36 3.38 6.08 7.54 6.08s7.54-2.72 7.54-6.08c0-.48-.08-.96-.23-1.42.47-.43.75-1.04.74-1.68H16.5zM6.82 11.07c0-.78.64-1.42 1.42-1.42.79 0 1.43.64 1.43 1.42 0 .79-.64 1.43-1.43 1.43-.78 0-1.42-.64-1.42-1.43zm6.48 3.27c-.85.63-1.9.95-2.97.91-1.08.04-2.13-.28-2.99-.91-.12-.1-.14-.28-.04-.4.1-.12.28-.14.4-.04.74.54 1.63.82 2.54.79.94.03 1.86-.25 2.63-.79.12-.08.28-.05.36.07.08.12.05.28-.07.36l.14.01zm-.18-1.84c-.79 0-1.43-.64-1.43-1.43 0-.78.64-1.42 1.43-1.42.78 0 1.42.64 1.42 1.42 0 .79-.64 1.43-1.42 1.43z"/></svg>
                  <span className="text-[#D7DADC] text-xs font-medium">Reddit Preview</span>
                </div>
                <div className="flex" style={{ background: "#1a1a1b" }}>
                  <div className="flex flex-col items-center gap-0.5 px-2.5 py-3" style={{ background: "#161617" }}>
                    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#818384] hover:fill-[#FF4500] cursor-pointer"><path d="M12.877 19H7.123A1.125 1.125 0 016 17.877V11H2.126a1.114 1.114 0 01-1.007-.7 1.249 1.249 0 01.171-1.343L9.166.368a1.128 1.128 0 011.668.004l7.872 8.581a1.252 1.252 0 01.176 1.348 1.114 1.114 0 01-1.005.7H14v6.877A1.125 1.125 0 0112.877 19z"/></svg>
                    <span className="text-xs font-bold text-[#D7DADC]">1</span>
                    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-[#818384] hover:fill-[#7193FF] cursor-pointer"><path d="M7.123 1h5.754A1.125 1.125 0 0114 2.123V9h3.874a1.114 1.114 0 011.007.7 1.249 1.249 0 01-.171 1.343l-7.872 8.589a1.128 1.128 0 01-1.668-.004L1.29 11.04a1.252 1.252 0 01-.176-1.348A1.114 1.114 0 012.126 9H6V2.123A1.125 1.125 0 017.123 1z"/></svg>
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2 text-[11px]">
                      <div className="w-5 h-5 rounded-full bg-[#FF4500] flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">r/</span>
                      </div>
                      <span className="font-bold text-[#D7DADC]">r/venturecapital</span>
                      <span className="text-[#818384]">· Posted by u/highland_ventures · now</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#D7DADC] mb-2 leading-snug">{tweets[0]?.split("\n")[0]?.slice(0, 80) || "Post title here"}</h3>
                    <div className="text-[13px] text-[#D7DADC]/80 leading-relaxed whitespace-pre-wrap break-words">
                      {tweets[0] || <span className="text-[#818384] italic">Start typing...</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-2 border-t border-[#343536] text-[11px] text-[#818384] font-bold">
                      <span className="flex items-center gap-1 hover:bg-[#343536] px-2 py-1 rounded cursor-pointer">
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current"><path d="M7.725 19.872a.718.718 0 01-.607-.328.725.725 0 01-.118-.397V13H1.5A1.5 1.5 0 010 11.5v-9A1.5 1.5 0 011.5 1h17A1.5 1.5 0 0120 2.5v9a1.5 1.5 0 01-1.5 1.5h-5.263l-4.874 6.61a.72.72 0 01-.638.262z"/></svg>
                        0 Comments
                      </span>
                      <span className="flex items-center gap-1 hover:bg-[#343536] px-2 py-1 rounded cursor-pointer">
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current"><path d="M5 9a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2zM1.5 0h17A1.5 1.5 0 0120 1.5v17a1.5 1.5 0 01-1.5 1.5h-17A1.5 1.5 0 010 18.5v-17A1.5 1.5 0 011.5 0z"/></svg>
                        Share
                      </span>
                      <span className="flex items-center gap-1 hover:bg-[#343536] px-2 py-1 rounded cursor-pointer">
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current"><path d="M3 17.5v-15l7 7.5-7 7.5zm14 0v-15l-7 7.5 7 7.5z"/></svg>
                        Save
                      </span>
                    </div>
                  </div>
                </div>
                {/* Predicted performance — Reddit */}
                <div className="px-3 py-2.5 border-t border-[#343536]" style={{ background: "#161617" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-[#818384] font-medium">📊 Predicted Performance</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: "Upvotes", value: "~15-40", good: true },
                      { label: "Comments", value: "~5-12", good: true },
                      { label: "Upvote Ratio", value: "~85-92%", good: true },
                      { label: "Cross-posts", value: "~1-3", good: false },
                    ].map((p, k) => (
                      <div key={k} className="text-center">
                        <div className={`text-[11px] font-semibold ${p.good ? "text-[#FF4500]" : "text-[#818384]"}`}>{p.value}</div>
                        <div className="text-[9px] text-[#818384]">{p.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: Sidebar — Drafts & Queue */}
        <div className="flex flex-col min-h-0 border-l border-gray-200 pl-4">
          <div className="flex items-center gap-0.5 mb-2 bg-gray-100 rounded-lg p-0.5">
            {[{ key: "drafts", label: "Drafts", count: drafts.length }, { key: "queue", label: "Queue", count: scheduledPosts.length }].map(t => (
              <button key={t.key} onClick={() => setSidebarTab(t.key)} className={`flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${sidebarTab === t.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {sidebarTab === "drafts" ? (
              <div className="space-y-1.5">
                {drafts.map(d => (
                  <div key={d.id} className="p-2.5 bg-white rounded-lg border border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group">
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformBadge platform={d.platform} />
                      {d.type === "thread" && <span className="text-[10px] text-blue-600 font-medium">{d.tweets} tweets</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{d.created}</span>
                    </div>
                    <p className="text-[11px] text-gray-700 leading-snug line-clamp-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {d.content}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-[10px] text-blue-600 font-medium">Edit</button>
                      <span className="text-gray-300">·</span>
                      <button className="text-[10px] text-red-500 font-medium">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {scheduledPosts.map(p => (
                  <div key={p.id} className="p-2.5 bg-white rounded-lg border border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors group">
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformBadge platform={p.platform} />
                      {p.type === "thread" && <span className="text-[10px] text-blue-600 font-medium">{p.tweets} tweets</span>}
                    </div>
                    <p className="text-[11px] text-gray-700 leading-snug line-clamp-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.content}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span>🕐</span> {p.scheduledFor}
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
};

const CalendarTab = () => {
  const [view, setView] = useState("month");
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // March 2026 starts on Sunday (index 6), pad accordingly
  const startPad = 6; // Sunday = 6 cells of padding (Mon-start calendar)

  const postColors = { scheduled: "bg-blue-100 border-blue-200 text-blue-800", published: "bg-green-100 border-green-200 text-green-800", ghost: "bg-gray-50 border-dashed border-gray-300 text-gray-500" };
  const platformDot = { x: "bg-gray-800", reddit: "bg-orange-500" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">March 2026</h2>
          <div className="flex items-center gap-1">
            <button className="p-1 text-gray-400 hover:text-gray-600">←</button>
            <button className="p-1 text-gray-400 hover:text-gray-600">→</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["month", "week", "list"].map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${view === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{v}</button>
          ))}
          <div className="flex items-center gap-2 ml-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-200 border border-blue-300" />Scheduled</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-200 border border-green-300" />Published</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-100 border border-dashed border-gray-300" />AI Suggestion</span>
          </div>
        </div>
      </div>

      {view === "month" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {daysOfWeek.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Padding for days before March 1 */}
            {Array.from({ length: startPad }, (_, i) => (
              <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50" />
            ))}
            {calendarDays.map(day => (
              <div key={day.day} className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${day.isToday ? "bg-blue-50/50" : "hover:bg-gray-50"} transition-colors`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${day.isToday ? "bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center" : "text-gray-500"}`}>{day.day}</span>
                  {/* Optimal time indicator */}
                  {(day.day === 3 || day.day === 10 || day.day === 17 || day.day === 24) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300" title="Optimal posting day" />
                  )}
                </div>
                <div className="space-y-1">
                  {day.posts.map((post, i) => (
                    <div key={i} className={`px-1.5 py-1 rounded border text-[10px] leading-tight cursor-pointer hover:shadow-sm transition-shadow ${postColors[post.status || post.type]}`}>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${platformDot[post.platform]}`} />
                        <span className="truncate font-medium">{post.label}</span>
                      </div>
                      <span className="text-[9px] opacity-70">{post.time} · {post.type === "ghost" ? "Suggestion" : post.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* Padding for remaining cells */}
            {Array.from({ length: (7 - ((startPad + 31) % 7)) % 7 }, (_, i) => (
              <div key={`pad-end-${i}`} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50/50" />
            ))}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-4">Week of March 2 — March 8, 2026</p>
          <div className="grid grid-cols-7 gap-3">
            {["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6", "Sat 7", "Sun 8"].map((day, i) => {
              const dayNum = i + 2;
              const dayData = calendarDays.find(d => d.day === dayNum);
              return (
                <div key={day} className={`rounded-lg border p-3 min-h-[200px] ${dayNum === 4 ? "border-blue-300 bg-blue-50/30" : "border-gray-200"}`}>
                  <p className={`text-xs font-medium mb-2 ${dayNum === 4 ? "text-blue-700" : "text-gray-500"}`}>{day} {dayNum === 4 && "(Today)"}</p>
                  <div className="space-y-2">
                    {dayData?.posts.map((post, j) => (
                      <div key={j} className={`p-2 rounded-lg border ${postColors[post.status || post.type]}`}>
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`w-2 h-2 rounded-full ${platformDot[post.platform]}`} />
                          <span className="text-[10px] font-medium uppercase">{post.type === "ghost" ? "AI Suggestion" : post.type}</span>
                        </div>
                        <p className="text-xs leading-snug">{post.label}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{post.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              {["Content", "Platform", "Account", "Type", "Scheduled For", "Status"].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {scheduledPosts.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="py-3 px-3 font-medium text-gray-900 max-w-sm truncate">{p.content}</td>
                  <td className="py-3 px-3"><PlatformBadge platform={p.platform} /></td>
                  <td className="py-3 px-3 text-gray-600">{p.account}</td>
                  <td className="py-3 px-3">
                    <span className="text-xs font-medium text-gray-600">{p.type}{p.tweets > 1 ? ` (${p.tweets})` : ""}</span>
                  </td>
                  <td className="py-3 px-3 text-gray-600">{p.scheduledFor}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Scheduled</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom: upcoming + AI suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Upcoming (Next 7 Days)</h4>
          {scheduledPosts.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${platformDot[p.platform]}`} />
                <span className="text-sm text-gray-800 truncate max-w-xs">{p.content}</span>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{p.scheduledFor}</span>
            </div>
          ))}
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">AI</div>
            <h4 className="text-sm font-semibold text-blue-900">Content Suggestions for This Week</h4>
          </div>
          <div className="space-y-3">
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="x" />
                <span className="text-xs font-medium text-blue-800">Thread · Tuesday 9:15am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">OPPORTUNITY</span>
              </div>
              <p className="text-xs text-gray-800">How AI is transforming LP reporting — first mover opportunity, rising theme in listening</p>
              <button className="text-xs text-blue-600 font-medium mt-1 hover:text-blue-800">Start Draft →</button>
            </div>
            <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <PlatformBadge platform="reddit" />
                <span className="text-xs font-medium text-blue-800">Text Post · Thursday 10:00am</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">REINFORCE</span>
              </div>
              <p className="text-xs text-gray-800">Curate founder testimonials about AI sourcing — positive theme rising in r/venturecapital</p>
              <button className="text-xs text-blue-600 font-medium mt-1 hover:text-blue-800">Start Draft →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TAB 1: FRONT DASHBOARD + ANALYTICS
// ============================================================

const DashboardTab = () => {
  const [dateRange, setDateRange] = useState("30d");
  const [detailAccount, setDetailAccount] = useState(null);

  const totals = useMemo(() => ({
    impressions: accounts.reduce((s, a) => s + a.impressions, 0),
    engRate: +(accounts.reduce((s, a) => s + a.engRate, 0) / accounts.length).toFixed(1),
    followers: accounts.reduce((s, a) => s + a.followerDelta, 0),
    posts: accounts.reduce((s, a) => s + a.posts, 0),
    mentions: accounts.reduce((s, a) => s + a.mentions, 0),
  }), []);

  if (detailAccount) {
    const acct = accounts.find(a => a.id === detailAccount);
    return (
      <div>
        <button onClick={() => setDetailAccount(null)} className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">
          ← Back to overview
        </button>
        <div className="flex items-center gap-3 mb-6">
          <Avatar initials={acct.avatar} platform={acct.platform} size="lg" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{acct.handle}</h2>
            <PlatformBadge platform={acct.platform} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <MetricCard label="Impressions" value={acct.impressions.toLocaleString()} delta={12} />
          <MetricCard label="Eng. Rate" value={`${acct.engRate}%`} delta={8} />
          <MetricCard label="Followers" value={acct.followers.toLocaleString()} delta={acct.deltaPct} />
          <MetricCard label="Net Growth" value={`+${acct.followerDelta}`} delta={acct.deltaPct} />
          <MetricCard label="Posts" value={acct.posts} delta={0} />
          <MetricCard label="Mentions" value={acct.mentions} delta={22} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Engagement Over Time</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="engRate" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Eng. Rate %" />
                <Line type="monotone" dataKey="engagements" stroke={COLORS.green} strokeWidth={2} dot={false} name="Engagements" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Follower Growth</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={followerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="net" stroke={COLORS.green} fill="#dcfce7" strokeWidth={2} name="Net New" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Each dot = one post. Size = total engagements.">Post Performance Map</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="impressions" name="Impressions" tick={{ fontSize: 11 }} />
                <YAxis dataKey="engRate" name="Eng. Rate %" tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg max-w-xs">
                      <p className="text-xs text-gray-500 mb-1">{d.type}</p>
                      <p className="text-sm font-medium text-gray-900 mb-2">{d.content}</p>
                      <div className="flex gap-3 text-xs text-gray-600">
                        <span>{d.impressions.toLocaleString()} imp</span>
                        <span>{d.engRate}% eng</span>
                        <span>{d.engagements} total</span>
                      </div>
                    </div>
                  );
                }} />
                <Scatter data={postScatterData} fill={COLORS.blue} fillOpacity={0.7}>
                  {postScatterData.map((entry, i) => (
                    <Cell key={i} r={Math.max(4, Math.sqrt(entry.engagements) / 2)} fill={entry.type === "thread" ? COLORS.blue : entry.type === "reddit" ? COLORS.amber : COLORS.indigo} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Thread</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Post</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Reddit</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Day x Hour — colored by avg engagement rate">Best Posting Times</SectionTitle>
            <div className="overflow-x-auto">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "40px repeat(17, 1fr)" }}>
                <div />
                {Array.from({ length: 17 }, (_, i) => (
                  <div key={i} className="text-center text-[10px] text-gray-400">{i + 6}</div>
                ))}
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <>
                    <div key={day} className="text-[10px] text-gray-500 flex items-center">{day}</div>
                    {heatmapData.filter(d => d.day === day).map((cell, j) => {
                      const intensity = Math.min(1, (cell.engRate - 1) / 7);
                      return (
                        <div
                          key={j}
                          className="aspect-square rounded-sm"
                          style={{ backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.8})` }}
                          title={`${cell.day} ${cell.hour}:00 — ${cell.engRate}%`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <span>Low</span>
              <div className="flex gap-0.5">{[0.15, 0.3, 0.5, 0.7, 0.9].map((o, i) => <div key={i} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(59, 130, 246, ${o})` }} />)}</div>
              <span>High</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Post Performance Table</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                {["Post", "Platform", "Type", "Published", "Impressions", "Engagements", "Eng. Rate", "Clicks", "CTR"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {postPerformanceTable.map((post, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 max-w-xs truncate font-medium text-gray-900">{post.content}</td>
                    <td className="py-3 px-3"><PlatformBadge platform={post.platform} /></td>
                    <td className="py-3 px-3 text-gray-600">{post.type}</td>
                    <td className="py-3 px-3 text-gray-500">{post.published}</td>
                    <td className="py-3 px-3 font-medium">{post.impressions.toLocaleString()}</td>
                    <td className="py-3 px-3 font-medium">{post.engagements}</td>
                    <td className="py-3 px-3"><span className={`font-medium ${post.engRate > 5 ? "text-green-600" : "text-gray-900"}`}>{post.engRate}%</span></td>
                    <td className="py-3 px-3">{post.clicks}</td>
                    <td className="py-3 px-3">{post.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Date range selector */}
      <div className="flex items-center gap-2 mb-6">
        {["7d", "30d", "90d", "Custom"].map(r => (
          <button key={r} onClick={() => setDateRange(r)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${dateRange === r ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : r === "90d" ? "Last 90 days" : "Custom"}
          </button>
        ))}
      </div>

      {/* Aggregate summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <MetricCard label="Total Impressions" value={`${(totals.impressions / 1000).toFixed(1)}K`} delta={12} />
        <MetricCard label="Avg Eng. Rate" value={`${totals.engRate}%`} delta={7} />
        <MetricCard label="Net Follower Growth" value={`+${totals.followers}`} delta={-5} />
        <MetricCard label="Brand Sentiment" value={`${brandSentimentOverTime[brandSentimentOverTime.length - 1].score}`} delta={4} />
        <MetricCard label="Total Clicks / CTR" value="1,240 / 5.1%" delta={8} />
        <MetricCard label="Posts Published" value={totals.posts} delta={0} />
        <MetricCard label="Mentions Received" value={totals.mentions} delta={22} />
      </div>

      {/* Per-account breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <SectionTitle subtitle="Click any row to drill into detailed analytics">Per-Account Breakdown</SectionTitle>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            {["Account", "Platform", "Followers", "Growth (WoW)", "", "Impressions", "Eng. Rate", "Posts", "Mentions"].map(h => (
              <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {accounts.map(acct => (
              <tr key={acct.id} onClick={() => setDetailAccount(acct.id)} className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={acct.avatar} platform={acct.platform} size="sm" />
                    <span className="font-medium text-gray-900">{acct.handle}</span>
                  </div>
                </td>
                <td className="py-3 px-3"><PlatformBadge platform={acct.platform} /></td>
                <td className="py-3 px-3 font-medium">{acct.followers.toLocaleString()}</td>
                <td className="py-3 px-3 font-medium text-green-600">+{acct.followerDelta}</td>
                <td className="py-3 px-3"><DeltaBadge value={acct.followerDelta} pct={acct.deltaPct} /></td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span>{acct.impressions.toLocaleString()}</span>
                    <Sparkline data={engagementData.slice(0, 7).map(d => d.impressions)} />
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{acct.engRate}%</span>
                    <Sparkline data={engagementData.slice(0, 7).map(d => d.engRate)} color={COLORS.green} />
                  </div>
                </td>
                <td className="py-3 px-3">{acct.posts}</td>
                <td className="py-3 px-3">{acct.mentions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Brand Sentiment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle subtitle="AI-powered sentiment analysis across all mentions, replies, and conversations">Brand Sentiment</SectionTitle>
          <div className="flex items-center gap-3">
            {sentimentAlerts.map((alert, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${alert.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                <span>{alert.severity === "warning" ? "⚠" : "✓"}</span>
                <span className="max-w-[200px] truncate">{alert.message}</span>
                <span className="text-gray-400 ml-1">{alert.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sentiment Score + Gauge */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">
                  {brandSentimentOverTime[brandSentimentOverTime.length - 1].score}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Overall Score</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendArrow direction="up" />
                  <span className="text-xs text-green-600 font-medium">+2.8 vs last period</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { label: "Positive", pct: 62, color: "bg-green-500" },
                  { label: "Neutral", pct: 26, color: "bg-gray-400" },
                  { label: "Negative", pct: 12, color: "bg-red-500" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12">{s.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-platform breakdown */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">By Platform</div>
                <span
                  className="text-[10px] text-gray-400 cursor-help"
                  title="Leftmost number is the Brand Sentiment Score for that platform (0–100 composite of positive/negative ratio). The pos/neu/neg percentages to the right are the share of mentions in each sentiment bucket. The trend value is the score change vs. last period."
                >
                  ⓘ
                </span>
              </div>
              {brandSentimentByPlatform.map(p => (
                <div key={p.platform} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={p.platform} />
                    <span
                      className="text-sm font-medium"
                      title={`Brand Sentiment Score on ${p.platform}: ${p.score}/100`}
                    >
                      {p.score}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600" title="% of mentions classified as positive">{p.positive}% pos</span>
                    <span className="text-gray-400" title="% of mentions classified as neutral">{p.neutral}% neu</span>
                    <span className="text-red-500" title="% of mentions classified as negative">{p.negative}% neg</span>
                    <span
                      className={`font-medium ${p.change > 0 ? "text-green-600" : "text-red-500"}`}
                      title="Score change vs. last period"
                    >
                      {p.change > 0 ? "↑" : "↓"} {Math.abs(p.change)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment over time chart */}
          <div className="lg:col-span-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sentiment Trend (30 days)</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={brandSentimentOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="positive" stackId="1" stroke="#22c55e" fill="#dcfce7" name="Positive %" />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke="#9ca3af" fill="#f3f4f6" name="Neutral %" />
                <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#fee2e2" name="Negative %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Drivers */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Sentiment Drivers — AI-Detected Themes</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {brandSentimentDrivers.map(d => (
              <div key={d.theme} className="p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-900">{d.theme}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.impact === "high" ? "bg-red-50 text-red-600" : d.impact === "medium" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500"}`}>
                    {d.impact} impact
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`text-lg font-bold ${d.sentiment >= 70 ? "text-green-600" : d.sentiment >= 50 ? "text-amber-600" : "text-red-500"}`}>
                    {d.sentiment}
                  </div>
                  <TrendArrow direction={d.trend} />
                </div>
                <div className="text-[10px] text-gray-500">
                  <span className="font-medium text-gray-600">"{d.topKeyword}"</span> · {d.volume} mentions
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Engagement Trend (All Accounts)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="engRate" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Eng. Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Follower Growth (All Accounts)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={followerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke={COLORS.green} fill="#dcfce7" strokeWidth={2} name="Total Followers" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TAB 2: SOCIAL LISTENING + SOV
// ============================================================

const ListeningTab = () => {
  const [subTab, setSubTab] = useState("feed");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");

  const brandAccounts = [
    { key: "all", label: "All Brands" },
    { key: "@highland_vc", label: "@highland_vc", platform: "x" },
    { key: "@highland_official", label: "@highland_official", platform: "x" },
    { key: "u/highland_ventures", label: "u/highland_ventures", platform: "reddit" },
  ];

  const filteredFeed = listeningFeed.filter(h => {
    const matchRelevance = relevanceFilter === "all" || h.relevance === relevanceFilter;
    const matchBrand = brandFilter === "all" || (brandFilter.startsWith("u/") ? h.platform === "reddit" : h.platform === "x");
    return matchRelevance && matchBrand;
  });

  return (
    <div>
      {/* Brand filter bar */}
      <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
        <span className="text-xs font-medium text-gray-500 mr-1">Brand:</span>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {brandAccounts.map(b => (
            <button key={b.key} onClick={() => setBrandFilter(b.key)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${brandFilter === b.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {b.platform && <PlatformBadge platform={b.platform} />}
              {b.label}
            </button>
          ))}
        </div>
        {brandFilter !== "all" && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-gray-400">Showing data for</span>
            <span className="font-semibold text-gray-700">{brandFilter}</span>
            <button onClick={() => setBrandFilter("all")} className="text-blue-600 hover:text-blue-700 font-medium">Clear</button>
          </div>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: "feed", label: "Listening Feed", badge: filteredFeed.length },
          { key: "insights", label: "AI Insights" },
          { key: "topics", label: "Topics" },
          { key: "sov", label: "Share of Voice" },
          { key: "competitors", label: "Competitors" },
        ].map(t => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {subTab === "feed" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Feed - left 3 cols */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Filter:</span>
              {["all", "HIGH", "MEDIUM"].map(f => (
                <button key={f} onClick={() => setRelevanceFilter(f)} className={`px-2.5 py-1 text-xs rounded-lg font-medium ${relevanceFilter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredFeed.map(hit => (
                <div key={hit.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${hit.relevance === "HIGH" ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={hit.platform} />
                      <span className="font-semibold text-gray-900 text-sm">{hit.author}</span>
                      <span className="text-xs text-gray-400">{hit.followers}</span>
                      {hit.subreddit && <span className="text-xs text-orange-600 font-medium">{hit.subreddit}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <RelevanceBadge level={hit.relevance} />
                      <SentimentDot sentiment={hit.sentiment} />
                      <span className="text-xs text-gray-400">{hit.time}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed mb-3">{hit.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{hit.engagements} engagements</span>
                      <span>Score: {hit.heuristic}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">Reply</button>
                      <button className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100">Bookmark</button>
                      <button className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100">Dismiss</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar - right col */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Active Topics</h4>
              {listeningTopics.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.queries} queries · {t.hits24h} hits/24h</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.tier === "Hot" ? "bg-red-100 text-red-700" : t.tier === "Warm" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {t.tier}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Sentiment (24h)</h4>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={[{ name: "Positive", value: 62 }, { name: "Neutral", value: 24 }, { name: "Negative", value: 14 }]} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                    <Cell fill={COLORS.green} />
                    <Cell fill={COLORS.gray} />
                    <Cell fill={COLORS.red} />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />62% Pos</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />24% Neu</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />14% Neg</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">API Cost (This Month)</h4>
              <p className="text-2xl font-bold text-gray-900">$12.40</p>
              <p className="text-xs text-gray-500 mt-1">Budget: $30 · 41% used</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: "41%" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === "insights" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="AI-powered analysis of conversation themes, sentiment drivers, and strategic recommendations">AI Insights</SectionTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Last updated: 2h ago</span>
              <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Refresh Analysis</button>
            </div>
          </div>

          {/* AI Summary Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-bold text-indigo-900">Weekly Landscape Summary</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">Feb 26 – Mar 4</span>
                </div>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  The AI deal sourcing conversation is maturing from "is this real?" to "which tool is best?" — a bullish signal for Highland's positioning. Three dominant narratives emerged this week: (1) <strong>tool comparison threads</strong> are surging (+180% vs last week), with users actively evaluating specific products; (2) <strong>skepticism around ROI</strong> persists on Reddit, but the tone is shifting from dismissive to genuinely curious; (3) a new <strong>CRM integration</strong> angle is gaining traction that we haven't been addressing in our content. Recommendation: publish a thread on concrete ROI metrics from your portfolio companies using AI sourcing — this directly addresses the skepticism while positioning Highland as a thought leader with real data.
                </p>
              </div>
            </div>
          </div>

          {/* Sentiment Drivers Grid */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Sentiment Drivers</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { theme: "AI Deal Sourcing Tools", sentiment: 74, volume: 156, trend: "up", delta: 12, topPosts: ["Tool comparison threads dominating", "Integration quality matters most"], recommendation: "Publish comparison content positioning Highland's approach", platform: "x", positive: 62, neutral: 24, negative: 14 },
                { theme: "ROI Skepticism", sentiment: 38, volume: 89, trend: "stable", delta: -2, topPosts: ["'Show me the numbers' is the dominant ask", "Reddit r/venturecapital driving most skepticism"], recommendation: "Share concrete portfolio ROI data to shift narrative", platform: "reddit", positive: 28, neutral: 31, negative: 41 },
                { theme: "CRM Integration", sentiment: 65, volume: 67, trend: "up", delta: 28, topPosts: ["New angle: deal sourcing → CRM pipeline", "Founders asking about Salesforce/HubSpot connectors"], recommendation: "New content opportunity — CRM workflow content is underserved", platform: "both", positive: 55, neutral: 32, negative: 13 },
                { theme: "VC Automation Ethics", sentiment: 52, volume: 45, trend: "down", delta: -8, topPosts: ["Founders worry about being auto-rejected", "AI bias in deal screening getting attention"], recommendation: "Address proactively with transparency content before it becomes a crisis", platform: "x", positive: 35, neutral: 30, negative: 35 },
                { theme: "Seed Stage AI", sentiment: 71, volume: 112, trend: "up", delta: 5, topPosts: ["Highland mentioned in 3 positive contexts", "Portfolio company wins driving organic mentions"], recommendation: "Amplify portfolio success stories — they're your best organic content", platform: "both", positive: 58, neutral: 28, negative: 14 },
                { theme: "Competing Funds", sentiment: 61, volume: 78, trend: "up", delta: 15, topPosts: ["Competitor A's thread went viral (450+ eng)", "New entrant 'AI Capital' getting early buzz"], recommendation: "Monitor closely — consider a counter-narrative thread this week", platform: "x", positive: 45, neutral: 35, negative: 20 },
              ].map((driver, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-semibold text-gray-900">{driver.theme}</h5>
                    <div className="flex items-center gap-1">
                      {driver.platform === "both" ? (
                        <><PlatformBadge platform="x" /><PlatformBadge platform="reddit" /></>
                      ) : (
                        <PlatformBadge platform={driver.platform} />
                      )}
                    </div>
                  </div>

                  {/* Sentiment bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`text-2xl font-bold ${driver.sentiment >= 65 ? "text-green-600" : driver.sentiment >= 45 ? "text-amber-500" : "text-red-500"}`}>
                      {driver.sentiment}
                    </div>
                    <div className="flex-1">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        <div className="bg-green-500" style={{ width: `${driver.positive}%` }} />
                        <div className="bg-gray-300" style={{ width: `${driver.neutral}%` }} />
                        <div className="bg-red-500" style={{ width: `${driver.negative}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>{driver.positive}% pos</span>
                        <span>{driver.negative}% neg</span>
                      </div>
                    </div>
                  </div>

                  {/* Volume + trend */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span>{driver.volume} mentions</span>
                    <span className={`font-medium ${driver.delta > 0 ? "text-green-600" : driver.delta < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {driver.delta > 0 ? "↑" : driver.delta < 0 ? "↓" : "→"} {Math.abs(driver.delta)}% vs last week
                    </span>
                  </div>

                  {/* Top signals */}
                  <div className="space-y-1 mb-3">
                    {driver.topPosts.map((p, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-300 mt-0.5">•</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>

                  {/* AI recommendation */}
                  <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                    <div className="flex items-start gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 mt-0.5">AI</div>
                      <p className="text-xs text-blue-800 leading-relaxed">{driver.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Narrative Shifts Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <SectionTitle subtitle="How the conversation is evolving week over week">Narrative Shift Timeline</SectionTitle>
            <div className="relative mt-4">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              {[
                { week: "This Week", shift: "Tool comparison phase — users actively evaluating specific products. Highland mentioned organically 3x.", sentiment: 72, direction: "up" },
                { week: "Last Week", shift: "General awareness phase — 'what is AI deal sourcing?' questions dominated. Low brand-specific mentions.", sentiment: 68, direction: "stable" },
                { week: "2 Weeks Ago", shift: "Skepticism peak — Reddit thread questioning AI in VC got 200+ upvotes. Negative sentiment spiked to 22%.", sentiment: 58, direction: "down" },
                { week: "3 Weeks Ago", shift: "Emerging interest — first wave of seed-stage founders asking about AI tools for fundraising. Positive curiosity phase.", sentiment: 65, direction: "up" },
              ].map((entry, i) => (
                <div key={i} className="relative pl-10 pb-6">
                  <div className={`absolute left-[10px] w-3 h-3 rounded-full border-2 border-white ${i === 0 ? "bg-blue-500" : "bg-gray-300"}`} />
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${i === 0 ? "text-blue-600" : "text-gray-500"}`}>{entry.week}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${entry.direction === "up" ? "bg-green-50 text-green-600" : entry.direction === "down" ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"}`}>
                      Sentiment: {entry.sentiment} {entry.direction === "up" ? "↑" : entry.direction === "down" ? "↓" : "→"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{entry.shift}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Prioritized actions based on sentiment analysis and conversation trends">Strategic Recommendations</SectionTitle>
            <div className="space-y-3 mt-4">
              {[
                { priority: "HIGH", action: "Publish ROI data thread", detail: "The #1 ask across both platforms is concrete ROI data from AI deal sourcing. A thread sharing anonymized portfolio results would directly counter the skepticism narrative and position Highland as the authority. Estimated impact: 8K–12K impressions based on similar threads.", category: "Content", effort: "Medium" },
                { priority: "HIGH", action: "Respond to Competitor A's viral thread", detail: "Their thread on 'AI-first portfolio management' hit 450+ engagements. Silence looks like concession. A quote tweet or follow-up thread with Highland's perspective would reclaim mindshare. Best posted within 48 hours.", category: "Response", effort: "Low" },
                { priority: "MEDIUM", action: "Create CRM integration content", detail: "A new content gap has emerged — founders are asking about deal sourcing → CRM pipeline workflows and nobody is owning this narrative yet. First-mover advantage opportunity.", category: "New Content", effort: "High" },
                { priority: "MEDIUM", action: "Engage on Reddit r/venturecapital", detail: "Reddit sentiment is 10 points lower than X (61.8 vs 72.4). Two specific threads have unanswered questions about Highland. Responding authentically would improve Reddit sentiment score.", category: "Engagement", effort: "Low" },
                { priority: "LOW", action: "Prepare AI ethics positioning", detail: "The 'VC automation ethics' conversation is growing (-8% sentiment, increasing volume). Getting ahead of this with a thoughtful take prevents future crisis management.", category: "Proactive", effort: "Medium" },
              ].map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5 ${rec.priority === "HIGH" ? "bg-red-100 text-red-700" : rec.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    {rec.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-semibold text-gray-900">{rec.action}</h5>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{rec.category}</span>
                      <span className="text-[10px] text-gray-400">{rec.effort} effort</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{rec.detail}</p>
                  </div>
                  <button className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap flex-shrink-0">Draft →</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === "topics" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Describe what you want to monitor — AI generates the queries">Listening Topics</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ New Topic</button>
          </div>

          {/* AI Query Builder Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-2">AI Query Builder</p>
                <div className="bg-white rounded-lg p-3 border border-blue-100 mb-3">
                  <p className="text-sm text-gray-500 italic">"Find people talking about AI agents for venture capital deal sourcing, especially founders building in this space or VCs evaluating tools"</p>
                </div>
                <p className="text-sm text-blue-800 mb-3">Generated 7 queries across X and Reddit:</p>
                <div className="space-y-2">
                  {[
                    { q: '"AI agent" ("deal sourcing" OR "deal flow" OR "venture capital")', p: "x", vol: "~120/day" },
                    { q: '"AI copilot" VC (sourcing OR diligence OR pipeline)', p: "x", vol: "~45/day" },
                    { q: 'subreddit:venturecapital "AI" (agent OR tool OR automation)', p: "reddit", vol: "~18/day" },
                    { q: 'subreddit:startups ("AI sourcing" OR "AI deal flow")', p: "reddit", vol: "~12/day" },
                  ].map((q, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <PlatformBadge platform={q.p} />
                      <code className="text-xs text-gray-700 flex-1 font-mono">{q.q}</code>
                      <span className="text-xs text-gray-400">{q.vol}</span>
                      <button className="text-xs text-red-500 hover:text-red-700">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-gray-500">Est. cost: ~$2.40/mo</span>
                  <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">Activate Topic</button>
                  <button className="px-3 py-1.5 bg-white text-blue-600 text-xs rounded-lg border border-blue-200 hover:bg-blue-50 font-medium">Edit Queries</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                {["Topic", "Queries", "Hits (24h)", "Sentiment", "Polling Tier", "Status"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {listeningTopics.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-3 font-medium text-gray-900">{t.name}</td>
                    <td className="py-3 px-3">{t.queries}</td>
                    <td className="py-3 px-3 font-medium">{t.hits24h}</td>
                    <td className="py-3 px-3"><span className={`font-medium ${t.sentiment > 65 ? "text-green-600" : "text-amber-600"}`}>{t.sentiment}% pos</span></td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.tier === "Hot" ? "bg-red-100 text-red-700" : t.tier === "Warm" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{t.tier}</span>
                    </td>
                    <td className="py-3 px-3"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "sov" && (
        <div>
          <SectionTitle subtitle="Your brand's share of the conversation vs. competitors">Share of Voice</SectionTitle>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Current SOV</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sovData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${value}%`}>
                    {sovData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {sovData.map(s => (
                  <span key={s.name} className="flex items-center gap-1 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">SOV Over Time</h4>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sovTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Highland" stackId="1" stroke="#3b82f6" fill="#93c5fd" />
                  <Area type="monotone" dataKey="Competitor A" stackId="1" stroke="#ef4444" fill="#fca5a5" />
                  <Area type="monotone" dataKey="Competitor B" stackId="1" stroke="#f59e0b" fill="#fcd34d" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Competitor comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Competitive Comparison</h4>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                {["Brand", "SOV", "Mentions", "Sentiment", "Avg Engagement", "Follower Growth"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {sovData.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className={`font-medium ${i === 0 ? "text-blue-700" : "text-gray-900"}`}>{s.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-lg">{s.value}%</td>
                    <td className="py-3 px-3">{s.mentions}</td>
                    <td className="py-3 px-3">{s.sentiment ? <span className={s.sentiment > 65 ? "text-green-600 font-medium" : "text-amber-600"}>{s.sentiment}% pos</span> : "—"}</td>
                    <td className="py-3 px-3">{s.avgEng ? `${s.avgEng}%` : "—"}</td>
                    <td className="py-3 px-3">{s.growth ? <span className="text-green-600 font-medium">+{s.growth}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sentiment trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Sentiment Trend (All Topics)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sentimentTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="positive" stackId="1" stroke={COLORS.green} fill="#bbf7d0" name="Positive" />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke={COLORS.gray} fill="#e5e7eb" name="Neutral" />
                <Area type="monotone" dataKey="negative" stackId="1" stroke={COLORS.red} fill="#fecaca" name="Negative" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {subTab === "competitors" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Track competitor accounts, keywords, and content performance">Competitor Monitoring</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Add Competitor</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {sovData.filter(s => s.name !== "Unattributed" && s.name !== "Highland Ventures").map((comp, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: comp.color }} />
                  <h4 className="font-semibold text-gray-900">{comp.name}</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-gray-500 text-xs">SOV</p><p className="font-bold text-lg">{comp.value}%</p></div>
                  <div><p className="text-gray-500 text-xs">Mentions</p><p className="font-bold text-lg">{comp.mentions}</p></div>
                  <div><p className="text-gray-500 text-xs">Sentiment</p><p className="font-medium text-amber-600">{comp.sentiment}% pos</p></div>
                  <div><p className="text-gray-500 text-xs">Engagement</p><p className="font-medium">{comp.avgEng}%</p></div>
                </div>
                <button className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium">View Posts →</button>
              </div>
            ))}
          </div>

          {/* Mindshare alert example */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg">⚠</span>
              <div>
                <p className="text-sm font-medium text-amber-900">Mindshare Alert</p>
                <p className="text-sm text-amber-800 mt-1">Competitor A's SOV has exceeded yours for 3 consecutive days (29% vs 27%). Their recent thread on "AI-first portfolio management" drove 450+ engagements. Consider responding with your perspective.</p>
                <div className="flex gap-2 mt-2">
                  <button className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700">View Their Post</button>
                  <button className="px-3 py-1 text-xs bg-white text-amber-700 rounded-lg border border-amber-300 hover:bg-amber-50">Draft Response</button>
                  <button className="px-3 py-1 text-xs text-amber-600 hover:text-amber-800">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// TAB 3: KOL TRACKING
// ============================================================

const KOLTab = () => {
  const [subTab, setSubTab] = useState("roster");
  const [selectedKOL, setSelectedKOL] = useState(null);

  if (selectedKOL) {
    const kol = kols.find(k => k.id === selectedKOL);
    return (
      <div>
        <button onClick={() => setSelectedKOL(null)} className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1">← Back to roster</button>

        {/* KOL header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar initials={kol.avatar} platform={kol.platform} size="lg" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{kol.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">{kol.handle}</span>
                  <PlatformBadge platform={kol.platform} />
                  <span className="text-sm text-gray-400">·</span>
                  <span className="text-sm text-gray-500">{kol.followers} followers</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{kol.type}</span>
                  <span className="px-2 py-0.5 bg-blue-50 rounded text-xs text-blue-600">{kol.cohort}</span>
                  {kol.comp !== "—" && <span className="text-xs text-gray-500">Comp: {kol.comp}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <ScoreBadge score={kol.score} />
              <p className="text-sm text-gray-500 mt-1">{kol.scoreLabel}</p>
              <TrendArrow trend={kol.trend} />
            </div>
          </div>
        </div>

        {/* KOL metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard label="Activations (30d)" value={kol.activations} delta={15} />
          <MetricCard label="Avg Engagement" value={`${kol.avgEng}%`} delta={8} />
          <MetricCard label="Est. Impressions" value={kol.impressions} delta={12} />
          <MetricCard label="Sentiment" value={`${kol.sentiment}% pos`} delta={3} />
          <MetricCard label="Follower Correlation" value={kol.correlation.toFixed(2)} />
          <MetricCard label="Cost/Engagement" value={kol.comp !== "—" ? "$0.42" : "N/A"} />
        </div>

        {/* AI Analysis */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-2">AI Analysis — Updated 2 days ago</p>
              {kol.score === "A" && (
                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                  <p><strong>Score: A (High Value).</strong> {kol.name.split(" ")[0]} is one of your strongest KOLs. Their activations outperform both their own baseline ({kol.avgEng}% vs 5.8% non-brand) and your organic content ({kol.avgEng}% vs 4.8%), suggesting their audience has genuine interest in your brand.</p>
                  <p>The {kol.correlation} follower growth correlation is strong — their posts are directly driving new followers to your account. At {kol.comp} for ~{kol.impressions} quality impressions, the CPM is premium but justified given engagement quality and follower attribution.</p>
                  <p><strong>Recommendation:</strong> Maintain and explore co-created content (threads together, AMAs) to deepen the partnership. Consider a performance bonus tied to follower milestones.</p>
                </div>
              )}
              {kol.score === "D" && (
                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                  <p><strong>Score: D (Not Worth It).</strong> Despite {kol.followers} followers, {kol.name.split(" ")[0]}'s single activation generated only {kol.impressions} impressions with {kol.avgEng}% engagement — well below both their baseline and your organic content.</p>
                  <p>The 0.05 follower correlation suggests near-zero impact on your growth. At {kol.comp}, the cost per quality engagement is $52.08 — roughly 100x your organic cost.</p>
                  <p><strong>Recommendation:</strong> Wind down this partnership. Their audience doesn't overlap with your target market. Reallocate budget to micro-KOLs with higher engagement quality.</p>
                </div>
              )}
              {(kol.score !== "A" && kol.score !== "D") && (
                <div className="text-sm text-gray-800 leading-relaxed">
                  <p><strong>Score: {kol.score} ({kol.scoreLabel}).</strong> {kol.name.split(" ")[0]} shows moderate engagement with {kol.activations} activations this period averaging {kol.avgEng}% engagement. Follower correlation at {kol.correlation} indicates some positive impact but room for improvement. Consider adjusting content topics or posting cadence to maximize relevance.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Performance chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Activation Performance Over Time</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kolPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="activations" fill={COLORS.blue} radius={[4, 4, 0, 0]} name="Activations" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle>Impressions per Activation</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={kolPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke={COLORS.purple} strokeWidth={2} dot={false} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activation timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionTitle>Activation Timeline</SectionTitle>
          <div className="space-y-3">
            {kolActivations.filter(a => a.kol === kol.handle).map((act, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-blue-600">{act.type}</span>
                    <span className="text-xs text-gray-400">{act.time}</span>
                  </div>
                  <p className="text-sm text-gray-800">{act.content}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{act.engagements} engagements</span>
                    <span>{act.impressions} impressions</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: "roster", label: "KOL Roster" },
          { key: "activations", label: "Recent Activations" },
          { key: "discover", label: "AI Discovery" },
        ].map(t => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)}>{t.label}</TabButton>
        ))}
        <div className="flex-1" />
        <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Add KOL</button>
      </div>

      {subTab === "roster" && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Active KOLs" value={kols.length} />
            <MetricCard label="Total Activations (30d)" value={kols.reduce((s, k) => s + k.activations, 0)} delta={18} />
            <MetricCard label="Avg Engagement" value={`${(kols.reduce((s, k) => s + k.avgEng, 0) / kols.length).toFixed(1)}%`} delta={5} />
            <MetricCard label="Est. Total Impressions" value="42.3K" delta={14} />
          </div>

          {/* KOL roster table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                {["KOL", "Platform", "Followers", "Type", "Activations", "Avg Eng.", "Impressions", "Sentiment", "AI Score", "Trend"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {kols.map(kol => (
                  <tr key={kol.id} onClick={() => setSelectedKOL(kol.id)} className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={kol.avatar} platform={kol.platform} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900">{kol.name}</p>
                          <p className="text-xs text-gray-400">{kol.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3"><PlatformBadge platform={kol.platform} /></td>
                    <td className="py-3 px-3">{kol.followers}</td>
                    <td className="py-3 px-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{kol.type}</span></td>
                    <td className="py-3 px-3 font-medium">{kol.activations}</td>
                    <td className="py-3 px-3"><span className={`font-medium ${kol.avgEng > 4 ? "text-green-600" : kol.avgEng > 2 ? "text-gray-900" : "text-red-500"}`}>{kol.avgEng}%</span></td>
                    <td className="py-3 px-3">{kol.impressions}</td>
                    <td className="py-3 px-3"><span className={kol.sentiment > 75 ? "text-green-600" : "text-amber-600"}>{kol.sentiment}% pos</span></td>
                    <td className="py-3 px-3"><ScoreBadge score={kol.score} /></td>
                    <td className="py-3 px-3"><TrendArrow trend={kol.trend} /> <span className="text-xs text-gray-400">{kol.scoreLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Monthly AI Portfolio Review */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mt-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-2">Monthly KOL Portfolio Review — March 2026</p>
                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                  <p><strong>Portfolio health: Good.</strong> 2 of 5 KOLs rated A (High Value), 1 rated B, 1 rated C (declining), and 1 rated D (recommended for wind-down).</p>
                  <p><strong>Top performer:</strong> @techVC_sarah delivers 53% of your total KOL-driven impressions at the lowest cost per engagement ($0.42). Her follower correlation (0.72) is the strongest in your portfolio.</p>
                  <p><strong>Action required:</strong> @ai_influencer (D-rated) has generated only 1 activation in 30 days despite $5,000/mo compensation. Recommend immediate wind-down — reallocating even half this budget to 2–3 micro-KOLs would yield significantly higher ROI.</p>
                  <p><strong>Opportunity:</strong> Your Reddit KOL coverage is thin (1 of 5). Consider adding 2 Reddit-native KOLs from the discovery suggestions — r/venturecapital has high SOV potential with low competition.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === "activations" && (
        <div>
          <SectionTitle subtitle="All KOL activations across platforms, most recent first">Recent Activations</SectionTitle>
          <div className="space-y-3">
            {kolActivations.map((act, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{act.kol}</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{act.type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{act.time}</span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed mb-2">{act.content}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{act.engagements} engagements</span>
                  <span>{act.impressions} impressions</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "discover" && (
        <div>
          <SectionTitle subtitle="AI-identified potential KOLs from your social listening feed">KOL Discovery Suggestions</SectionTitle>

          <div className="space-y-4">
            {kolDiscoverySuggestions.map((sug, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformBadge platform={sug.platform} />
                      <span className="font-semibold text-gray-900">{sug.handle}</span>
                      <span className="text-sm text-gray-400">{sug.followers}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      Appeared <strong>{sug.hits} times</strong> in your listening feed over the past month discussing <strong>{sug.topic}</strong>.
                      Average {sug.avgUpvotes ? `${sug.avgUpvotes} upvotes` : `${sug.avgEng} engagement`} per post. Sentiment: {sug.sentiment}% positive.
                    </p>
                    <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 mt-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">AI</div>
                      <p className="text-xs text-blue-800">
                        {sug.platform === "reddit"
                          ? `This user consistently posts high-quality, well-received content in r/venturecapital about ${sug.topic}. Their posts generate substantive discussion (avg 12 comments). Their audience aligns well with your target market. Consider reaching out for an organic partnership.`
                          : `Active voice in the ${sug.topic} conversation on X. Their engagement rate (${sug.avgEng}) suggests an authentic, engaged audience rather than inflated followers. Good candidate for a paid partnership pilot.`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 whitespace-nowrap">Add as KOL</button>
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 whitespace-nowrap">Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// TAB 4: ADMIN PANEL
// ============================================================

const roadmapItems = [
  { id: 1, phase: "Phase 1", title: "Project scaffolding", status: "deployed", est: 1, actual: 1, deployed: "Jan 15" },
  { id: 2, phase: "Phase 1", title: "OAuth account connection", status: "deployed", est: 1, actual: 1.5, deployed: "Jan 22" },
  { id: 3, phase: "Phase 1", title: "Post composer + preview", status: "deployed", est: 2, actual: 2, deployed: "Feb 5" },
  { id: 4, phase: "Phase 1", title: "Basic scheduling + BullMQ", status: "deployed", est: 1, actual: 1, deployed: "Feb 10" },
  { id: 5, phase: "Phase 1", title: "Calendar view", status: "deployed", est: 1, actual: 1, deployed: "Feb 14" },
  { id: 6, phase: "Phase 1", title: "RBAC + team invitations", status: "deployed", est: 1, actual: 1.5, deployed: "Feb 20" },
  { id: 7, phase: "Phase 1", title: "API adapter layer (hybrid)", status: "deployed", est: 1, actual: 1, deployed: "Feb 24" },
  { id: 8, phase: "Phase 1", title: "Admin panel + cost tracker", status: "deployed", est: 1, actual: 1, deployed: "Feb 28" },
  { id: 9, phase: "Phase 2", title: "Thread composer + preview", status: "in_progress", est: 2, actual: null, deployed: null },
  { id: 10, phase: "Phase 2", title: "Thread scheduling", status: "in_progress", est: 1, actual: null, deployed: null },
  { id: 11, phase: "Phase 2", title: "Metrics poller worker", status: "not_started", est: 1, actual: null, deployed: null },
  { id: 12, phase: "Phase 2", title: "Front dashboard + WoW", status: "not_started", est: 2, actual: null, deployed: null },
  { id: 13, phase: "Phase 2", title: "Detailed analytics views", status: "not_started", est: 2, actual: null, deployed: null },
  { id: 14, phase: "Phase 3", title: "Mentions tracking", status: "not_started", est: 1, actual: null, deployed: null },
  { id: 15, phase: "Phase 3", title: "Unified inbox", status: "not_started", est: 2, actual: null, deployed: null },
  { id: 16, phase: "Phase 4a", title: "AI query builder", status: "not_started", est: 2, actual: null, deployed: null },
  { id: 17, phase: "Phase 4a", title: "Social listening feed", status: "not_started", est: 2, actual: null, deployed: null },
  { id: 18, phase: "Phase 4b", title: "Competitor monitoring + SOV", status: "not_started", est: 2, actual: null, deployed: null },
  { id: 19, phase: "Phase 4c", title: "KOL tracking + AI scoring", status: "not_started", est: 3, actual: null, deployed: null },
  { id: 20, phase: "Phase 4c", title: "Content intelligence loop", status: "not_started", est: 2, actual: null, deployed: null },
];

const featureRequests = [
  { id: 1, title: "Dark mode for the dashboard", type: "feature", submittedBy: "Jenny K.", role: "Internal", date: "Feb 28", priority: "nice_to_have", votes: 4, status: "under_review", area: "Analytics" },
  { id: 2, title: "Bulk schedule from CSV upload", type: "feature", submittedBy: "Mike R.", role: "Agency", date: "Feb 25", priority: "high", votes: 7, status: "planned", area: "Composer", linkedItem: "Phase 2" },
  { id: 3, title: "Timezone shows wrong for scheduled posts", type: "bug", submittedBy: "Sarah C.", role: "Internal", date: "Mar 1", priority: "critical", votes: 3, status: "in_progress", area: "Calendar" },
  { id: 4, title: "Add Bluesky as a platform", type: "feature", submittedBy: "Dan P.", role: "Internal", date: "Feb 20", priority: "medium", votes: 5, status: "new", area: "Other" },
  { id: 5, title: "Export analytics as PDF report", type: "feature", submittedBy: "Jenny K.", role: "Internal", date: "Feb 22", priority: "medium", votes: 6, status: "planned", area: "Analytics", linkedItem: "V2 Backlog" },
];

const costByService = [
  { service: "X Official API", thisMonth: 18.40, lastMonth: 15.20, pct: 27, color: "#1d9bf0" },
  { service: "TwitterAPI.io", thisMonth: 8.60, lastMonth: 7.10, pct: 13, color: "#6b7280" },
  { service: "Reddit API", thisMonth: 12.30, lastMonth: 11.40, pct: 18, color: "#ff4500" },
  { service: "Claude API (Haiku)", thisMonth: 3.12, lastMonth: 2.21, pct: 5, color: "#8b5cf6" },
  { service: "Lovable (Pro)", thisMonth: 25.00, lastMonth: 25.00, pct: 37, color: "#ec4899" },
  { service: "Infrastructure", thisMonth: 0.00, lastMonth: 0.00, pct: 0, color: "#d1d5db" },
];

const costByFeature = [
  { feature: "Social Listening", calls: 18200, tokens: "1.2M", cost: 14.80, note: "Highest cost, highest value" },
  { feature: "Metrics Polling", calls: 12400, tokens: "—", cost: 8.20, note: "Scales with post volume" },
  { feature: "Mentions / Inbox", calls: 8600, tokens: "—", cost: 5.10, note: "Scales with engagement" },
  { feature: "Competitor Monitoring", calls: 6200, tokens: "340K", cost: 4.00, note: "Per competitor" },
  { feature: "AI Insights / Themes", calls: "—", tokens: "2.8M", cost: 3.12, note: "Minimal cost, high value" },
  { feature: "KOL Tracking", calls: 3100, tokens: "180K", cost: 2.40, note: "Efficient per KOL" },
  { feature: "Publishing", calls: 420, tokens: "—", cost: 1.80, note: "Low, predictable" },
];

const costTrendData = Array.from({ length: 30 }, (_, i) => ({
  date: `Feb ${i + 1}`,
  xOfficial: +(0.3 + Math.random() * 0.8).toFixed(2),
  twitterApiIo: +(0.15 + Math.random() * 0.4).toFixed(2),
  reddit: +(0.25 + Math.random() * 0.5).toFixed(2),
  claude: +(0.05 + Math.random() * 0.15).toFixed(2),
}));

const claudeTokenBreakdown = [
  { job: "Theme extraction", input: "720K", output: "540K", calls: 360, cost: 0.86 },
  { job: "Relevance scoring", input: "180K", output: "90K", calls: 150, cost: 0.16 },
  { job: "KOL scoring", input: "120K", output: "80K", calls: 20, cost: 0.13 },
  { job: "Content suggestions", input: "96K", output: "128K", calls: 16, cost: 0.18 },
  { job: "Post debriefs", input: "45K", output: "60K", calls: 30, cost: 0.09 },
  { job: "Query building", input: "30K", output: "40K", calls: 8, cost: 0.06 },
  { job: "Digests (daily/weekly)", input: "60K", output: "80K", calls: 32, cost: 0.12 },
];

const deployLog = [
  { time: "Mar 4, 2:15pm", sha: "a3f2c8d", message: "feat: add thread composer preview [roadmap:thread-composer]", status: "success", items: ["Thread composer + preview"] },
  { time: "Mar 3, 11:30am", sha: "b7e1f4a", message: "fix: timezone handling in scheduler [roadmap:basic-scheduling]", status: "success", items: ["Basic scheduling + BullMQ"] },
  { time: "Mar 2, 4:45pm", sha: "c9d3a2b", message: "feat: admin panel cost tracker charts", status: "success", items: ["Admin panel + cost tracker"] },
  { time: "Mar 1, 9:10am", sha: "d1f5e7c", message: "chore: update dependencies", status: "success", items: [] },
  { time: "Feb 28, 3:20pm", sha: "e4a8b1d", message: "feat: initial admin panel with roadmap view [roadmap:admin-panel]", status: "success", items: ["Admin panel + cost tracker"] },
];

// ============================================================
// TAB 6: REPORTS
// ============================================================

const reportRepository = [
  { id: 1, title: "Weekly Social Performance — Feb 24–Mar 2", type: "weekly", createdBy: "AI + Miso", created: "Mar 3, 2026", status: "final", pages: 8, aiPct: 85, downloads: 3 },
  { id: 2, title: "Monthly Executive Summary — February 2026", type: "monthly", createdBy: "AI + Miso", created: "Mar 1, 2026", status: "final", pages: 14, aiPct: 70, downloads: 7 },
  { id: 3, title: "KOL Campaign Performance — Q1 2026 Midpoint", type: "campaign", createdBy: "Miso", created: "Feb 22, 2026", status: "final", pages: 6, aiPct: 60, downloads: 5 },
  { id: 4, title: "Competitor Analysis Deep Dive — Feb 2026", type: "competitor", createdBy: "AI", created: "Feb 18, 2026", status: "final", pages: 10, aiPct: 95, downloads: 2 },
  { id: 5, title: "Weekly Social Performance — Feb 17–23", type: "weekly", createdBy: "AI + Miso", created: "Feb 24, 2026", status: "final", pages: 8, aiPct: 85, downloads: 4 },
  { id: 6, title: "Content Strategy Audit — Q4 2025 vs Q1 2026", type: "audit", createdBy: "AI", created: "Feb 10, 2026", status: "draft", pages: 12, aiPct: 90, downloads: 0 },
];

const benchmarkData = Array.from({ length: 12 }, (_, i) => ({
  month: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][i],
  engRate: +(2.1 + i * 0.22 + Math.random() * 0.5).toFixed(1),
  followers: Math.floor(6200 + i * 580 + Math.random() * 200),
  impressions: Math.floor(8000 + i * 1100 + Math.random() * 500),
  sentiment: Math.floor(55 + i * 1.5 + Math.random() * 5),
  sovPct: +(22 + i * 1.1 + Math.random() * 3).toFixed(1),
}));

const ReportsTab = () => {
  const [subTab, setSubTab] = useState("builder");
  const [aiPrompt, setAiPrompt] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [selectedBenchmark, setSelectedBenchmark] = useState("engRate");
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredReports = reportTypeFilter === "all" ? reportRepository : reportRepository.filter(r => r.type === reportTypeFilter);

  return (
    <div>
      {/* Sub-navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: "builder", label: "AI Report Builder" },
          { key: "repository", label: "Report Repository", badge: reportRepository.length },
          { key: "benchmarks", label: "Historical Benchmarks" },
        ].map(t => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {subTab === "builder" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Describe the report you need — AI drafts it, you refine it">AI Report Builder</SectionTitle>
          </div>

          {/* AI Prompt Area */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 mb-3">Tell me what report you need and I'll draft it using your real data. You can refine any section before finalizing.</p>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder='e.g. "Create a weekly performance report for the last 7 days, highlight our top 3 posts, include competitor comparison, and add sentiment trends. Make it executive-friendly."'
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Quick templates:</span>
                    {[
                      "Weekly performance",
                      "Monthly executive summary",
                      "KOL campaign review",
                      "Competitor deep dive",
                      "Content audit",
                    ].map(t => (
                      <button key={t} onClick={() => setAiPrompt(`Generate a ${t.toLowerCase()} report for the most recent period. Include key metrics, trends, highlights, and strategic recommendations.`)} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        {t}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setIsGenerating(true); setTimeout(() => setIsGenerating(false), 2000); }}
                    disabled={!aiPrompt.trim()}
                    className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${aiPrompt.trim() ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                  >
                    {isGenerating ? "Generating..." : "Generate Report"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Report Preview / Editor */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-gray-900">Report Preview</h4>
                <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">AI Draft</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Edit</button>
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Export PDF</button>
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Export Slides</button>
                <button className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save to Repository</button>
              </div>
            </div>

            {/* Mock report content */}
            <div className="p-6 max-h-[500px] overflow-y-auto">
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Weekly Social Performance Report</h2>
                  <p className="text-sm text-gray-500 mt-1">February 24 – March 2, 2026 | Highland Ventures</p>
                </div>

                {/* Executive summary */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Executive Summary</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">Strong week across X accounts with engagement rate up 12% WoW, driven primarily by a 5-tweet educational thread on founder evaluation signals that generated 24.3K impressions and 7.4% engagement. Reddit presence grew steadily with r/venturecapital posts driving quality discussions. Brand sentiment improved to 72.1 (+2.8), with "Product Innovation" as the strongest sentiment driver. Competitor A's viral thread temporarily captured SOV leadership for 3 days — recommended counter-content below.</p>
                </div>

                {/* Key metrics table */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">Key Metrics</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50">
                      <th className="text-left py-2 px-3 text-xs text-gray-500">Metric</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500">This Week</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500">Last Week</th>
                      <th className="text-right py-2 px-3 text-xs text-gray-500">Change</th>
                    </tr></thead>
                    <tbody>
                      {[
                        { metric: "Total Impressions", current: "24.3K", previous: "21.7K", change: "+12%", good: true },
                        { metric: "Engagement Rate", current: "4.2%", previous: "3.9%", change: "+0.3pp", good: true },
                        { metric: "Net Followers", current: "+187", previous: "+197", change: "-5%", good: false },
                        { metric: "Brand Sentiment", current: "72.1", previous: "69.3", change: "+4%", good: true },
                        { metric: "Share of Voice", current: "34%", previous: "36%", change: "-2pp", good: false },
                        { metric: "Posts Published", current: "14", previous: "14", change: "—", good: null },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium text-gray-900">{row.metric}</td>
                          <td className="py-2 px-3 text-right font-medium">{row.current}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{row.previous}</td>
                          <td className={`py-2 px-3 text-right font-medium ${row.good === true ? "text-green-600" : row.good === false ? "text-red-500" : "text-gray-400"}`}>{row.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* AI Section markers */}
                {["Top Performing Content", "Sentiment Analysis", "Competitor Landscape", "Recommendations"].map((section, i) => (
                  <div key={i} className="mb-4 p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{section}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">AI Generated</span>
                        <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit section →</button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Click "Edit section" to review and modify the AI-generated content for this section.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent AI generations */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Generations</h4>
            <div className="space-y-2">
              {[
                { prompt: "Weekly performance report for Feb 24–Mar 2", time: "2h ago", status: "Saved" },
                { prompt: "Quick competitor comparison — Competitor A vs Highland", time: "1d ago", status: "Draft" },
                { prompt: "KOL ROI analysis for Q1 campaign partners", time: "3d ago", status: "Saved" },
              ].map((gen, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[9px] font-bold">AI</div>
                    <span className="text-sm text-gray-700 truncate max-w-md">{gen.prompt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${gen.status === "Saved" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>{gen.status}</span>
                    <span className="text-xs text-gray-400">{gen.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === "repository" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="All saved reports with version history and download options">Report Repository</SectionTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {["all", "weekly", "monthly", "campaign", "competitor", "audit"].map(f => (
                  <button key={f} onClick={() => setReportTypeFilter(f)} className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${reportTypeFilter === f ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 bg-gray-50">
                {["Report", "Type", "Created By", "Date", "Pages", "AI %", "Downloads", ""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredReports.map(report => (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📄</span>
                        <div>
                          <span className="font-medium text-gray-900 block">{report.title}</span>
                          {report.status === "draft" && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">Draft</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        report.type === "weekly" ? "bg-blue-50 text-blue-600" :
                        report.type === "monthly" ? "bg-purple-50 text-purple-600" :
                        report.type === "campaign" ? "bg-green-50 text-green-600" :
                        report.type === "competitor" ? "bg-red-50 text-red-600" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {report.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {report.createdBy.includes("AI") && <span className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[8px] font-bold">AI</span>}
                        <span className="text-gray-600 text-xs">{report.createdBy}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{report.created}</td>
                    <td className="py-3 px-4 text-gray-600">{report.pages}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${report.aiPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{report.aiPct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{report.downloads}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">View</button>
                        <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">PDF</button>
                        <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Slides</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "benchmarks" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="12-month historical trends to track progress and set goals">Historical Benchmarks</SectionTitle>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: "engRate", label: "Engagement" },
                { key: "followers", label: "Followers" },
                { key: "impressions", label: "Impressions" },
                { key: "sentiment", label: "Sentiment" },
                { key: "sovPct", label: "Share of Voice" },
              ].map(m => (
                <button key={m.key} onClick={() => setSelectedBenchmark(m.key)} className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${selectedBenchmark === m.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Benchmark chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                {selectedBenchmark === "engRate" ? "Engagement Rate" : selectedBenchmark === "followers" ? "Total Followers" : selectedBenchmark === "impressions" ? "Monthly Impressions" : selectedBenchmark === "sentiment" ? "Brand Sentiment Score" : "Share of Voice"} — 12 Month Trend
              </h4>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Actual</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200" /> Target</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={benchmarkData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey={selectedBenchmark} stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Benchmark summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Engagement Rate", current: "4.2%", start: "2.1%", change: "+100%", goal: "5.0%", goalPct: 84 },
              { label: "Followers", current: "16.4K", start: "6.2K", change: "+165%", goal: "20K", goalPct: 82 },
              { label: "Impressions/mo", current: "24.3K", start: "8.0K", change: "+204%", goal: "30K", goalPct: 81 },
              { label: "Brand Sentiment", current: "72", start: "55", change: "+31%", goal: "80", goalPct: 90 },
              { label: "Share of Voice", current: "34%", start: "22%", change: "+55%", goal: "40%", goalPct: 85 },
            ].map((b, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{b.label}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl font-bold text-gray-900">{b.current}</span>
                  <span className="text-xs text-green-600 font-medium mb-1">{b.change} YoY</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Start: {b.start}</span>
                  <span>Goal: {b.goal}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${b.goalPct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{b.goalPct}% to goal</p>
              </div>
            ))}
          </div>

          {/* Period-over-period comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionTitle subtitle="Compare any two time periods to measure progress">Period Comparison</SectionTitle>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-blue-900 uppercase">Q1 2026 (Current)</h5>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">In Progress</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Avg Eng. Rate", value: "4.2%" },
                    { label: "Total Followers", value: "16,390" },
                    { label: "Avg Monthly Impressions", value: "24.3K" },
                    { label: "Avg Brand Sentiment", value: "72.1" },
                    { label: "Content Published", value: "42 posts" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-blue-700">{m.label}</span>
                      <span className="font-semibold text-blue-900">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-gray-600 uppercase">Q4 2025 (Previous)</h5>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">Completed</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Avg Eng. Rate", value: "3.1%" },
                    { label: "Total Followers", value: "11,200" },
                    { label: "Avg Monthly Impressions", value: "14.8K" },
                    { label: "Avg Brand Sentiment", value: "62.4" },
                    { label: "Content Published", value: "35 posts" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{m.label}</span>
                      <span className="font-semibold text-gray-800">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// TAB 7: ADMIN
// ============================================================

const AdminTab = () => {
  const [subTab, setSubTab] = useState("settings");

  const totalDeployed = roadmapItems.filter(r => r.status === "deployed").length;
  const totalItems = roadmapItems.length;
  const inProgress = roadmapItems.filter(r => r.status === "in_progress").length;
  const totalCost = costByService.reduce((s, c) => s + c.thisMonth, 0);
  const lastMonthTotal = costByService.reduce((s, c) => s + c.lastMonth, 0);
  const costDelta = (((totalCost - lastMonthTotal) / lastMonthTotal) * 100).toFixed(0);
  const budget = 150;

  const statusColors = { deployed: "bg-green-100 text-green-800", in_progress: "bg-blue-100 text-blue-800", not_started: "bg-gray-100 text-gray-600", blocked: "bg-red-100 text-red-800" };
  const statusLabels = { deployed: "Deployed", in_progress: "In Progress", not_started: "Not Started", blocked: "Blocked" };
  const reqStatusColors = { new: "bg-gray-100 text-gray-700", under_review: "bg-yellow-100 text-yellow-800", planned: "bg-blue-100 text-blue-800", in_progress: "bg-indigo-100 text-indigo-800", shipped: "bg-green-100 text-green-800", wont_do: "bg-red-100 text-red-700" };
  const reqTypeColors = { feature: "bg-purple-100 text-purple-700", bug: "bg-red-100 text-red-700", improvement: "bg-cyan-100 text-cyan-700", question: "bg-gray-100 text-gray-700" };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3">
        {[
          { key: "settings", label: "Settings" },
          { key: "costs", label: "Cost Tracker" },
          { key: "roadmap", label: "Product Roadmap" },
          { key: "requests", label: "Feature Requests", badge: featureRequests.filter(r => r.status === "new").length },
        ].map(t => (
          <TabButton key={t.key} active={subTab === t.key} onClick={() => setSubTab(t.key)} badge={t.badge}>{t.label}</TabButton>
        ))}
      </div>

      {subTab === "roadmap" && (
        <div>
          {/* Progress summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Features Deployed" value={`${totalDeployed} of ${totalItems}`} delta={Math.round((totalDeployed / totalItems) * 100)} deltaLabel="complete" />
            <MetricCard label="In Progress" value={inProgress} />
            <MetricCard label="Current Phase" value="Phase 2" />
            <MetricCard label="Velocity" value="2.3/week" delta={12} deltaLabel="vs last month" />
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm text-gray-500">{totalDeployed}/{totalItems} features ({Math.round((totalDeployed / totalItems) * 100)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all" style={{ width: `${(totalDeployed / totalItems) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>Phase 1 ✓</span>
              <span className="text-blue-600 font-medium">Phase 2 (current)</span>
              <span>Phase 3</span>
              <span>Phase 4</span>
            </div>
          </div>

          {/* Roadmap table by phase */}
          {["Phase 1", "Phase 2", "Phase 3", "Phase 4a", "Phase 4b", "Phase 4c"].map(phase => {
            const items = roadmapItems.filter(r => r.phase === phase);
            const deployed = items.filter(r => r.status === "deployed").length;
            const isCurrentPhase = items.some(r => r.status === "in_progress");
            return (
              <div key={phase} className={`bg-white rounded-xl border p-5 mb-4 ${isCurrentPhase ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{phase}</h4>
                    {isCurrentPhase && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Current</span>}
                  </div>
                  <span className="text-sm text-gray-500">{deployed}/{items.length} deployed</span>
                </div>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${item.status === "deployed" ? "bg-green-400" : item.status === "in_progress" ? "bg-blue-400 animate-pulse" : "bg-gray-300"}`} />
                        <span className={`text-sm ${item.status === "deployed" ? "text-gray-500" : "text-gray-900 font-medium"}`}>{item.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.deployed && <span className="text-xs text-gray-400">Shipped {item.deployed}</span>}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status]}`}>{statusLabels[item.status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Deploy log */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
            <SectionTitle subtitle="Auto-detected from GitHub pushes via webhook">Recent Deploys</SectionTitle>
            <div className="space-y-2">
              {deployLog.map((d, i) => (
                <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${d.status === "success" ? "bg-green-400" : "bg-red-400"}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">{d.sha}</code>
                      <span className="text-gray-800">{d.message}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{d.time}</span>
                      {d.items.map((item, j) => (
                        <span key={j} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">→ {item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === "requests" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle subtitle="Submitted by team members — vote to prioritize">Feature Requests</SectionTitle>
            <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">+ Submit Request</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                {["Title", "Type", "Submitted By", "Area", "Priority", "Votes", "Status", "Linked"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {featureRequests.sort((a, b) => b.votes - a.votes).map(req => (
                  <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-3 font-medium text-gray-900 max-w-xs">{req.title}</td>
                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${reqTypeColors[req.type]}`}>{req.type}</span></td>
                    <td className="py-3 px-3">
                      <div><span className="text-gray-900">{req.submittedBy}</span></div>
                      <div className="text-xs text-gray-400">{req.role} · {req.date}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{req.area}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium ${req.priority === "critical" ? "text-red-600" : req.priority === "high" ? "text-amber-600" : "text-gray-500"}`}>
                        {req.priority.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <button className="text-gray-400 hover:text-blue-600 text-lg leading-none">▲</button>
                        <span className="font-bold text-gray-900 min-w-[1.5rem] text-center">{req.votes}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${reqStatusColors[req.status]}`}>{req.status.replace("_", " ")}</span></td>
                    <td className="py-3 px-3 text-xs text-blue-600">{req.linkedItem || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "costs" && (
        <div>
          {/* Total cost card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">March 2026 — Total Platform Cost</p>
                <p className="text-4xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
                <p className="text-sm mt-1">
                  <span className="text-gray-500">of ${budget} budget</span>
                  <span className="mx-2">·</span>
                  <span className={+costDelta > 0 ? "text-amber-600" : "text-green-600"}>
                    {+costDelta > 0 ? "▲" : "▼"} {Math.abs(+costDelta)}% vs last month
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Budget Used</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round((totalCost / budget) * 100)}%</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
              <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${Math.min(100, (totalCost / budget) * 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>$0</span>
              <span className="text-amber-500">70% alert (${(budget * 0.7).toFixed(0)})</span>
              <span className="text-red-500">90% alert (${(budget * 0.9).toFixed(0)})</span>
              <span>${budget}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Cost by service */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle>Cost by Service</SectionTitle>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  {["Service", "This Month", "Last Month", "Δ", "% Total"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {costByService.map((c, i) => {
                    const delta = c.lastMonth > 0 ? (((c.thisMonth - c.lastMonth) / c.lastMonth) * 100).toFixed(0) : "—";
                    return (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="font-medium text-gray-900">{c.service}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-bold">${c.thisMonth.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-gray-500">${c.lastMonth.toFixed(2)}</td>
                        <td className="py-2.5 px-2">
                          {delta !== "—" && <span className={`text-xs font-medium ${+delta > 0 ? "text-amber-600" : +delta < 0 ? "text-green-600" : "text-gray-400"}`}>{+delta > 0 ? "▲" : +delta < 0 ? "▼" : "—"} {Math.abs(+delta)}%</span>}
                          {delta === "—" && <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                            </div>
                            <span className="text-xs text-gray-500">{c.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cost trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle>Daily Cost Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={costTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `$${v}`} />
                  <Area type="monotone" dataKey="xOfficial" stackId="1" stroke="#1d9bf0" fill="#93c5fd" name="X Official" />
                  <Area type="monotone" dataKey="twitterApiIo" stackId="1" stroke="#6b7280" fill="#d1d5db" name="TwitterAPI.io" />
                  <Area type="monotone" dataKey="reddit" stackId="1" stroke="#ff4500" fill="#fed7aa" name="Reddit" />
                  <Area type="monotone" dataKey="claude" stackId="1" stroke="#8b5cf6" fill="#ddd6fe" name="Claude" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost by feature */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <SectionTitle subtitle="Which features cost the most to operate?">Cost by Feature</SectionTitle>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                {["Feature", "API Calls", "Claude Tokens", "Monthly Cost", "Note"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {costByFeature.map((f, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{f.feature}</td>
                    <td className="py-2.5 px-3">{typeof f.calls === "number" ? f.calls.toLocaleString() : f.calls}</td>
                    <td className="py-2.5 px-3">{f.tokens}</td>
                    <td className="py-2.5 px-3 font-bold">${f.cost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Claude token breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle subtitle="Breakdown by AI job type">Claude API Token Usage</SectionTitle>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200">
                  {["Job", "Input", "Output", "Calls", "Cost"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {claudeTokenBreakdown.map((j, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium text-gray-900">{j.job}</td>
                      <td className="py-2 px-2 text-gray-600">{j.input}</td>
                      <td className="py-2 px-2 text-gray-600">{j.output}</td>
                      <td className="py-2 px-2">{j.calls}</td>
                      <td className="py-2 px-2 font-bold">${j.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="py-2 px-2">Total</td>
                    <td className="py-2 px-2">1.25M</td>
                    <td className="py-2 px-2">1.02M</td>
                    <td className="py-2 px-2">616</td>
                    <td className="py-2 px-2">${claudeTokenBreakdown.reduce((s, j) => s + j.cost, 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Lovable credits */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <SectionTitle>Lovable Credit Usage</SectionTitle>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Credits Used</span>
                    <span className="text-sm font-bold">62 of 100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-pink-500" style={{ width: "62%" }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Burn Rate</p>
                    <p className="text-lg font-bold">~2.5/day</p>
                    <p className="text-xs text-gray-400">trailing 7-day avg</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Projected Exhaustion</p>
                    <p className="text-lg font-bold">Mar 19</p>
                    <p className="text-xs text-amber-500">15 days left at current rate</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Cost per Credit</p>
                    <p className="text-lg font-bold">~$0.25</p>
                    <p className="text-xs text-gray-400">Pro plan ($25/100)</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Plan</p>
                    <p className="text-lg font-bold">Pro</p>
                    <p className="text-xs text-gray-400">$25/month</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Heads up:</strong> At current burn rate, you'll exhaust credits ~11 days before the billing cycle resets. Consider upgrading to Business ($50/mo, 200 credits) if velocity stays high during Phase 2.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === "settings" && (
        <div className="max-w-2xl">
          <SectionTitle>Admin Settings</SectionTitle>
          <div className="space-y-4">
            {[
              { title: "Connected Accounts", desc: "Manage OAuth connections, re-authenticate expired tokens", count: `${accounts.length} connected` },
              { title: "Team Management", desc: "Invite users, assign roles, manage Agency account access", count: "5 members" },
              { title: "API Configuration", desc: "X read provider toggle, spending caps, rate limit overrides" },
              { title: "Notification Settings", desc: "Slack webhook URL, email digest recipients, alert thresholds" },
              { title: "Polling Configuration", desc: "Override adaptive polling tiers, set business hours" },
              { title: "Data Retention", desc: "Configure how long to keep API logs, listening hits, metrics" },
              { title: "Export", desc: "Bulk export analytics, listening data, or KOL reports as CSV" },
            ].map((setting, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer">
                <div>
                  <h4 className="font-medium text-gray-900">{setting.title}</h4>
                  <p className="text-sm text-gray-500">{setting.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  {setting.count && <span className="text-sm text-gray-400">{setting.count}</span>}
                  <span className="text-gray-300">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN APP SHELL
// ============================================================

export default function SocialCommandCenter() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "composer", label: "Composer", icon: "✏️" },
    { key: "calendar", label: "Calendar", icon: "📅" },
    { key: "listening", label: "Social Listening", icon: "👂" },
    { key: "kol", label: "KOL Tracking", icon: "🌟" },
    { key: "reports", label: "Reports", icon: "📋" },
    { key: "admin", label: "Admin", icon: "⚙" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Social Command Center</h1>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Internal</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Account switcher */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex -space-x-1.5">
                {accounts.map(a => <Avatar key={a.id} initials={a.avatar} platform={a.platform} size="sm" />)}
              </div>
              <span className="text-sm text-gray-600 ml-1">All Accounts</span>
              <span className="text-gray-400">▾</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">M</div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="px-6 py-6 max-w-[1400px] mx-auto">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "composer" && <ComposerTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "listening" && <ListeningTab />}
        {activeTab === "kol" && <KOLTab />}
        {activeTab === "reports" && <ReportsTab />}
        {activeTab === "admin" && <AdminTab />}
      </main>
    </div>
  );
}
