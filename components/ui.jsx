'use client';

import { Component, createContext, useContext, useState, useCallback, useEffect } from 'react';

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

export const Avatar = ({ initials, src, platform, size = "md" }) => {
  const p = (platform || '').toLowerCase();
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  if (src) {
    return (
      <img
        src={src}
        alt={initials || ''}
        className={`${sizes[size]} rounded-full object-cover`}
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
    );
  }
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
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <div className="text-3xl mb-3">{'⚠️'}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
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
  success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: '\u2713' },
  error: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: '\u2717' },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: '\u26A0' },
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: '\u2139' },
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
  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
    {icon && <div className="text-4xl mb-3">{icon}</div>}
    <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">{description}</p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
);
