import { useState } from "react";

// Mock data
const MOCK_TASKS = [
  {
    id: "1",
    title: "Q2 HELOC Campaign — Social Ad Creative Review",
    status: "In Progress",
    priority: "High",
    due: "2026-04-02",
    product: ["Home Equity"],
    channel: ["Paid Social"],
    audience: ["Consumers (DTC)"],
    socialChannel: ["Instagram", "Facebook"],
    filedBy: "miso@highlandventures.io",
    notes: "Need L&C sign-off before launch. Rate claims in headline copy.",
    synced: true,
    createdAt: "2026-03-28",
  },
  {
    id: "2",
    title: "Digital Prime Webinar Landing Page Copy",
    status: "Not Started",
    priority: "Medium",
    due: "2026-04-07",
    product: ["Digital Prime"],
    channel: ["Website", "Email"],
    audience: ["Executives (Partners)"],
    socialChannel: [],
    filedBy: "miso@highlandventures.io",
    notes: "Partnership claims need review. Referencing specific yield numbers.",
    synced: true,
    createdAt: "2026-03-29",
  },
  {
    id: "3",
    title: "Mortgage Rate Lock Email Series — Compliance Check",
    status: "Not Started",
    priority: "High",
    due: "2026-04-04",
    product: ["Mortgage"],
    channel: ["Email"],
    audience: ["Consumers (DTC)", "Loan Officers"],
    socialChannel: [],
    filedBy: "aixa@figure.com",
    notes: "4-email drip sequence. APR disclaimers and rate lock terms need L&C review.",
    synced: false,
    createdAt: "2026-03-30",
  },
  {
    id: "4",
    title: "LinkedIn Thought Leadership Post — Markets Outlook",
    status: "Done",
    priority: "Low",
    due: "2026-03-27",
    product: ["Markets"],
    channel: ["Organic Social"],
    audience: ["Executives (Partners)"],
    socialChannel: ["LinkedIn"],
    filedBy: "miso@highlandventures.io",
    notes: "",
    synced: true,
    createdAt: "2026-03-25",
  },
];

const SCHEMA = {
  status: [
    { name: "Not Started", color: "#dc2626" },
    { name: "In Progress", color: "#2563eb" },
    { name: "Done", color: "#16a34a" },
  ],
  priority: [
    { name: "High", color: "#dc2626" },
    { name: "Medium", color: "#ca8a04" },
    { name: "Low", color: "#16a34a" },
  ],
  product: ["Home Equity", "Mortgage", "Insurance", "Markets", "Digital Prime"],
  channel: ["Paid Social", "Organic Social", "Email", "Blog", "Website", "Events", "PR", "Digital"],
  audience: ["Consumers (DTC)", "Existing Figure Customers", "Loan Officers", "Executives (Partners)"],
  socialChannel: ["Instagram", "LinkedIn", "X (Twitter)", "Facebook", "TikTok", "YouTube"],
};

// ─── Tokens ─────────────────────────────────────────────────────────────────
const t = {
  bg: "#0f1117",
  surface: "#161920",
  surfaceRaised: "#1c1f2a",
  surfaceHover: "#222634",
  border: "rgba(255,255,255,0.06)",
  borderEmphasis: "rgba(255,255,255,0.10)",
  text: "#e8eaed",
  textSecondary: "#9ba1b0",
  textMuted: "#5f6578",
  accent: "#6366f1",
  accentHover: "#818cf8",
  accentSubtle: "rgba(99,102,241,0.12)",
  success: "#22c55e",
  successSubtle: "rgba(34,197,94,0.10)",
  warning: "#eab308",
  warningSubtle: "rgba(234,179,8,0.10)",
  danger: "#ef4444",
  dangerSubtle: "rgba(239,68,68,0.08)",
  radius: "10px",
  radiusSm: "6px",
  radiusLg: "14px",
  font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

function StatusPill({ status }) {
  const map = {
    "Not Started": { bg: "rgba(239,68,68,0.10)", color: "#f87171" },
    "In Progress": { bg: "rgba(99,102,241,0.12)", color: "#818cf8" },
    Done: { bg: "rgba(34,197,94,0.10)", color: "#4ade80" },
  };
  const s = map[status] || map["Not Started"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 550,
        letterSpacing: "0.01em",
        background: s.bg,
        color: s.color,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
      {status}
    </span>
  );
}

function PriorityTag({ priority }) {
  if (!priority) return null;
  const map = {
    High: { bg: "rgba(239,68,68,0.08)", color: "#f87171", icon: "▲" },
    Medium: { bg: "rgba(234,179,8,0.08)", color: "#facc15", icon: "◆" },
    Low: { bg: "rgba(34,197,94,0.08)", color: "#4ade80", icon: "▼" },
  };
  const p = map[priority] || map["Medium"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 550,
        background: p.bg,
        color: p.color,
      }}
    >
      <span style={{ fontSize: 7 }}>{p.icon}</span>
      {priority}
    </span>
  );
}

function SyncDot({ synced }) {
  return (
    <span
      title={synced ? "Synced to Notion" : "Pending sync"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 500,
        color: synced ? "#4ade80" : t.textMuted,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: synced ? "#22c55e" : t.textMuted,
          boxShadow: synced ? "0 0 6px rgba(34,197,94,0.4)" : "none",
        }}
      />
      {synced ? "Synced" : "Pending"}
    </span>
  );
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        border: `1px solid ${selected ? t.accent : t.border}`,
        background: selected ? t.accentSubtle : "transparent",
        color: selected ? t.accentHover : t.textSecondary,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

function TaskRow({ task, expanded, onToggle }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.12s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={t.textMuted}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginTop: 3,
            flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 550,
                color: t.text,
                letterSpacing: "-0.01em",
              }}
            >
              {task.title}
            </span>
            <StatusPill status={task.status} />
            <PriorityTag priority={task.priority} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 5,
              fontSize: 11.5,
              color: t.textMuted,
            }}
          >
            {task.due && <span>Due {task.due}</span>}
            {task.product?.length > 0 && (
              <span style={{ color: t.textSecondary }}>{task.product.join(", ")}</span>
            )}
            <SyncDot synced={task.synced} />
          </div>
        </div>
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 18px 16px 44px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {task.notes && (
            <p style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5, margin: 0 }}>
              {task.notes}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11.5 }}>
            {task.channel?.length > 0 && (
              <div>
                <span style={{ color: t.textMuted }}>Channel </span>
                <span style={{ color: t.textSecondary }}>{task.channel.join(", ")}</span>
              </div>
            )}
            {task.audience?.length > 0 && (
              <div>
                <span style={{ color: t.textMuted }}>Audience </span>
                <span style={{ color: t.textSecondary }}>{task.audience.join(", ")}</span>
              </div>
            )}
            {task.socialChannel?.length > 0 && (
              <div>
                <span style={{ color: t.textMuted }}>Social </span>
                <span style={{ color: t.textSecondary }}>{task.socialChannel.join(", ")}</span>
              </div>
            )}
            <div>
              <span style={{ color: t.textMuted }}>Filed by </span>
              <span style={{ color: t.textSecondary }}>{task.filedBy}</span>
            </div>
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 500,
              color: t.accent,
              textDecoration: "none",
              marginTop: 2,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Notion
          </a>
        </div>
      )}
    </div>
  );
}

function CreateForm({ onClose }) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Not Started");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const [product, setProduct] = useState([]);
  const [channel, setChannel] = useState([]);
  const [audience, setAudience] = useState([]);
  const [socialChannel, setSocialChannel] = useState([]);
  const [notes, setNotes] = useState("");

  const toggle = (arr, setArr, val) =>
    setArr((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: t.font,
    background: t.bg,
    border: `1px solid ${t.borderEmphasis}`,
    borderRadius: t.radiusSm,
    color: t.text,
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  const selectStyle = {
    ...inputStyle,
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235f6578' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 30,
  };

  const labelStyle = {
    display: "block",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: t.textMuted,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        background: t.surfaceRaised,
        border: `1px solid ${t.borderEmphasis}`,
        borderRadius: t.radiusLg,
        padding: 22,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 650, color: t.text, margin: 0, letterSpacing: "-0.01em" }}>
          New Marketing Task
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: t.textMuted,
            fontSize: 12,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: t.radiusSm,
          }}
        >
          Cancel
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Task name</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 HELOC Campaign — Ad Creative Review"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = t.accent)}
            onBlur={(e) => (e.target.style.borderColor = t.borderEmphasis)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
              {SCHEMA.status.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due date</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {SCHEMA.priority.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Product</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {SCHEMA.product.map((p) => (
              <Chip key={p} label={p} selected={product.includes(p)} onClick={() => toggle(product, setProduct, p)} />
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Channel</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {SCHEMA.channel.map((c) => (
              <Chip key={c} label={c} selected={channel.includes(c)} onClick={() => toggle(channel, setChannel, c)} />
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Audience</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {SCHEMA.audience.map((a) => (
              <Chip key={a} label={a} selected={audience.includes(a)} onClick={() => toggle(audience, setAudience, a)} />
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Social Channel</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {SCHEMA.socialChannel.map((s) => (
              <Chip key={s} label={s} selected={socialChannel.includes(s)} onClick={() => toggle(socialChannel, setSocialChannel, s)} />
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context for the reviewer — rate claims, disclaimers, partner mentions..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            onFocus={(e) => (e.target.style.borderColor = t.accent)}
            onBlur={(e) => (e.target.style.borderColor = t.borderEmphasis)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 10.5, color: t.textMuted }}>
            Syncs to Marketing Tasks via Notion automation
          </span>
          <button
            style={{
              padding: "9px 20px",
              borderRadius: t.radiusSm,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: t.accent,
              color: "#fff",
              cursor: title.trim() ? "pointer" : "not-allowed",
              opacity: title.trim() ? 1 : 0.4,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => title.trim() && (e.target.style.background = t.accentHover)}
            onMouseLeave={(e) => (e.target.style.background = t.accent)}
          >
            File Task
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarketingTasksMock() {
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = filter ? MOCK_TASKS.filter((t) => t.status === filter) : MOCK_TASKS;
  const counts = {
    all: MOCK_TASKS.length,
    "Not Started": MOCK_TASKS.filter((t) => t.status === "Not Started").length,
    "In Progress": MOCK_TASKS.filter((t) => t.status === "In Progress").length,
    Done: MOCK_TASKS.filter((t) => t.status === "Done").length,
  };

  return (
    <div
      style={{
        fontFamily: t.font,
        background: t.bg,
        minHeight: "100vh",
        color: t.text,
        padding: "40px 48px",
      }}
    >
      {/* Header */}
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.text,
                margin: 0,
                letterSpacing: "-0.025em",
              }}
            >
              Marketing Tasks
            </h1>
          </div>
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0, lineHeight: 1.5 }}>
            File new tasks and track what's been submitted to L&C for review.
          </p>
        </div>

        {/* New task button / form */}
        {showForm ? (
          <div style={{ marginBottom: 20 }}>
            <CreateForm onClose={() => setShowForm(false)} />
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 0",
              marginBottom: 20,
              borderRadius: t.radius,
              border: `1px dashed ${t.borderEmphasis}`,
              background: "transparent",
              color: t.accent,
              fontSize: 13,
              fontWeight: 560,
              fontFamily: t.font,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.accentSubtle;
              e.currentTarget.style.borderColor = t.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = t.borderEmphasis;
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="4" x2="12" y2="20" />
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
            New Task
          </button>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[
            { label: "All", value: "", count: counts.all },
            { label: "Not Started", value: "Not Started", count: counts["Not Started"] },
            { label: "In Progress", value: "In Progress", count: counts["In Progress"] },
            { label: "Done", value: "Done", count: counts.Done },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 550,
                fontFamily: t.font,
                border: "none",
                cursor: "pointer",
                background: filter === tab.value ? t.accentSubtle : "transparent",
                color: filter === tab.value ? t.accentHover : t.textMuted,
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: filter === tab.value ? "rgba(99,102,241,0.2)" : t.surfaceRaised,
                  color: filter === tab.value ? t.accentHover : t.textMuted,
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Task list */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: t.radiusLg,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 18px",
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, letterSpacing: "-0.01em" }}>
              Task Inbox
            </span>
            <span style={{ fontSize: 11, color: t.textMuted }}>
              {filtered.length} task{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              expanded={expandedId === task.id}
              onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <span style={{ fontSize: 10.5, color: t.textMuted }}>
            Tasks sync to Notion every 5 minutes · Notion automation copies to Marketing Tasks
          </span>
        </div>
      </div>
    </div>
  );
}
