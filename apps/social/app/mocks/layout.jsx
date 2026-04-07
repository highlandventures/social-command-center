import Link from 'next/link';

export const metadata = {
  title: 'YLDS Mocks — Figure Marketing',
  description: 'Internal YLDS website mocks, strategy docs, and research briefs.',
};

export default function MocksLayout({ children }) {
  return (
    <div style={{ margin: 0, padding: 0 }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(26,23,82,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 48px',
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/mocks" style={{ color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            YLDS Mocks
          </Link>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { href: '/mocks/wireframe', label: 'Wireframe' },
              { href: '/mocks/personas', label: 'Personas' },
              { href: '/mocks/strategy', label: 'Strategy' },
              { href: '/mocks/competitive', label: 'Competitive' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '6px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
                  transition: '0.2s',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
