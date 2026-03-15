'use client';

import { Component, createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';

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

/** Theme-aware chart colors for Recharts */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  return {
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
    amber: "#f59e0b",
    gray: isDark ? "#9ca3af" : "#6b7280",
    purple: "#8b5cf6",
    cyan: "#06b6d4",
    indigo: "#6366f1",
    orange: "#f97316",

    grid: isDark ? "#292524" : "#f0f0f0",
    tooltipBg: isDark ? "#1c1917" : "#ffffff",
    tooltipBorder: isDark ? "#292524" : "#e5e7eb",
    tooltipText: isDark ? "#fafaf9" : "#111827",
    axisText: isDark ? "#a8a29e" : "#6b7280",

    fillGreen: isDark ? "rgba(34, 197, 94, 0.4)" : "#dcfce7",
    fillGray: isDark ? "rgba(107, 114, 128, 0.3)" : "#f3f4f6",
    fillRed: isDark ? "rgba(239, 68, 68, 0.4)" : "#fee2e2",
    fillBlue: isDark ? "rgba(59, 130, 246, 0.4)" : "#dbeafe",
  };
}

export const PlatformBadge = ({ platform }) => {
  const p = (platform || '').toLowerCase();
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        p === "x"
          ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
          : "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
      }`}
    >
      {p === "x" ? "\u{1D54F}" : "Reddit"}
    </span>
  );
};

export const RelevanceBadge = ({ level }) => {
  const styles = {
    HIGH: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    MEDIUM: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    LOW: "bg-surface-secondary text-content-muted",
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
      : "bg-gray-400 dark:bg-gray-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
};

export const ScoreBadge = ({ score }) => {
  const styles = {
    A: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
    B: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    C: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
    D: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
    F: "bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-300 border-red-400 dark:border-red-700",
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
  return <span className="text-content-faint text-sm">→</span>;
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

export const MetricCard = ({ label, value, delta, deltaLabel, benchmark }) => (
  <div className="bg-surface-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
    <p className="text-sm text-content-muted mb-1">{label}</p>
    <p className="text-2xl font-bold text-content-primary">{value}</p>
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
    {benchmark && (
      <div className="mt-2 pt-2 border-t border-border-secondary">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-content-faint uppercase tracking-wider">{benchmark.label || 'Top 10%'}</span>
          <span className="text-xs font-semibold text-content-secondary">{benchmark.value}</span>
        </div>
        {benchmark.delta != null && (
          <span className={`text-[10px] font-medium ${benchmark.delta >= 0 ? 'text-green-600' : 'text-amber-500'}`}>
            {benchmark.delta >= 0 ? '▲' : '▼'} {Math.abs(benchmark.delta)}% vs benchmark
          </span>
        )}
      </div>
    )}
  </div>
);

export const SectionTitle = ({ children, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-content-primary">{children}</h3>
    {subtitle && (
      <p className="text-sm text-content-muted mt-0.5">{subtitle}</p>
    )}
  </div>
);

export const TabButton = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
      active
        ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
        : "text-content-secondary hover:bg-surface-hover"
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

export const Avatar = ({ initials, src, platform, size = "md" }) => {
  const p = (platform || '').toLowerCase();
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  const fallback = (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white ${
        p === "reddit" ? "bg-orange-500" : "bg-gray-800 dark:bg-gray-600"
      }`}
      style={src ? { display: 'none' } : undefined}
    >
      {initials}
    </div>
  );
  if (src) {
    return (
      <>
        <img
          src={src}
          alt={initials || ''}
          className={`${sizes[size]} rounded-full object-cover`}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
        {fallback}
      </>
    );
  }
  return fallback;
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

/** Compact sparkline for sidebar use — configurable width/height, SVG polyline */
export function MiniSparkline({ data, width = 80, height = 24, color = COLORS.blue }) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="inline-block">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2}
          stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
      </svg>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) =>
      `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`
    )
    .join(' ');
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Skeleton placeholder for loading states */
export const Skeleton = ({ className = "" }) => (
  <div
    className={`animate-pulse bg-skeleton rounded ${className}`}
  />
);

/** Loading card used in place of MetricCard while data is loading */
export const MetricCardSkeleton = () => (
  <div className="bg-surface-card rounded-xl border border-border p-5">
    <Skeleton className="h-4 w-24 mb-2" />
    <Skeleton className="h-8 w-16 mb-2" />
    <Skeleton className="h-3 w-20" />
  </div>
);

// ============================================================
// ERROR BOUNDARY — Catches React render errors
// ============================================================

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-surface-card rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
          <div className="text-3xl mb-3">{'⚠️'}</div>
          <h3 className="text-lg font-semibold text-content-primary mb-1">Something went wrong</h3>
          <p className="text-sm text-content-muted mb-4 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================

const ToastContext = createContext(null);

/** Wrap your app with <ToastProvider> to enable useToast() anywhere. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback({
    success: (message, opts) => addToast({ type: 'success', message, ...opts }),
    error: (message, opts) => addToast({ type: 'error', message, ...opts }),
    info: (message, opts) => addToast({ type: 'info', message, ...opts }),
    warning: (message, opts) => addToast({ type: 'warning', message, ...opts }),
  }, [addToast]);

  // Assign methods to the toast function itself
  const toastFn = useCallback((message, opts) => addToast({ message, ...opts }), [addToast]);
  toastFn.success = (message, opts) => addToast({ type: 'success', message, ...opts });
  toastFn.error = (message, opts) => addToast({ type: 'error', message, ...opts });
  toastFn.info = (message, opts) => addToast({ type: 'info', message, ...opts });
  toastFn.warning = (message, opts) => addToast({ type: 'warning', message, ...opts });

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook to access toast notifications. Must be within <ToastProvider>. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const toastStyles = {
  success: { bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-300', icon: '\u2713' },
  error: { bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-300', icon: '\u2717' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300', icon: '\u26A0' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300', icon: '\u2139' },
};

function Toast({ toast, onClose }) {
  const style = toastStyles[toast.type] || toastStyles.info;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${
        style.bg
      } ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}
      style={{ minWidth: 280, maxWidth: 420 }}
    >
      <span className={`text-lg ${style.text}`}>{style.icon}</span>
      <p className={`text-sm font-medium flex-1 ${style.text}`}>{toast.message}</p>
      <button
        onClick={onClose}
        className={`text-sm ${style.text} opacity-60 hover:opacity-100 transition-opacity`}
      >
        {'\u2715'}
      </button>
    </div>
  );
}

// ============================================================
// EMPTY STATE — Reusable placeholder for pages with no data
// ============================================================

export const EmptyState = ({ icon, title, description, action }) => (
  <div className="bg-surface-card rounded-xl border border-border p-12 text-center">
    {icon && <div className="text-4xl mb-3">{icon}</div>}
    <h3 className="text-lg font-semibold text-content-primary mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-content-muted max-w-md mx-auto mb-4">{description}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
);
