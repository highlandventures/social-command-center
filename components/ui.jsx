'use client';

// ============================================================
// SHARED UTILITY COMPONENTS
// Extracted from SocialCommandCenter.jsx prototype
// ============================================================

export const COLORS = {
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  gray: "#6b7280",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  indigo: "#6366f1",
};

export const PlatformBadge = ({ platform }) => {
  const p = (platform || '').toLowerCase();
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        p === "x"
          ? "bg-gray-900 text-white"
          : "bg-orange-100 text-orange-800"
      }`}
    >
      {p === "x" ? "\u{1D54F}" : "Reddit"}
    </span>
  );
};

export const RelevanceBadge = ({ level }) => {
  const styles = {
    HIGH: "bg-green-100 text-green-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    LOW: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-bold ${
        styles[level] || styles.LOW
      }`}
    >
      {level}
    </span>
  );
};

export const SentimentDot = ({ sentiment }) => {
  const color =
    sentiment === "positive"
      ? "bg-green-400"
      : sentiment === "negative"
      ? "bg-red-400"
      : "bg-gray-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
};

export const ScoreBadge = ({ score }) => {
  const styles = {
    A: "bg-green-100 text-green-800 border-green-300",
    B: "bg-blue-100 text-blue-800 border-blue-300",
    C: "bg-yellow-100 text-yellow-800 border-yellow-300",
    D: "bg-red-100 text-red-800 border-red-300",
    F: "bg-red-200 text-red-900 border-red-400",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${
        styles[score] || styles.C
      }`}
    >
      {score}
    </span>
  );
};

export const TrendArrow = ({ trend, direction }) => {
  const d = trend || direction;
  if (d === "up") return <span className="text-green-500 text-sm">↑</span>;
  if (d === "down") return <span className="text-red-500 text-sm">↓</span>;
  return <span className="text-gray-400 text-sm">→</span>;
};

export const DeltaBadge = ({ value, pct, invert = false }) => {
  const isUp = value > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span
      className={`text-sm font-medium ${
        isGood ? "text-green-600" : "text-red-500"
      }`}
    >
      {isUp ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
};

export const MetricCard = ({ label, value, delta, deltaLabel }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {delta !== undefined && (
      <p className="mt-1.5">
        <span
          className={`text-sm font-medium ${
            delta >= 0 ? "text-green-600" : "text-red-500"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% {deltaLabel || "WoW"}
        </span>
      </p>
    )}
  </div>
);

export const SectionTitle = ({ children, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-gray-900">{children}</h3>
    {subtitle && (
      <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
    )}
  </div>
);

export const TabButton = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
      active
        ? "bg-gray-900 text-white"
        : "text-gray-600 hover:bg-gray-100"
    }`}
  >
    {children}
    {badge && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);

export const Avatar = ({ initials, platform, size = "md" }) => {
  const p = (platform || '').toLowerCase();
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white ${
        p === "reddit" ? "bg-orange-500" : "bg-gray-800"
      }`}
    >
      {initials}
    </div>
  );
};

export const Sparkline = ({ data, color = "#3b82f6", height = 24 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${
          height - ((v - min) / range) * height
        }`
    )
    .join(" ");
  return (
    <svg width={w} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
};

/** Skeleton placeholder for loading states */
export const Skeleton = ({ className = "" }) => (
  <div
    className={`animate-pulse bg-gray-200 rounded ${className}`}
  />
);

/** Loading card used in place of MetricCard while data is loading */
export const MetricCardSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-8 w-16 mb-2" />
    <Skeleton className="h-3 w-20" />
  </div>
);
