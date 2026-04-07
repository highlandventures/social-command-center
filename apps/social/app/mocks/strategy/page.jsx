'use client';

export default function StrategyPage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", background: '#F8F8FF', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 48px 32px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 500, color: '#262364', marginBottom: 8 }}>YLDS Website Strategy</h1>
        <p style={{ fontSize: 15, color: '#6B6B9B', marginBottom: 24 }}>Complete website upgrade strategy — information architecture, messaging framework, persona routing, compliance guidelines, and design system.</p>
      </div>
      <iframe
        src="/mocks-strategy.html"
        style={{
          width: '100%',
          height: 'calc(100vh - 200px)',
          border: 'none',
          borderTop: '1px solid #E8E8F0',
        }}
        title="YLDS Website Strategy"
      />
    </div>
  );
}
